import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';

// Only expose observations to the tester. All gameplay still goes through the input driver.
export async function observeGame(root, facts=[]) {
  if(!Array.isArray(facts) || facts.length>32 || facts.some(f=>typeof f!=='string'||!/^[a-zA-Z0-9_]{1,128}$/.test(f)))
    throw Error('Expected up to 32 named quest facts.');
  const pkg=process.env.CPT_WKMCP || path.join(process.env.LOCALAPPDATA,'Cyberpunk-Tester','tools','WkMCP-v2.1.0','package');
  const dll=path.join(pkg,'server','WkMcp.dll');
  await fs.access(dll);
  const proc=spawn('dotnet',[dll],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{
    ...process.env,CET_TRANSPORT:'file',CET_BRIDGE_DIR:path.join(root,'bin/x64/plugins/cyber_engine_tweaks/mods/CETBridge'),
    WKMCP_DAEMON:path.join(pkg,'daemon/WkDaemon.dll')
  }});
  const stream=createInterface({input:proc.stdout});
  let pending,serial=0;
  function rejectPending(e){pending?.reject(e);}
  proc.on('error',rejectPending);
  proc.on('exit',()=>rejectPending(Error('WkMCP exited before the reply.')));
  proc.stdin.on('error',rejectPending); proc.stderr.resume();
  stream.on('line',line=>{
    let response;
    try {response=JSON.parse(line);} catch{return;}
    if(!pending || response.id!==pending.id) return;
    if(response.error) pending.reject(Error(response.error.message));
    else pending.resolve(response.result);
  });
  async function request(method,params) {
    const id=++serial;
    let timer;
    try {return await new Promise((resolve,reject)=>{
      pending={id,resolve,reject};
      timer=setTimeout(()=>reject(Error('WkMCP timed out during '+method)),15000);
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
    });} finally {clearTimeout(timer);pending=undefined;}
  }
  async function tool(name,args={}) {
    const res=await request('tools/call',{name,arguments:{gamePath:root,...args}});
    const value=res.content?.find(v=>v.type==='text')?.text;
    if(res.isError || value===undefined) throw Error('WkMCP could not read '+name+': '+String(value).slice(0,250));
    const parsed=JSON.parse(value);
    if(parsed.ok!==true) throw Error(name+' returned no usable observation: '+(parsed.error||parsed.summary||'unknown'));
    return parsed;
  }
  try {
    const init=await request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'cyberpunk-tester',version:'1'}});
    proc.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
    const status=await tool('live_status');
    if(!status.connected || !status.fileHeartbeatFresh) throw Error('No fresh file bridge heartbeat.');
    const tracked='(function() local j=Game.GetJournalManager(); local e=j:GetTrackedEntry(); if not e then return "untracked" end; return Game.GetLocalizedText(e:GetDescription()) end)()';
    const result={at:new Date().toISOString(),server:init.serverInfo,transport:status.transport,
      player:await tool('live_player_info'),objective:await tool('live_eval',{expression:tracked}),facts:{}};
    const role='(function() local r=Game.GetScriptableSystemsContainer():Get("NCLRoleSystem"); if r then return NCLRoleCatalog.RoleLabel(r:NCLM2Role()) end; return "unavailable" end)()';
    result.role=await tool('live_eval',{expression:role});
    for(const factName of facts) result.facts[factName]=await tool('live_get_quest_fact',{factName});
    return result;
  } finally {stream.close();proc.stdin.end();proc.kill();}
}
