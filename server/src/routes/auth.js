const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

const VALID_ROLES = ['admin', 'employee', 'customer'];

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, msg: '登录尝试过于频繁，请15分钟后再试' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, msg: '用户名和密码不能为空' });
  }
  if (typeof username !== 'string' || username.length > 100) {
    return res.status(400).json({ code: 400, msg: '用户名格式错误' });
  }
  if (typeof password !== 'string' || password.length < 1 || password.length > 100) {
    return res.status(400).json({ code: 400, msg: '密码格式错误' });
  }
  const user = await db('users').where({ username, deletestatus: 0 }).first();
  if (!user) {
    return res.status(401).json({ code: 401, msg: '用户名或密码错误' });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ code: 401, msg: '用户名或密码错误' });
  }
  let permissions = user.permissions;
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch { permissions = []; }
  }
  if (!Array.isArray(permissions)) permissions = [];
  const token = jwt.sign(
    { id: user.id, username: user.username, real_name: user.real_name, role: user.role, permissions, customer_id: user.customer_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
  res.json({
    code: 0,
    data: {
      token,
      user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role, permissions, customer_id: user.customer_id },
    },
  });
});

router.post('/register', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, msg: '仅管理员可创建用户' });
  }
  const { username, password, real_name, role } = req.body;
  if (!username || !password || !real_name) {
    return res.status(400).json({ code: 400, msg: '请填写完整信息' });
  }
  if (typeof username !== 'string' || username.length > 50) {
    return res.status(400).json({ code: 400, msg: '用户名最长50字符' });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
    return res.status(400).json({ code: 400, msg: '密码长度需在6-100字符之间' });
  }
  if (typeof real_name !== 'string' || real_name.length > 50) {
    return res.status(400).json({ code: 400, msg: '姓名最长50字符' });
  }
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ code: 400, msg: '角色值无效' });
  }
  const exists = await db('users').where({ username, deletestatus: 0 }).first();
  if (exists) {
    return res.status(400).json({ code: 400, msg: '用户名已存在' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const [id] = await db('users').insert({
    username,
    password: hashed,
    real_name,
    role: role || 'employee',
    permissions: JSON.stringify([]),
  });
  res.json({ code: 0, data: { id } });
});

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
