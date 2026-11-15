import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const project = path.dirname(fileURLToPath(import.meta.url));
export const kinds = ['happy', 'edge', 'negative'];
const keys = {
  esc:1, one:2, two:3, three:4, four:5, five:6, six:7, seven:8, eight:9, nine:10, zero:11,
  tab:15, q:16, w:17, e:18, r:19, t:20, y:21, u:22,
  i:23, o:24, p:25, enter:28, ctrl:29, a:30, s:31, d:32, f:33, g:34, h:35, j:36, k:37, l:38,
  shift:42, z:44, x:45, c:46, v:47, b:48, n:49, m:50, space:57,
  up:72, left:75, right:77, down:80
};
const check = (ok, message) => { if (!ok) throw Error(message); };
export const textValue = (v, label) => {
  check(typeof v === 'string' && v.trim().length > 0, 'Missing ' + label);
  return v.trim();
};
const number = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
export function actions(input) {
  check(Array.isArray(input) && input.length <= 24, 'Supply up to 24 actions.');
  let duration = 0;
  return input.map(a => {
    let result;
    if (a?.type === 'key' && Object.hasOwn(keys, a.key) && number(a.ms ?? 90, 30, 5000)) {
      result = {type:'key', scan:keys[a.key], extended:['up','down','left','right'].includes(a.key), ms:a.ms ?? 90};
    } else if (a?.type === 'wait' && number(a.ms, 0, 15000)) {
      result = {type:'wait', ms:a.ms};
    } else if (a?.type === 'look' && number(a.x,-1600,1600) && number(a.y,-1600,1600)) {
      result = {type:'look', x:a.x, y:a.y};
    } else if(a?.type==='select') {
      result={type:'select'};
    } else if(a?.type==='scroll' && Number.isInteger(a.ticks) && number(a.ticks,-20,20)) {
      result={type:'scroll',ticks:a.ticks};
    } else if (a?.type === 'click' && number(a.x,0,1) && number(a.y,0,1)) {
      result = {type:'click', x:a.x, y:a.y};
    } else throw Error('Unsupported action or value outside bounds.');
    duration += result.ms ?? 100;
    check(duration <= 45000, 'Split this batch into shorter observations.');
    return result;
  });
}
export function run(exe, args, input='', timeout=30000, binary=false) {
  return new Promise((resolve,reject) => {
    const p = spawn(exe,args,{windowsHide:true,stdio:'pipe'});
    const output=[];
    let err='';
    const timer = setTimeout(() => p.kill(),timeout);
    p.stdout.on('data', b => output.push(b));
    p.stderr.on('data', b => { err = (err + b).slice(-5000); });
    p.stdin.on('error',()=>{});
    p.once('error', reject);
    p.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(binary ? Buffer.concat(output) : Buffer.concat(output).toString('utf8').trim());
      else reject(Error(err.trim() || exe + ' failed or timed out.'));
    });
    p.stdin.end(input);
  });
}
export const win = (mode, request={}) => run('pwsh',
  ['-NoProfile','-NonInteractive','-File',path.join(project,'windows.ps1'),mode],JSON.stringify(request),65000);
