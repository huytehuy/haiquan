// Vercel Function: POST /api/interrogate
import { handleInterrogate } from '../lib/interrogate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'bad_request' });
    }
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
  const out = await handleInterrogate(body, ip);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(out.status).json(out.body);
}
