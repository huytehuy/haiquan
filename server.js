// Server local tối giản (không cần npm install): phục vụ file tĩnh + API hỏi vặn.
// Trên Vercel, file tĩnh lấy từ public/ và API chạy ở api/*.js — file này không được dùng.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiConfig, statusPayload, handleInterrogate } from './lib/interrogate.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

// Nạp .env thủ công
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* không có .env */
}

const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function readBody(req, limit = 16_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const json = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/status') return json(res, 200, statusPayload());

  if (url.pathname === '/api/interrogate') {
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { error: 'bad_request' });
    }
    const out = await handleInterrogate(body, req.socket.remoteAddress);
    return json(res, out.status, out.body);
  }

  // File tĩnh
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC + path.sep) && file !== PUBLIC) return json(res, 403, { error: 'forbidden' });
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Không tìm thấy');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const { apiKey, model } = aiConfig();
  console.log(`🛂 Trạm kiểm soát Neo-Saigon đang mở tại http://localhost:${PORT}`);
  console.log(apiKey ? `   AI: Groq (${model})` : '   AI: chưa có GROQ_API_KEY → chạy chế độ kịch bản offline');
});
