const crypto = require('crypto');

function generateCaptcha() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const answer = a + b;
  const id = crypto.randomBytes(8).toString('hex');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48" viewBox="0 0 120 48">
  <rect width="120" height="48" fill="#f0f2f5" rx="4"/>
  <text x="60" y="32" text-anchor="middle" font-size="22" font-weight="600" fill="#303133" font-family="Arial">${a} + ${b} = ?</text>
</svg>`;
  return { id, svg, answer };
}

// In-memory captcha store with TTL
const store = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes

function saveCaptcha(id, answer) {
  store.set(id, answer);
  setTimeout(() => store.delete(id), TTL);
}

function verifyCaptcha(id, answer) {
  const expected = store.get(id);
  store.delete(id);
  return expected !== undefined && +answer === expected;
}

// Track failed login attempts per IP
const attempts = new Map();
const MAX_ATTEMPTS = 3;
const ATTEMPT_TTL = 15 * 60 * 1000;

function recordFailedAttempt(ip) {
  const entry = attempts.get(ip) || { count: 0, since: Date.now() };
  entry.count++;
  if (Date.now() - entry.since > ATTEMPT_TTL) {
    entry.count = 1;
    entry.since = Date.now();
  }
  attempts.set(ip, entry);
}

function needsCaptcha(ip) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.since > ATTEMPT_TTL) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function clearAttempts(ip) {
  attempts.delete(ip);
}

module.exports = { generateCaptcha, saveCaptcha, verifyCaptcha, recordFailedAttempt, needsCaptcha, clearAttempts };
