const express = require('express');
const db = require('../config/db');
const { auth, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { keyword } = req.query;
    let query = db('customers').where('deletestatus', 0);
    if (keyword) query = query.where('name', 'like', `%${keyword}%`);
    const list = await query.orderBy('id', 'desc');
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/customers |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/', requirePermission('customers'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { name, phone, bank_name, bank_account } = req.body;
    if (!name) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '请填写客户名称' });
    }
    if (typeof name !== 'string' || name.length > 100) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '客户名称最长100字符' });
    }
    if (phone && typeof phone === 'string' && phone.length > 20) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '电话最长20字符' });
    }
    if (bank_name && typeof bank_name === 'string' && bank_name.length > 100) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '开户银行最长100字符' });
    }
    if (bank_account && typeof bank_account === 'string' && bank_account.length > 50) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '银行账号最长50字符' });
    }

    const existing = await db('customers').transacting(trx).where({ name, deletestatus: 0 }).first();
    if (existing) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '该客户名称已存在' });
    }

    const newCustomer = { name, phone: phone || '', bank_name: bank_name || '', bank_account: bank_account || '' };
    const [id] = await db('customers').transacting(trx).insert(newCustomer);
    await auditLog('customers', id, 'create', req.user.id, null, newCustomer, trx);
    await trx.commit();
    res.json({ code: 0, data: { id } });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] POST /api/customers |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.put('/:id', requirePermission('customers'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const customer = await db('customers').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!customer) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '客户不存在' });
    }

    const { name, phone, bank_name, bank_account } = req.body;
    const update = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > 100) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '客户名称最长100字符' });
      }
      const dup = await db('customers').transacting(trx).where({ name, deletestatus: 0 }).whereNot({ id: req.params.id }).first();
      if (dup) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '该客户名称已存在' });
      }
      update.name = name;
    }
    if (phone !== undefined) {
      if (typeof phone === 'string' && phone.length > 20) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '电话最长20字符' });
      }
      update.phone = phone;
    }
    if (bank_name !== undefined) {
      if (typeof bank_name === 'string' && bank_name.length > 100) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '开户银行最长100字符' });
      }
      update.bank_name = bank_name;
    }
    if (bank_account !== undefined) {
      if (typeof bank_account === 'string' && bank_account.length > 50) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '银行账号最长50字符' });
      }
      update.bank_account = bank_account;
    }
    if (Object.keys(update).length === 0) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '没有要更新的字段' });
    }

    await db('customers').transacting(trx).where({ id: req.params.id }).update(update);
    await auditLog('customers', req.params.id, 'update', req.user.id, customer, { ...customer, ...update }, trx);
    await trx.commit();
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] PUT /api/customers/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.delete('/:id', requirePermission('customers'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const customer = await db('customers').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!customer) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '客户不存在' });
    }

    const hasRecords = await db('stock_out').transacting(trx).where({ customer_id: req.params.id, deletestatus: 0 }).first();
    if (hasRecords) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '该客户有关联的出库记录，无法删除' });
    }

    await db('customers').transacting(trx).where({ id: req.params.id }).update({ deletestatus: 1 });
    await auditLog('customers', req.params.id, 'delete', req.user.id, customer, null, trx);
    await trx.commit();
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] DELETE /api/customers/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
