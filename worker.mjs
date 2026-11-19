import {timingSafeEqual} from 'node:crypto';
import {createReadStream, createWriteStream} from 'node:fs';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {kinds, privateFolder, project, report, run, win} from './lib.mjs';

const host = '127.0.0.1';
const commandArgs = new Map([
  ['doctor', [0]], ['new', [0]], ['profile', [0, 1]], ['saves', [0, 1]],
  ['plan', [1]], ['start', [2]], ['step', [1]], ['milestone', [1]], ['observe', [1]],
  ['frame', [2, 3]], ['judge', [1]], ['blocked', [1]], ['finish', [1]],
  ['status', [1]], ['release', [1]], ['smoke', [0]]
]);
const needsInput = new Set(['new', 'plan', 'step', 'milestone', 'observe', 'judge', 'blocked']);
const ticketId = /^CT-[0-9a-f]{12}$/;
const videoName = /^(?:highlights|(?:happy|edge|negative)-[0-9a-f]{12})\.mp4$/;

function settings() {
  const token = process.env.CPT_WORKER_TOKEN;
  const port = Number(process.env.CPT_WORKER_PORT ?? 49180);
  if (!/^[A-Za-z0-9._~-]{32,}$/.test(token ?? '')) {
    throw Error('Set CPT_WORKER_TOKEN on both the client and Windows worker, or use --interactive to run locally.');
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid CPT_WORKER_PORT.');
  return {token, port};
}

function validCommand(args) {
  return Array.isArray(args) && args.every(arg => typeof arg === 'string') &&
    commandArgs.get(args[0])?.includes(args.length - 1);
}

async function readRequest(request) {
  const buffers = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) throw Error('Worker request exceeds 1 MiB.');
    buffers.push(chunk);
  }
  return JSON.parse(Buffer.concat(buffers).toString('utf8'));
}

async function ticketEvidence(id) {
  const folder = await privateFolder(id);
  const ticket = JSON.parse(await fs.readFile(path.join(folder, 'ticket.json'), 'utf8'));
  return {folder, ticket};
}

async function workerReport(id) {
  const {folder, ticket} = await ticketEvidence(id);
  const hasHighlights = await fs.lstat(path.join(folder, 'highlights.mp4'))
    .then(file => file.isFile(), error => {
      if (error.code === 'ENOENT') return false;
      throw error;
    });
  const clips = kinds.flatMap(kind => {
    const attempt = ticket.attempts.findLast(candidate => candidate.kind === kind);
    return (attempt?.steps ?? []).filter(step => step.valid).map(step => step.clip);
  });
  if (hasHighlights) clips.push('highlights.mp4');
  return {html: report(ticket, hasHighlights), clips};
}

async function sendVideo(response, id, name) {
  const {folder, ticket} = await ticketEvidence(id);
  const recorded = ticket.attempts.some(attempt =>
    attempt.steps.some(step => step.valid && step.clip === name));
  if (name !== 'highlights.mp4' && !recorded) {
    response.writeHead(404).end('Unknown private video.');
    return;
  }
  const file = path.join(folder, name);
  const info = await fs.lstat(file);
  if (!info.isFile()) throw Error('Expected a video file.');
  response.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': info.size});
  await pipeline(createReadStream(file), response);
}

export async function runWorker() {
  const {token, port} = settings();
  const authorization = Buffer.from('Bearer ' + token);
  // Keep the transport credential out of runner and game subprocesses.
  delete process.env.CPT_WORKER_TOKEN;
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const supplied = Buffer.from(request.headers.authorization ?? '');
    if (supplied.length !== authorization.length || !timingSafeEqual(supplied, authorization)) {
      response.writeHead(401).end('Worker authentication failed.');
      return;
    }
    try {
      if (request.method === 'POST' && request.url === '/command') {
        let payload;
        try { payload = await readRequest(request); }
        catch {
          response.writeHead(400).end('Invalid worker request.');
          return;
        }
        if (!validCommand(payload?.args) || typeof payload.input !== 'string') {
          response.writeHead(400).end('Invalid worker command.');
          return;
        }
        try {
          const out = await run(process.execPath, [path.join(project, 'pilot.mjs'), '--interactive', ...payload.args],
            payload.input, 220000);
          response.end(out + (out && payload.args[0] !== 'frame' ? '\n' : ''));
        } catch (error) {
          response.writeHead(422).end(error.message);
        }
        return;
      }
      const [, resource, id, name, extra] = request.url.split('/');
      if (request.method === 'GET' && ticketId.test(id ?? '') && extra === undefined) {
        if (resource === 'report' && name === undefined) {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(await workerReport(id)));
          return;
        }
        if (resource === 'video' && videoName.test(name ?? '')) {
          await sendVideo(response, id, name);
          return;
        }
      }
      response.writeHead(404).end('Unknown worker endpoint.');
    } catch (error) {
      if (response.headersSent) response.destroy();
      else if (error.code === 'ENOENT') response.writeHead(404).end('Private ticket or file unavailable.');
      else response.writeHead(500).end('Could not read private ticket evidence on the worker.');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  process.stdout.write('Cyberpunk-Tester worker listening on ' + host + ':' + port + '\n');
}

export async function workerCommand(args, readStdin) {
  const [command, id, option] = args;
  const open = command === 'open' && ticketId.test(id ?? '') &&
    (args.length === 2 || (args.length === 3 && option === '--download'));
  if (!open && !validCommand(args)) {
    throw Error('Unknown command or arguments. See README.md for operator commands.');
  }
  const {token, port} = settings();
  async function request(endpoint, payload) {
    const headers = {Authorization: 'Bearer ' + token};
    let response;
    try {
      response = await fetch('http://' + host + ':' + port + endpoint, {
        headers, redirect: 'error', signal: AbortSignal.timeout(240000),
        ...(payload && {method: 'POST', body: JSON.stringify(payload)})
      });
    } catch {
      throw Error('Could not reach the Windows worker. Check the SSH tunnel and worker, then check ticket status before retrying any action.');
    }
    if (!response.ok) throw Error(await response.text());
    return response;
  }
  if (open) {
    const {html, clips} = await (await request('/report/' + id)).json();
    if (typeof html !== 'string' || !Array.isArray(clips) ||
      !clips.every(clip => typeof clip === 'string' && videoName.test(clip))) {
      throw Error('Invalid report manifest from the worker.');
    }
    const folder = await privateFolder(id);
    await fs.mkdir(folder, {recursive: true});
    const snapshot = await fs.mkdtemp(path.join(folder, 'report-'));
    for (const clip of new Set(clips)) {
      const video = await request('/video/' + id + '/' + clip);
      await pipeline(Readable.fromWeb(video.body), createWriteStream(path.join(snapshot, clip), {flags: 'wx'}));
    }
    const file = path.join(snapshot, 'report.html');
    await fs.writeFile(file, html, {flag: 'wx'});
    if (option !== '--download' && process.platform === 'win32') await win('open', {file});
    process.stdout.write(JSON.stringify({ticket: id, report: path.join(path.basename(snapshot), 'report.html')}, null, 2) + '\n');
    return;
  }
  const input = needsInput.has(command) ? await readStdin() : '';
  const response = await request('/command', {args, input});
  process.stdout.write(await response.text());
}
