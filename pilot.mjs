import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { actions, gameRoot, nclIdentity, verifyMilestone, judge, kinds, privateFolder, privateRoot, report,
  run, saveJson, saves, textValue, validatePlan, win, windowsGame } from './lib.mjs';
import { capture } from './capture.mjs';
import {baseline,requireBaseline} from './vortex.mjs';
import {observeGame} from './wkmcp.mjs';
import {runWorker, workerCommand} from './worker.mjs';

const args=process.argv.slice(2);
const interactive=args[0]==='--interactive';
if(interactive) args.shift();
const [cmd,id,arg,extra]=args;
async function stdin() {
  let source=''; for await(const part of process.stdin) source+=part;
  return source.replace(/^\uFEFF/,'');
}
const input=async()=>JSON.parse(await stdin());
const print=v=>console.log(JSON.stringify(v,null,2));
const readJson=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const key=()=>randomUUID().replaceAll('-','').slice(0,12);
async function optionalFile(file) {
  try { return await fs.readFile(file,'utf8'); } catch(e) {if(e.code==='ENOENT') return null;throw e;}
}
async function doctor() {
  const root=await gameRoot();
  await fs.access(path.join(root,'bin','x64','Cyberpunk2077.exe'));
  const archives=await fs.readdir(path.join(root,'archive','pc','mod'));
  const filters=await run('ffmpeg',['-hide_banner','-filters']);
  const encoders=await run('ffmpeg',['-hide_banner','-encoders']);
  await run('ffprobe',['-version']);
  return {gameInstalled:true,nclArchives:archives.filter(a=>/^ncl_.*\.archive$/i.test(a)).length,
    manualSaves:(await saves()).length,windowCapture:filters.includes('gfxcapture'),h264:encoders.includes('libx264'),
    gameWindow:await windowsGame().then(()=>true,()=>false)};
}
function active(t) {
  const a=t.attempts.at(-1);
  if(!a || a.result) throw Error('Start a case first.');
  return a;
}
async function commit(file,t) {
  await saveJson(file,t);
  await writeReport(path.dirname(file),t);
}
async function writeReport(folder,t) {
  const reel=await fs.stat(path.join(folder,'highlights.mp4')).catch(e=>{if(e.code==='ENOENT') return null;throw e;});
  const file=path.join(folder,'report.html');
  await fs.writeFile(file,report(t,reel?.isFile()===true));
  return file;
}
// Only one CLI can alter the game or journal at once. The OS releases this lock on exit.
async function exclusive(fn) {
  const gate=net.createServer(socket=>socket.destroy());
  await new Promise((resolve,reject)=>gate.once('error',reject).listen({host:'127.0.0.1',port:49179,exclusive:true},resolve));
  try {return await fn();} finally {await new Promise(resolve=>gate.close(resolve));}
}
async function guarded(cmd,id,arg) {
  const folder=await privateFolder(id);
  const file=path.join(folder,'ticket.json');
  const leaseFile=path.join(path.dirname(folder),'active-ticket');
  const t=await readJson(file);
  const owner=(await optionalFile(leaseFile))?.trim();
  async function claim() {
    if(owner && owner!==id) throw Error('Game reserved by '+owner+'. Resume or release that ticket.');
    if(!owner) await fs.writeFile(leaseFile,id,{flag:'wx'});
  }
  if(cmd==='release') {
    if(owner!==id) throw Error('This ticket does not hold the game.');
    await fs.unlink(leaseFile);
    return {released:id};
  }
  if(cmd==='plan') {
    if(t.attempts.length) throw Error('Test expectations are fixed after attempts start.');
    t.plan=validatePlan(await input());
    t.plan.identity=await nclIdentity(t.plan.slot);
    if(t.plan.identity.state!=='verified') throw Error('Choose a hash-verified Lives of Night City save. This slot is '+t.plan.identity.state+'.');
    t.plan.environment=await baseline();
    requireBaseline(t.plan.environment);
    await commit(file,t);return {planned:id,slot:t.plan.slot};
  }
  if(!t.plan && cmd!=='blocked' && cmd!=='finish') throw Error('Plan the cases first.');
  if(cmd==='start') {
    if(!kinds.includes(arg)) throw Error('Choose happy, edge, or negative.');
    if(t.attempts.at(-1) && !t.attempts.at(-1).result) throw Error('Finish the current attempt first.');
    if(!t.plan.environment || !t.plan.identity) throw Error('This plan predates profile and save checks. Create a new ticket.');
    const identity=await nclIdentity(t.plan.slot);
    if(JSON.stringify(identity)!==JSON.stringify(t.plan.identity)) throw Error('Starting save or class marker changed since planning.');
    requireBaseline(await baseline(),t.plan.environment.fingerprint);
    await claim();
    let current=await windowsGame().catch(()=>null);
    if(current) {
      if(current.pid!==t.game?.pid || current.started!==t.game?.started)
        throw Error('Another game session is open. Save and close it before the first launch.');
      await win('close',current);
      const until=Date.now()+35000;
      while(Date.now()<until && await windowsGame().then(()=>true,()=>false)) await delay(500);
    }
    const exe=path.join(await gameRoot(),'bin','x64','Cyberpunk2077.exe');
    t.game=JSON.parse(await win('launch',{exe,slot:t.plan.slot}));
    delete t.finished;
    t.attempts.push({kind:arg,started:new Date().toISOString(),steps:[]});
    await commit(file,t);
    return {started:arg,slot:t.plan.slot,next:'Observe the loaded save and verify the route visually.'};
  }
  if(cmd==='milestone') {
    const a=active(t);
    const proof=verifyMilestone(await input(),a,t.plan.cases[a.kind].milestones);
    (a.milestones??=[]).push(proof);
    await commit(file,t);return proof;
  }
  if(cmd==='observe') {
    const a=active(t), w=await windowsGame();
    if(owner!==id || w.pid!==t.game?.pid || w.started!==t.game?.started) throw Error('The reserved game session is unavailable.');
    const observation=await observeGame(await gameRoot(),(await input()).facts);
    (a.observations??=[]).push(observation);
    await commit(file,t);return observation;
  }
  if(cmd==='step') {
    const a=active(t);
    if(owner!==id) throw Error('Game reservation lost; close this attempt as inconclusive and restart.');
    const p=await input();
    if(!['route','test'].includes(p.phase)) throw Error('Phase must be route or test.');
    if(p.phase==='test' && (!t.plan.environment || !t.plan.cases[a.kind].milestones?.length ||
       a.milestones?.length!==t.plan.cases[a.kind].milestones.length)) throw Error('Record evidence for each planned prerequisite first.');
    const goal=textValue(p.goal,'step goal');
    const moves=actions(p.actions);
    const w=await windowsGame();
    if(w.pid!==t.game?.pid || w.started!==t.game?.started) throw Error('The ticket game process changed.');
    const clip=a.kind+'-'+key()+'.mp4';
    const step={phase:p.phase,goal,actions:p.actions,clip,valid:false,started:new Date().toISOString()};
    a.steps.push(step);
    await commit(file,t);
    try { Object.assign(step,await capture(folder,clip,w,moves),{valid:true}); }
    catch(e) {
      step.error='Capture or input did not complete.';
      await commit(file,t); throw e;
    }
    await commit(file,t);
    return {clip,frame:step.frame,seconds:step.duration};
  }
  if(cmd==='judge') {
    const a=active(t);
    const result=judge(await input(),a.steps);
    if(result.verdict!=='inconclusive') {
      if(!t.plan.environment || !t.plan.cases[a.kind].milestones?.length ||
        a.milestones?.length!==t.plan.cases[a.kind].milestones.length) throw Error('Prerequisite evidence is incomplete.');
      requireBaseline(await baseline(),t.plan.environment.fingerprint);
    }
    a.result=result;
    await commit(file,t);return a.result;
  }
  if(cmd==='blocked') {
    const reason=textValue((await input()).reason,'reason');
    for(const kind of kinds) {
      let a=t.attempts.filter(v=>v.kind===kind).at(-1);
      if(a?.result) continue;
      if(!a) {a={kind,steps:[]};t.attempts.push(a);}
      a.result={verdict:'inconclusive',observed:reason,evidence:[]};
    }
    await commit(file,t);return {recorded:true};
  }
  if(cmd==='finish') {
    if(!kinds.every(k=>t.attempts.filter(a=>a.kind===k).at(-1)?.result)) throw Error('All three cases need an outcome.');
    if(owner===id && t.game) {
      const w=await windowsGame().catch(()=>null);
      if(w && w.pid===t.game.pid && w.started===t.game.started) await win('close',w);
    }
    t.finished=new Date().toISOString();
    await commit(file,t);
    if(owner===id) await fs.unlink(leaseFile);
    return {ticket:id,report:'report.html',outcomes:kinds.map(k=>[k,t.attempts.filter(a=>a.kind===k).at(-1).result.verdict])};
  }
  throw Error('Unknown command.');
}
async function main() {
  if(cmd==='doctor') return print(await doctor());
  if(cmd==='profile') {
    const {order,...summary}=await baseline();
    return print(id==='--details'?{...summary,order}:summary);
  }
  if(cmd==='saves') {
    const rows=await saves();
    if(!id) return print(rows);
    const fragment=id.toLowerCase();
    return print(rows.filter(row=>row.ncl==='verified' && row.trackedEntry?.toLowerCase().includes(fragment)));
  }
  if(cmd==='smoke') return print(await exclusive(async()=>{
    const probeId='CT-'+key(), folder=await privateFolder(probeId);
    await fs.mkdir(folder,{recursive:true});
    if(await optionalFile(path.join(path.dirname(folder),'active-ticket'))) throw Error('A ticket is using the game.');
    let w=await windowsGame().catch(()=>null), launched;
    try {
      if(!w) {
        const exe=path.join(await gameRoot(),'bin','x64','Cyberpunk2077.exe');
        launched=JSON.parse(await win('launch',{exe}));
        const until=Date.now()+110000;
        while(!w && Date.now()<until) {
          await delay(2000); w=await windowsGame().catch(()=>null);
        }
        if(!w || w.pid!==launched.pid) throw Error('No window from the launched game.');
        await delay(8000);
      }
      const clip='window-smoke.mp4';
      let result;
      for(let attempt=0;attempt<3;attempt++) {
        try { result=await capture(folder,clip,w,[]); break; }
        catch(e) {
          if(attempt===2) throw e;
          await fs.rm(path.join(folder,clip),{force:true});
          await delay(3000); w=await windowsGame();
          if(launched && w.pid!==launched.pid) throw Error('Game window changed during startup.');
        }
      }
      return {privateFolder:probeId,clip,...result};
    } finally {
      if(launched) {
        const current=await windowsGame().catch(()=>null);
        if(current?.pid===launched.pid && current.started===launched.started) await win('close',current);
      }
    }
  }));
  if(cmd==='new') {
    const ticket=textValue((await input()).ticket,'ticket');
    const id='CT-'+key(), folder=await privateFolder(id);
    await fs.mkdir(path.dirname(folder),{recursive:true}); await fs.mkdir(folder);
    await commit(path.join(folder,'ticket.json'),{id,ticket,created:new Date().toISOString(),attempts:[]});
    return print({id});
  }
  const folder=await privateFolder(id);
  if(cmd==='status') return print(await readJson(path.join(folder,'ticket.json')));
  if(cmd==='open') {
    const file=await writeReport(folder,await readJson(path.join(folder,'ticket.json')));
    await win('open',{file});return;
  }
  if(cmd==='frame') {
    const t=await readJson(path.join(folder,'ticket.json'));
    const step=t.attempts.flatMap(a=>a.steps).find(s=>s.valid && s.frame===arg);
    if(!step) throw Error('Unknown private frame.');
    if(extra!==undefined) {
      const sec=Number(extra);
      if(!Number.isFinite(sec) || sec<0 || sec>=step.duration) throw Error('Time is outside the clip.');
      const png=await run('ffmpeg',['-v','error','-ss',String(sec),'-i',path.join(folder,step.clip),'-frames:v','1','-c:v','png','-f','image2pipe','pipe:1'], '',30000,true);
      process.stdout.write(png.toString('base64'));
    } else process.stdout.write((await fs.readFile(path.join(folder,step.frame))).toString('base64'));
    return;
  }
  print(await exclusive(()=>guarded(cmd,id,arg)));
}
async function entry() {
  if(cmd==='worker' && !interactive && args.length===1) {
    await win('worker-session');
    await runWorker();
  } else if(interactive) {
    await main();
  } else {
    await workerCommand(args,stdin);
  }
}
entry().catch(e=>{
  // Host errors may contain private user or install paths. Keep them off chat stdout.
  const hide=s=>String(s).replaceAll(process.env.USERPROFILE||'\0','<user-folder>').replaceAll(process.env.USERNAME||'\0','<user>');
  console.error(hide(e.message)); process.exitCode=1;
});
