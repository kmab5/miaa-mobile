/** Local-only static preview server used by browser checks. */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { appDirectory, appRole } from './shared.mjs';
const role = appRole(process.argv[2]);
const port = Number(process.argv[3] || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Choose a port between 1024 and 65535.');
const directory = resolve(appDirectory(role), process.env.MIAA_PREVIEW_DIRECTORY || 'dist');
if (!existsSync(join(directory, 'index.html'))) throw new Error('Export this app for web first.');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};
const server = http.createServer((request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(directory, '.' + pathname);
    if (file !== directory && !file.startsWith(directory + sep)) {
      response.writeHead(404).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
    if (!existsSync(file) && !extname(pathname)) file = join(directory, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(400).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Preview ${role}: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
