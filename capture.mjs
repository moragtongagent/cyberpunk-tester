import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { win, run } from './lib.mjs';

export async function capture(folder, file, window, moves) {
  if (!/^\d+$/.test(window.handle)) throw Error('Invalid window handle.');
  const dest=path.join(folder,file);
  const filter='gfxcapture=hwnd='+window.handle+':max_framerate=20:capture_cursor=false:display_border=false,hwdownload,format=bgra';
  const args=['-hide_banner','-loglevel','error','-stats_period','0.2','-progress','pipe:1',
    '-f','lavfi','-i',filter,'-vf','scale=trunc(min(iw\\,1280)/2)*2:-2,format=yuv420p',
    '-r','20','-an','-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-movflags','+faststart','-n',dest];
  const proc=spawn('ffmpeg',args,{windowsHide:true,stdio:'pipe'});
  let frames=0, stderr='', partial='', launchError;
  proc.stdout.on('data', b=>{
    partial+=b.toString();
    const lines=partial.split(/\r?\n/); partial=lines.pop();
    for(const line of lines) if(line.startsWith('frame=')) frames=Number(line.slice(6));
  });
  proc.stderr.on('data',b=>{stderr=(stderr+b).slice(-1800);});
  proc.stdin.on('error',()=>{});
  proc.on('error',e=>{launchError=e;});
  let exited=false;
  const closed=new Promise(resolve=>proc.once('close',code=>{exited=true;resolve(code);}));
  let actionError;
  try {
    const deadline=Date.now()+20000;
    while(!exited && frames<2 && Date.now()<deadline) await delay(100);
    if(frames<2 || exited) throw Error(launchError?.message || stderr || 'No frames from the game window.');
    if(moves.some(a=>a.type!=='wait')) {
      const current=JSON.parse(await win('window'));
      if(current.handle!==window.handle || current.started!==window.started) throw Error('Game window changed.');
      await win('drive',{actions:moves, handle:window.handle, started:window.started});
    } else for(const a of moves) await delay(a.ms);
    await delay(1200);
  } catch(e) { actionError=e; }
  finally {
    proc.stdin.end('q\n');
    const timer=setTimeout(()=>proc.kill(),10000);
    const code=await closed;
    clearTimeout(timer);
    if(code!==0 && !actionError) actionError=Error(stderr || 'Recorder exited unexpectedly.');
  }
  if(actionError) throw actionError;
  const info=JSON.parse(await run('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height',
    '-of','json',dest]));
  const duration=Number(info.format.duration);
  if(!info.streams[0]?.width || !(duration>=0.5)) throw Error('Recorded clip is empty or too short.');
  const frame=file.replace(/\.mp4$/,'.png');
  await run('ffmpeg',['-v','error','-ss',String(Math.max(0,duration-0.3)),'-i',dest,'-frames:v','1','-n',path.join(folder,frame)]);
  await fs.access(path.join(folder,frame));
  return {duration,frame};
}
