// Vercel Function: GET /api/status
import { statusPayload } from '../lib/interrogate.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(statusPayload());
}