export const savesRoot = () => process.env.CPT_SAVES || path.join(process.env.USERPROFILE,'Saved Games','CD Projekt Red','Cyberpunk 2077');
export const isSlot = s => typeof s === 'string' && /^ManualSave-\d+$/i.test(s);
export async function gameRoot() {
  const root = process.env.CPT_GAME || JSON.parse(await win('discover') || 'null');
  check(root, 'Set CPT_GAME to the game installation folder.');
  return root;
}
export async function windowsGame() { return JSON.parse(await win('window')); }
export async function hashSave(slot) {
  check(isSlot(slot),'Select an ordinary manual save slot.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path.join(savesRoot(),slot,'sav.dat'))) hash.update(chunk);
  return hash.digest('hex');
}
export async function nclIdentity(slot) {
  if(!isSlot(slot)) throw Error('Invalid save slot.');
  const folder=path.join(savesRoot(),slot);
  let marker;
  try { marker=await fs.readFile(path.join(folder,'ncl-class-v1.txt'),'utf8'); }
  catch(e) { if(e.code==='ENOENT') return {state:'unverified'}; throw e; }
  const [header,role,metaHash,saveHash,...extra]=marker.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(header!=='NCL_CLASS_1'||!/^\d+$/.test(role)||extra.length||
      ![metaHash,saveHash].every(v=>/^[a-f0-9]{64}$/i.test(v??''))) return {state:'invalid marker'};
  const meta=await fs.readFile(path.join(folder,'metadata.9.json'));
  if(createHash('sha256').update(meta).digest('hex')!==metaHash.toLowerCase() ||
       await hashSave(slot)!==saveHash.toLowerCase()) return {state:'stale marker'};
  return {state:'verified',role:Number(role),saveHash:saveHash.toLowerCase()};
}
export async function saves() {
  const rows=[];
  for (const slot of await fs.readdir(savesRoot())) {
    if (!isSlot(slot)) continue;
    try {
      const folder=path.join(savesRoot(),slot);
      const metadata=(await fs.readdir(folder)).filter(x=>/^metadata\.\d+\.json$/i.test(x))
        .sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0];
      if (!metadata) continue;
      const m=JSON.parse((await fs.readFile(path.join(folder,metadata),'utf8')).replace(/^\uFEFF/, '')).Data.metadata;
      const stat=await fs.stat(path.join(folder,'sav.dat'));
      const identity=await nclIdentity(slot);
      rows.push({slot,ncl:identity.state,role:identity.role,modified:stat.mtime.toISOString(),level:m.level,location:m.locationName,
        tracked:m.trackedQuest,trackedEntry:m.trackedQuestEntry,active:m.activeQuests,finished:m.finishedQuests,build:m.buildPatch});
    } catch { /* A partially written save cannot be used for selection. */ }
  }
  return rows.sort((a,b)=>b.modified.localeCompare(a.modified));
}
export function privateRoot() {
  // Resolve the existing parents, including junctions, before writing anything.
  return path.resolve(process.env.CPT_PRIVATE || path.join(process.env.LOCALAPPDATA,'Cyberpunk-Tester','private'));
}
async function physical(p) {
  try { return await fs.realpath(p); } catch(e) {
    if (e.code !== 'ENOENT') throw e;
    const parent=path.dirname(p);
    if (parent === p) throw e;
    return path.join(await physical(parent),path.basename(p));
  }
}
export async function privateFolder(id) {
  check(/^CT-[0-9a-f]{12}$/.test(id),'Invalid ticket ID.');
  const folder=await physical(path.join(privateRoot(),id));
  let parent=folder;
  for (;;) {
    check(parent.toLowerCase() !== (await fs.realpath(project)).toLowerCase(),'Evidence must stay outside the checkout.');
    try { await fs.lstat(path.join(parent,'.git')); throw Error('Evidence cannot be kept in a Git checkout.'); }
    catch(e) { if (e.code !== 'ENOENT') throw e; }
    const next=path.dirname(parent); if(next === parent) break;
    parent=next;
  }
  return folder;
}
export async function saveJson(file,value) {
  const tmp=file+'.'+randomUUID()+'.tmp';
  await fs.writeFile(tmp,JSON.stringify(value,null,2),{flag:'wx'});
  await fs.rename(tmp,file);
}
export function validatePlan(p) {
  check(isSlot(p.slot),'Plan needs a manual save slot.');
  const cases={};
  for(const k of kinds) {
    const c=p.cases?.[k];
    check(Array.isArray(c?.milestones) && c.milestones.length>0,'Define the ordered prerequisites for '+k);
    cases[k]={trigger:textValue(c?.trigger,k+' trigger'),expected:textValue(c?.expected,k+' expected result'),
      milestones:c.milestones.map(m=>textValue(m,'observable milestone'))};
  }
  return {slot:p.slot,route:textValue(p.route,'route'),cases};
}
export function verifyMilestone(p,attempt,criteria) {
  const next=attempt.milestones?.length??0;
  check(p.index===next && next<criteria.length,'Record the next planned prerequisite in order.');
  const step=attempt.steps.find(s=>s.clip===p.clip && s.valid && s.phase==='route');
  check(step,'Milestone needs route evidence from this attempt.');
  const previous=attempt.milestones?.at(-1);
  check(!previous || attempt.steps.indexOf(step)>=attempt.steps.findIndex(s=>s.clip===previous.clip),'Evidence predates the previous milestone.');
  return {index:next,criterion:criteria[next],clip:step.clip,observed:textValue(p.observed,'observed state')};
}
export function judge(input, steps) {
  check(['pass','fail','inconclusive'].includes(input.verdict),'Invalid verdict.');
  const observed=textValue(input.observed,'observed result');
  const refs=input.evidence ?? [];
  check(Array.isArray(refs) && refs.every(ref=>steps.some(s=>s.clip===ref && s.valid)), 'Unknown or invalid evidence clip.');
  if(input.verdict !== 'inconclusive') {
    check(refs.length && steps.some(s=>s.phase==='test' && refs.includes(s.clip)),
      'Pass/fail needs reviewed test-phase footage from this attempt.');
    textValue(input.prerequisite,'observed prerequisite');
  }
  return {verdict:input.verdict,observed,prerequisite:input.prerequisite,evidence:refs};
}
const html = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function report(t,hasHighlights=false) {
  const verified=t.plan?.identity?.state==='verified' && t.plan.environment;
  const title=verified?'Lives of Night City':'Gameplay · unverified mod context';
  const baseline=verified?'<p>Vortex deployment fingerprint — '+html(t.plan.environment.fingerprint)+'</p>':'';
  const sections=kinds.map(k=>{
    const a=t.attempts.filter(a=>a.kind===k).at(-1);
    const result=a?.result;
    const media=(a?.steps??[]).filter(s=>s.valid).map(s=>
      '<details'+(result?.evidence.includes(s.clip)?' open':'')+'><summary>'+html(s.phase+' · '+s.goal)+'</summary><video controls preload="metadata" src="'+html(s.clip)+'"></video></details>').join('');
    const milestones=(a?.milestones??[]).map(m=>'<li>'+html(m.criterion)+' — '+html(m.observed)+' ('+html(m.clip)+')</li>').join('');
    const samples=(a?.observations??[]).map(o=>{
      const values=[o.objective?.result,o.role?.result,o.player?.result,...Object.values(o.facts??{}).map(f=>f.result)];
      return '<li>'+html(o.at)+' — '+values.filter(v=>v!=null).map(html).join('<br>')+'</li>';
    }).join('');
    const timeline=samples?'<details><summary>WkMCP observations</summary><ul>'+samples+'</ul></details>':'';
    return '<section><h2>'+k+' · '+html(result?.verdict??'pending')+'</h2><p>Trigger — '+html(t.plan?.cases[k].trigger)+'</p><p>Expected — '+html(t.plan?.cases[k].expected)+'</p><ol>'+milestones+'</ol><p>Prerequisite observed — '+html(result?.prerequisite)+'</p><p>Observed — '+html(result?.observed)+'</p>'+timeline+media+'</section>';
  }).join('');
  const highlights=hasHighlights?'<h2>Video highlights</h2><video controls preload="metadata" src="highlights.mp4"></video>':'';
  return '<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>'+html(t.id)+'</title><style>body{max-width:52rem;margin:3rem auto;font:16px/1.5 system-ui;background:#17191d;color:#eee}video{max-width:100%}section{border-top:1px solid #777;padding:1rem 0}details{margin:1rem 0}</style><h1>'+title+' · '+html(t.id)+'</h1><p>'+html(t.ticket)+'</p>'+highlights+baseline+'<p>Starting save — '+html(t.plan?.slot)+'</p><p>Route — '+html(t.plan?.route)+'</p>'+sections;
}
