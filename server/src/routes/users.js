const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();

router.use(auth);

const VALID_ROLES = ['admin', 'employee', 'customer'];
const VALID_PERMISSIONS = [
  'dashboard', 'stock-in', 'stock-out', 'stock-all',
  'inventory', 'statistics', 'vehicles', 'categories', 'customers', 'users',
];
const MIN_PASSWORD_LENGTH = 6;

function validatePermissions(perms) {
  if (!Array.isArray(perms)) return [];
  return perms.filter(p => VALID_PERMISSIONS.includes(p));
}

router.get('/', adminOnly, async (req, res) => {
  try {
    const users = await db('users').select('id', 'username', 'real_name', 'role', 'permissions', 'customer_id', 'created_at').where({ deletestatus: 0 });
    const data = users.map((u) => {
      if (u.permissions) {
        if (typeof u.permissions === 'string') {
          try { u.permissions = JSON.parse(u.permissions); } catch { u.permissions = []; }
        }
        if (!Array.isArray(u.permissions)) u.permissions = [];
      }
      return u;
    });
    res.json({ code: 0, data });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/users |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const trx = await db.transaction();
  try {
    const { username, password, real_name, role, permissions, customer_id } = req.body;
    if (!username || !password || !real_name) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '请填写完整信息' });
    }
    if (typeof username !== 'string' || username.length > 50) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '用户名最长50字符' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 100) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: `密码长度需在${MIN_PASSWORD_LENGTH}-100字符之间` });
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
    const finalPermissions = JSON.stringify(validatePermissions(permissions));
    const [id] = await db('users').transacting(trx).insert({
      username, password: hashed, real_name,
      role: finalRole,
      permissions: finalPermissions,
      customer_id: customer_id || null,
    });
    // 审计数据排除密码字段
    await auditLog('users', id, 'create', req.user.id, null, { username, real_name, role: finalRole, permissions: finalPermissions, customer_id }, trx);
    await trx.commit();
    res.json({ code: 0, data: { id } });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] POST /api/users |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const trx = await db.transaction();
  try {
    const user = await db('users').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!user) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }

    const { real_name, role, password, permissions, customer_id } = req.body;
    const update = {};
    const auditNew = { username: user.username };
    if (real_name !== undefined) {
      if (typeof real_name !== 'string' || real_name.length > 50) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '姓名最长50字符' });
      }
      update.real_name = real_name;
      auditNew.real_name = real_name;
    }
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '角色值无效' });
      }
      update.role = role;
      auditNew.role = role;
    }
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 100) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: `密码长度需在${MIN_PASSWORD_LENGTH}-100字符之间` });
      }
      update.password = await bcrypt.hash(password, 10);
      auditNew.password_changed = true;
    }
    if (permissions !== undefined) {
      update.permissions = JSON.stringify(validatePermissions(permissions));
      auditNew.permissions = update.permissions;
    }
    if (customer_id !== undefined) {
      update.customer_id = customer_id || null;
      auditNew.customer_id = update.customer_id;
    }
    if (Object.keys(update).length === 0) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '没有要更新的字段' });
    }
    update.updated_at = db.fn.now();
    await db('users').transacting(trx).where({ id: req.params.id }).update(update);
    // 审计数据只记录非密码字段，旧数据也排除密码
    const auditOld = { id: user.id, username: user.username, real_name: user.real_name, role: user.role, permissions: user.permissions, customer_id: user.customer_id };
    await auditLog('users', req.params.id, 'update', req.user.id, auditOld, { ...auditOld, ...auditNew }, trx);
    await trx.commit();
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] PUT /api/users/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  const trx = await db.transaction();
  try {
    if (+req.params.id === req.user.id) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '不能删除自己' });
    }
    const user = await db('users').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!user) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }

    await db('users').transacting(trx).where({ id: req.params.id }).update({ deletestatus: 1 });
    await auditLog('users', req.params.id, 'delete', req.user.id, { id: user.id, username: user.username, real_name: user.real_name, role: user.role }, null, trx);
    await trx.commit();
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] DELETE /api/users/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
