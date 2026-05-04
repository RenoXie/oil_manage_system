const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const { generateCaptcha, saveCaptcha, verifyCaptcha, recordFailedAttempt, needsCaptcha, clearAttempts } = require('../utils/captcha');

const router = express.Router();

const VALID_ROLES = ['admin', 'employee', 'customer'];

const ACCESS_TOKEN_EXPIRES = '30m';
const REFRESH_TOKEN_EXPIRES_DAYS = 7;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, msg: '登录尝试过于频繁，请15分钟后再试' },
});

function signAccessToken(user) {
  let permissions = user.permissions;
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch { permissions = []; }
  }
  if (!Array.isArray(permissions)) permissions = [];
  return jwt.sign(
    { id: user.id, username: user.username, real_name: user.real_name, role: user.role, permissions, customer_id: user.customer_id },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

// GET /api/auth/captcha
router.get('/captcha', (_req, res) => {
  const captcha = generateCaptcha();
  saveCaptcha(captcha.id, captcha.answer);
  res.json({ code: 0, data: { id: captcha.id, svg: captcha.svg } });
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password, captcha_id, captcha_answer } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, msg: '用户名和密码不能为空' });
  }
  if (typeof username !== 'string' || username.length > 100) {
    return res.status(400).json({ code: 400, msg: '用户名格式错误' });
  }
  if (typeof password !== 'string' || password.length < 1 || password.length > 100) {
    return res.status(400).json({ code: 400, msg: '密码格式错误' });
  }

  const ip = req.ip;
  if (needsCaptcha(ip)) {
    if (!captcha_id || captcha_answer === undefined) {
      return res.status(400).json({ code: 400, msg: '登录失败次数过多，请输入验证码', needCaptcha: true });
    }
    if (!verifyCaptcha(captcha_id, captcha_answer)) {
      return res.status(400).json({ code: 400, msg: '验证码错误', needCaptcha: true });
    }
  }

  const user = await db('users').where({ username, deletestatus: 0 }).first();
  if (!user) {
    recordFailedAttempt(ip);
    return res.status(401).json({ code: 401, msg: '用户名或密码错误' });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    recordFailedAttempt(ip);
    return res.status(401).json({ code: 401, msg: '用户名或密码错误' });
  }

  clearAttempts(ip);

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await db('users').where({ id: user.id }).update({
    refresh_token: refreshHash,
    refresh_token_expires: expiresAt,
  });

  let permissions = user.permissions;
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch { permissions = []; }
  }
  if (!Array.isArray(permissions)) permissions = [];

  res.json({
    code: 0,
    data: {
      token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role, permissions, customer_id: user.customer_id },
    },
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ code: 400, msg: '缺少 refresh_token' });
  }

  // Try decoding the access token to find user id (allow expired)
  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET, { ignoreExpiration: true });
      userId = decoded.id;
    } catch { /* token is malformed, will try another approach */ }
  }

  if (!userId) {
    return res.status(401).json({ code: 401, msg: '无法识别用户，请重新登录' });
  }

  const user = await db('users').where({ id: userId, deletestatus: 0 }).first();
  if (!user || !user.refresh_token) {
    return res.status(401).json({ code: 401, msg: 'refresh_token 无效，请重新登录' });
  }

  if (user.refresh_token_expires && new Date(user.refresh_token_expires) < new Date()) {
    await db('users').where({ id: userId }).update({ refresh_token: null, refresh_token_expires: null });
    return res.status(401).json({ code: 401, msg: 'refresh_token 已过期，请重新登录' });
  }

  const valid = await bcrypt.compare(refresh_token, user.refresh_token);
  if (!valid) {
    return res.status(401).json({ code: 401, msg: 'refresh_token 无效，请重新登录' });
  }

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = generateRefreshToken();
  const newRefreshHash = await bcrypt.hash(newRefreshToken, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await db('users').where({ id: userId }).update({
    refresh_token: newRefreshHash,
    refresh_token_expires: expiresAt,
  });

  res.json({ code: 0, data: { token: newAccessToken, refresh_token: newRefreshToken } });
});

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  await db('users').where({ id: req.user.id }).update({ refresh_token: null, refresh_token_expires: null });
  res.json({ code: 0, msg: '已退出登录' });
});

// POST /api/auth/register
router.post('/register', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, msg: '仅管理员可创建用户' });
  }
  const trx = await db.transaction();
  try {
    const { username, password, real_name, role } = req.body;
    if (!username || !password || !real_name) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '请填写完整信息' });
    }
    if (typeof username !== 'string' || username.length > 50) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '用户名最长50字符' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '密码长度需在6-100字符之间' });
    }
    if (typeof real_name !== 'string' || real_name.length > 50) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '姓名最长50字符' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '角色值无效' });
    }
    const exists = await db('users').transacting(trx).where({ username, deletestatus: 0 }).first();
    if (exists) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '用户名已存在' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const finalRole = role || 'employee';
    const [id] = await db('users').transacting(trx).insert({
      username,
      password: hashed,
      real_name,
      role: finalRole,
      permissions: JSON.stringify([]),
    });
    await auditLog('users', id, 'create', req.user.id, null, { username, real_name, role: finalRole }, trx);
    await trx.commit();
    res.json({ code: 0, data: { id } });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] POST /api/auth/register |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  const user = await db('users').select('id', 'username', 'real_name', 'role', 'permissions', 'customer_id').where({ id: req.user.id, deletestatus: 0 }).first();
  if (user?.permissions) {
    if (typeof user.permissions === 'string') {
      try { user.permissions = JSON.parse(user.permissions); } catch { user.permissions = []; }
    }
    if (!Array.isArray(user.permissions)) user.permissions = [];
  }
  res.json({ code: 0, data: user });
});

module.exports = router;
