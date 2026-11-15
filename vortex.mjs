import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {gameRoot,run} from './lib.mjs';

const game='cyberpunk2077';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const lower=s=>s.toLowerCase();
const slash=s=>s.replaceAll('\\','/');
async function fileHash(file) {
  const h=createHash('sha256');
  for await(const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}
async function listing(dir) {
  try {return await fs.readdir(dir,{withFileTypes:true});}
  catch(e) {if(e.code==='ENOENT') return [];throw e;}
}
async function lines(file) {
  try {return (await fs.readFile(file,'utf8')).replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}
  catch(e) {if(e.code==='ENOENT') return null;throw e;}
}
// Include loose overrides alongside Vortex-owned files. Runtime logs and databases
// can change while the game runs and do not describe the installed load order.
async function looseInputs(root,relative,hashes) {
  for(const entry of await listing(path.join(root,relative))) {
    const name=path.posix.join(relative,entry.name);
    if(entry.isDirectory()) await looseInputs(root,name,hashes);
    else if(!hashes.has(name) && /\.(?:archive|xl|reds|lua|dll|asi|yaml|yml|tweak|toml|ini)$/i.test(name))
      hashes.set(name,await fileHash(path.join(root,name)));
  }
}
export function profileFromRows(output) {
  const rows=new Map();
  for(const line of output.split(/\r?\n/)) {
    const split=line.indexOf(' = ');
    if(split<0 || !/^(settings\.profiles\.|persistent\.)/.test(line)) continue;
    rows.set(line.slice(0,split),JSON.parse(line.slice(split+3)));
  }
  const id=rows.get('settings.profiles.activeProfileId');
  const base='persistent.profiles.'+id+'.';
  if(!id || rows.get(base+'gameId')!==game) throw Error('Vortex has no verified active Cyberpunk profile.');
  const prefix=base+'modState.';
  const enabled=[...rows].filter(([k,v])=>k.startsWith(prefix)&&k.endsWith('.enabled')&&v===true)
    .map(([k])=>k.slice(prefix.length,-'.enabled'.length)).sort();
  const orders='persistent.loadOrders.'+id+'.cyberpunk2077-';
  const archive=rows.get(orders+'archive'),redmod=rows.get(orders+'redmod');
  if(!Array.isArray(archive)||!Array.isArray(redmod)) throw Error('Vortex archive or REDmod order is unavailable.');
  return {id,enabled,archive,redmod,pending:rows.get('persistent.deployment.needToDeploy.'+game),
    purged:rows.get('persistent.deployment.purged.'+game)};
}
async function currentProfile() {
  const exe=process.env.CPT_VORTEX_EXE || path.join(process.env.ProgramFiles,'Black Tree Gaming Ltd','Vortex','Vortex.exe');
  const keys=['settings.profiles.activeProfileId','persistent.profiles','persistent.loadOrders','persistent.deployment'];
  return profileFromRows(await run(exe,keys.flatMap(k=>['--get',k]),'',20000));
}
export async function inspectDeployment(root,profile) {
  const manifest=JSON.parse((await fs.readFile(path.join(root,'vortex.deployment.json'),'utf8')).replace(/^\uFEFF/,''));
  if(manifest.gameId!==game || lower(path.resolve(manifest.targetPath))!==lower(path.resolve(root)))
    throw Error('Vortex deployment targets a different installation.');
  const problems=[];
  if(profile.pending!==false || profile.purged!==false) problems.push('Deployment is pending, purged or unconfirmed.');
  const files=manifest.files.map(f=>({name:slash(f.relPath),source:f.source,target:f.target||''}));
  const enabled=new Set(profile.enabled);
  if(files.some(f=>!enabled.has(f.source))) problems.push('The deployment contains files from a mod outside the active profile.');
  const launchers=files.filter(f=>lower(f.name)==='red4ext/plugins/ncllauncher/ncllauncher.dll' && enabled.has(f.source));
  if(!launchers.length) problems.push('Lives of Night City launcher is absent from the active Vortex deployment.');
  const archiveDir=path.join(root,'archive/pc/mod');
  const archives=(await listing(archiveDir)).map(e=>e.name).filter(n=>/\.archive$/i.test(n)).sort();
  const orderFile=await lines(path.join(archiveDir,'modlist.txt'));
  const expected=profile.archive.map(e=>lower(e.id));
  const installed=new Set(archives.map(lower));
  const configured=new Set(expected);
  const actual=(orderFile??archives).map(lower);
  if(expected.some(n=>!installed.has(n)) || JSON.stringify(actual.filter(n=>configured.has(n)))!==JSON.stringify(expected))
    problems.push('Vortex archive priorities and the deployed archive order disagree.');
  const redList=await lines(path.join(root,'V2077/modlist.txt')) ?? [];
  const redmods=profile.redmod.filter(e=>e.enabled).map(e=>path.basename(e.redmodPath || e.id));
  if(JSON.stringify(redmods.map(lower))!==JSON.stringify(redList.map(lower))) problems.push('REDmod deployment order is unconfirmed.');
  // Vortex performs REDdeploy at launch. A direct executable launch cannot attest that step.
  if(redmods.length) problems.push('Enabled REDmods require a Vortex-managed launch and verified compiled cache.');
  const hashes=new Map();
  for(const name of archives) hashes.set('archive/pc/mod/'+name,await fileHash(path.join(archiveDir,name)));
  let missing=0;
  for(const f of files) {
    const rel=path.join(f.target,f.name);
    const file=path.resolve(root,rel);
    if(!file.startsWith(path.resolve(root)+path.sep)) throw Error('Unexpected deployment destination.');
    if(hashes.has(slash(rel))) continue;
    try { hashes.set(slash(rel),await fileHash(file)); }
    catch(e){if(e.code!=='ENOENT') throw e; missing++;}
  }
  if(missing) problems.push('Some Vortex deployment files are missing.');
  for(const dir of ['archive/pc/mod','r6/scripts','r6/tweaks','red4ext/plugins',
    'bin/x64/plugins/cyber_engine_tweaks/mods','engine/config/platform/pc'])
    await looseInputs(root,dir,hashes);
  const inventory=[...hashes].sort(([a],[b])=>a<b?-1:a>b?1:0);
  const fingerprint=digest({profile,files,archives,orderFile,redList,inventory,gameBuild:await fileHash(path.join(root,'bin/x64/Cyberpunk2077.exe'))});
  return {fingerprint,enabledMods:enabled.size,archives:archives.length,managedFiles:files.length,
    archiveMode:orderFile?'explicit list':'default archive order',problems,
    order:{profileId:profile.id,enabled:profile.enabled,vortexArchives:profile.archive.map(e=>e.id),
      installedArchives:archives,archiveList:orderFile,redmods: redList}};
}
export async function baseline() {
  return inspectDeployment(await gameRoot(),await currentProfile());
}
export function requireBaseline(state,expected) {
  if(state.problems.length) throw Error(state.problems.join(' '));
  if(expected && state.fingerprint!==expected) throw Error('Profile, load order or deployed files changed. Use a new baseline.');
}
