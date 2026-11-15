import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {actions,judge,kinds,privateFolder,project,report,validatePlan,verifyMilestone} from './lib.mjs';
import {inspectDeployment,profileFromRows,requireBaseline} from './vortex.mjs';

test('controls validate and bound game inputs',()=>{
  assert.equal(actions([{type:'key',key:'up'}])[0].extended,true);
  assert.deepEqual(actions([]),[]);
  for(const input of [[{type:'click',x:2,y:0}],[{type:'key',key:'F5'}],Array(4).fill({type:'wait',ms:15000})])
    assert.throws(()=>actions(input));
});
test('pass and fail require case-specific test evidence',()=>{
  const result={verdict:'fail',prerequisite:'The call appeared',observed:'Answer was ignored',evidence:['a.mp4']};
  for(const steps of [[],[{clip:'a.mp4',phase:'route',valid:true}],[{clip:'a.mp4',phase:'test',valid:false}]])
    assert.throws(()=>judge(result,steps));
  assert.equal(judge(result,[{clip:'a.mp4',phase:'test',valid:true}]).verdict,'fail');
  assert.equal(judge({verdict:'inconclusive',observed:'Window unavailable'},[]).verdict,'inconclusive');
});
test('rejects paths in ticket identifiers and malformed plans',async()=>{
  await assert.rejects(()=>privateFolder('../outside'));
  assert.throws(()=>validatePlan({slot:'../ManualSave-1'}));
});
test('private report escapes untrusted text',()=>{
  const page=report({id:'ticket',ticket:'<img src=x>',attempts:[]});
  assert.ok(page.includes('&lt;img'));assert.ok(!page.includes('<img'));
});
test('ticket CLI persists intake, plans, blocked outcomes and report outside Git',async t=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'cpt-test-'));
  t.after(()=>fs.rm(temp,{recursive:true,force:true}));
  const env={...process.env,CPT_PRIVATE:path.join(temp,'private'),CPT_SAVES:path.join(temp,'saves')};
  function cli(args,payload,ok=true) {
    const p=spawnSync(process.execPath,['pilot.mjs',...args],{
      cwd:project,env,input:payload?JSON.stringify(payload):'',encoding:'utf8'
    });
    if(!ok) {assert.notEqual(p.status,0);return;}
    assert.equal(p.status,0,p.stderr);
    return JSON.parse(p.stdout);
  }
  const slot='ManualSave-7', dir=path.join(env.CPT_SAVES,slot);
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'sav.dat'),'synthetic');
  await fs.writeFile(path.join(dir,'metadata.9.json'),JSON.stringify({Data:{metadata:{level:3,userName:'excluded',trackedQuestEntry:'quests/example/meeting'}}}));
  assert.equal(cli(['saves'])[0].level,3);
  assert.ok(!JSON.stringify(cli(['saves'])).includes('excluded'));
  const {id}=cli(['new'],{ticket:'Synthetic case'});
  const plan={slot,route:'Walk to the entrance',cases:Object.fromEntries(kinds.map(k=>[k,{trigger:k,expected:'Objective visible',milestones:['Entrance reached']}]))};
  cli(['plan',id],plan,false);
  const sha=async name=>createHash('sha256').update(await fs.readFile(path.join(dir,name))).digest('hex');
  const marker=['NCL_CLASS_1','2',await sha('metadata.9.json'),await sha('sav.dat')].join('\n');
  await fs.writeFile(path.join(dir,'ncl-class-v1.txt'),marker);
  assert.equal(cli(['saves'])[0].ncl,'verified');
  assert.equal(cli(['saves','EXAMPLE/MEETING'])[0].role,2);
  assert.deepEqual(cli(['saves','other_branch']),[]);
  await fs.appendFile(path.join(dir,'sav.dat'),'changed');
  assert.equal(cli(['saves'])[0].ncl,'stale marker');
  assert.deepEqual(cli(['saves','meeting']),[]);
  cli(['finish',id],null,false);
  cli(['blocked',id],{reason:'Synthetic game unavailable'});
  assert.equal(cli(['finish',id]).outcomes.length,3);
  const state=cli(['status',id]);
  assert.ok(state.finished);assert.equal(state.plan,undefined);
  assert.match(await fs.readFile(path.join(env.CPT_PRIVATE,id,'report.html'),'utf8'),/Synthetic game unavailable/);
  env.CPT_PRIVATE=path.join(project,'should-never-exist');
  cli(['new'],{ticket:'Synthetic'},false);
  await assert.rejects(()=>fs.access(env.CPT_PRIVATE));
});
test('quest prerequisites require ordered, same-attempt route evidence',()=>{
  const a={steps:[{clip:'first',phase:'route',valid:true},{clip:'second',phase:'route',valid:true}]};
  const criteria=['Branch chosen','Caller eligible'];
  const proof={index:0,clip:'second',observed:'Choice accepted'};
  assert.throws(()=>verifyMilestone({...proof,index:1},a,criteria));
  a.milestones=[verifyMilestone(proof,a,criteria)];
  assert.throws(()=>verifyMilestone({...proof,index:1,clip:'first'},a,criteria));
});
test('profile, archive order, stray files and content changes affect qualification',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'cpt-deployment-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const file=async(name,body)=>{const dest=path.join(root,name);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,body);};
  const launcher='red4ext/plugins/NCLLauncher/NCLLauncher.dll';
  await file(launcher,'mod');await file('bin/x64/Cyberpunk2077.exe','game');
  for(const n of ['a','b']) await file('archive/pc/mod/'+n+'.archive',n);
  await file('vortex.deployment.json',JSON.stringify({targetPath:root,gameId:'cyberpunk2077',files:[{source:'test.ncl',relPath:launcher}]}));
  const rows=['settings.profiles.activeProfileId = "one"','persistent.profiles.one.gameId = "cyberpunk2077"',
    'persistent.profiles.one.modState.test.ncl.enabled = true','persistent.deployment.needToDeploy.cyberpunk2077 = false',
    'persistent.deployment.purged.cyberpunk2077 = false','persistent.loadOrders.one.cyberpunk2077-archive = [{"id":"a.archive"},{"id":"b.archive"}]',
    'persistent.loadOrders.one.cyberpunk2077-redmod = []'];
  const p=profileFromRows(rows.join('\n'));
  const first=await inspectDeployment(root,p);
  requireBaseline(first);
  await file('r6/scripts/override/test.reds','local override');
  assert.throws(()=>requireBaseline({ ...first,fingerprint:'changed'},first.fingerprint));
  assert.notEqual((await inspectDeployment(root,p)).fingerprint,first.fingerprint);
  await file('archive/pc/mod/modlist.txt','b.archive\na.archive');
  assert.ok((await inspectDeployment(root,p)).problems.some(s=>s.includes('priorities')));
  assert.ok((await inspectDeployment(root,{...p,enabled:[]})).problems.some(s=>s.includes('launcher')));
});
