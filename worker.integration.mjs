import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {project} from './lib.mjs';

test('ticket commands use the worker by default and download private evidence', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cpt-worker-test-'));
  const workerRoot = path.join(temp, 'worker');
  const clientRoot = path.join(temp, 'client');
  const socket = net.createServer();
  socket.listen({host: '127.0.0.1', port: 0});
  await once(socket, 'listening');
  const {port} = socket.address();
  await new Promise(resolve => socket.close(resolve));
  const token = randomBytes(32).toString('base64url');
  const env = {...process.env, CPT_WORKER_PORT: String(port), CPT_WORKER_TOKEN: token};
  const worker = spawn(process.execPath, ['pilot.mjs', 'worker'], {
    cwd: project, env: {...env, CPT_PRIVATE: workerRoot}, stdio: ['ignore', 'pipe', 'pipe']
  });
  const closed = once(worker, 'close');
  t.after(async () => {
    worker.kill();
    await closed;
    await fs.rm(temp, {recursive: true, force: true});
  });
  const ready = await Promise.race([
    once(worker.stdout, 'data').then(([line]) => line.toString()),
    closed.then(() => { throw Error('Worker exited before listening.'); })
  ]);
  assert.match(ready, /worker listening/);

  function cli(args, payload, overrides = {}) {
    return spawnSync(process.execPath, ['pilot.mjs', ...args], {
      cwd: project, env: {...env, CPT_PRIVATE: clientRoot, ...overrides}, encoding: 'utf8',
      input: payload === undefined ? '' : JSON.stringify(payload), timeout: 15000
    });
  }
  function success(args, payload) {
    const result = cli(args, payload);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  const denied = cli(['new'], {ticket: 'Denied'}, {CPT_WORKER_TOKEN: 'x'.repeat(32)});
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /authentication failed/);
  await assert.rejects(fs.access(workerRoot), {code: 'ENOENT'});

  const {id} = success(['new'], {ticket: 'Synthetic remote ticket'});
  await assert.rejects(fs.access(clientRoot), {code: 'ENOENT'});
  success(['blocked', id], {reason: 'Synthetic game unavailable'});
  assert.equal(success(['finish', id]).outcomes.length, 3);
  const state = success(['status', id]);
  assert.ok(state.finished);

  const clip = 'happy-0123456789ab.mp4';
  const frame = 'happy-0123456789ab.png';
  const bytes = Buffer.from('synthetic evidence bytes');
  const folder = path.join(workerRoot, id);
  state.attempts[0].steps.push({phase: 'route', goal: 'Synthetic capture', valid: true, clip, frame});
  await fs.writeFile(path.join(folder, 'ticket.json'), JSON.stringify(state));
  await fs.writeFile(path.join(folder, clip), bytes);
  await fs.writeFile(path.join(folder, frame), bytes);
  const fetchedFrame = cli(['frame', id, frame]);
  assert.equal(fetchedFrame.status, 0, fetchedFrame.stderr);
  assert.deepEqual(Buffer.from(fetchedFrame.stdout, 'base64'), bytes);

  const saved = success(['open', id, '--download']);
  const localReport = path.join(clientRoot, id, saved.report);
  assert.match(await fs.readFile(localReport, 'utf8'), /Synthetic remote ticket/);
  assert.deepEqual(await fs.readFile(path.join(path.dirname(localReport), clip)), bytes);

  const headers = {Authorization: 'Bearer ' + token};
  const base = 'http://127.0.0.1:' + port;
  assert.equal((await fetch(base + '/command', {
    method: 'POST', headers, body: JSON.stringify({args: ['--interactive', 'new'], input: ''})
  })).status, 400);
  assert.equal((await fetch(base + '/video/' + id + '/ticket.json', {headers})).status, 404);
  await fs.writeFile(path.join(folder, 'happy-abcdef000000.mp4'), bytes);
  assert.equal((await fetch(base + '/video/' + id + '/happy-abcdef000000.mp4', {headers})).status, 404);

  worker.kill();
  await closed;
  const unavailable = cli(['new'], {ticket: 'Must stay off the client'});
  assert.equal(unavailable.status, 1);
  assert.match(unavailable.stderr, /Could not reach the Windows worker/);
  assert.deepEqual(await fs.readdir(clientRoot), [id]);
});
