const express = require('express');
const db = require('../config/db');
const { auth, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const list = await db('oil_categories').where({ deletestatus: 0 }).orderBy('created_at', 'desc');
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/categories |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/', requirePermission('categories'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { name } = req.body;
    if (!name) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '类别名称不能为空' });
    }
    if (typeof name !== 'string' || name.length > 50) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '类别名称最长50字符' });
    }

    const exists = await db('oil_categories').transacting(trx).where({ name, deletestatus: 0 }).first();
    if (exists) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '类别已存在' });
    }

    const [id] = await db('oil_categories').transacting(trx).insert({ name });
    await auditLog('oil_categories', id, 'create', req.user.id, null, { name }, trx);
    await trx.commit();
    res.json({ code: 0, data: { id } });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] POST /api/categories |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.put('/:id', requirePermission('categories'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { name } = req.body;
    if (name === undefined) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '类别名称不能为空' });
    }
    if (typeof name !== 'string' || name.length > 50) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '类别名称最长50字符' });
    }

    const record = await db('oil_categories').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!record) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '类别不存在' });
    }

    const exists = await db('oil_categories').transacting(trx).where({ name, deletestatus: 0 }).whereNot({ id: req.params.id }).first();
    if (exists) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '类别名已存在' });
    }

    await db('oil_categories').transacting(trx).where({ id: req.params.id }).update({ name });
    await auditLog('oil_categories', req.params.id, 'update', req.user.id, record, { ...record, name }, trx);
    await trx.commit();
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] PUT /api/categories/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.delete('/:id', requirePermission('categories'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const record = await db('oil_categories').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!record) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '类别不存在' });
    }

    const hasStock = await db('stock_in').transacting(trx).where({ oil_category_id: req.params.id, deletestatus: 0 }).first()
      || await db('stock_out').transacting(trx).where({ oil_category_id: req.params.id, deletestatus: 0 }).first();
    if (hasStock) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '该类别有关联的出入库记录，无法删除' });
    }

    await db('oil_categories').transacting(trx).where({ id: req.params.id }).update({ deletestatus: 1 });
    await auditLog('oil_categories', req.params.id, 'delete', req.user.id, record, null, trx);
    await trx.commit();
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] DELETE /api/categories/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
