const express = require('express');
const db = require('../config/db');
const { auth, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { keyword } = req.query;
    let query = db('suppliers').where('deletestatus', 0);
    if (keyword) query = query.where('name', 'like', `%${keyword}%`);
    const list = await query.orderBy('id', 'desc');
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/suppliers |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/', requirePermission('suppliers'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { name, contact_person, phone, address, notes } = req.body;
    if (!name) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '请填写供应商名称' });
    }
    if (typeof name !== 'string' || name.length > 100) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '供应商名称最长100字符' });
    }
    if (contact_person && typeof contact_person === 'string' && contact_person.length > 50) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '联系人最长50字符' });
    }
    if (phone && typeof phone === 'string' && phone.length > 20) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '电话最长20字符' });
    }
    if (address && typeof address === 'string' && address.length > 200) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '地址最长200字符' });
    }
    if (notes && typeof notes === 'string' && notes.length > 500) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '备注最长500字符' });
    }

    const existing = await db('suppliers').transacting(trx).where({ name, deletestatus: 0 }).first();
    if (existing) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '该供应商名称已存在' });
    }

    const newSupplier = { name, contact_person: contact_person || '', phone: phone || '', address: address || '', notes: notes || '' };
    const [id] = await db('suppliers').transacting(trx).insert(newSupplier);
    await auditLog('suppliers', id, 'create', req.user.id, null, newSupplier, trx);
    await trx.commit();
    res.json({ code: 0, data: { id } });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] POST /api/suppliers |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.put('/:id', requirePermission('suppliers'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const supplier = await db('suppliers').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!supplier) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '供应商不存在' });
    }

    const { name, contact_person, phone, address, notes } = req.body;
    const update = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > 100) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '供应商名称最长100字符' });
      }
      const dup = await db('suppliers').transacting(trx).where({ name, deletestatus: 0 }).whereNot({ id: req.params.id }).first();
      if (dup) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '该供应商名称已存在' });
      }
      update.name = name;
    }
    if (contact_person !== undefined) {
      if (typeof contact_person === 'string' && contact_person.length > 50) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '联系人最长50字符' });
      }
      update.contact_person = contact_person;
    }
    if (phone !== undefined) {
      if (typeof phone === 'string' && phone.length > 20) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '电话最长20字符' });
      }
      update.phone = phone;
    }
    if (address !== undefined) {
      if (typeof address === 'string' && address.length > 200) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '地址最长200字符' });
      }
      update.address = address;
    }
    if (notes !== undefined) {
      if (typeof notes === 'string' && notes.length > 500) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '备注最长500字符' });
      }
      update.notes = notes;
    }
    if (Object.keys(update).length === 0) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '没有要更新的字段' });
    }

    await db('suppliers').transacting(trx).where({ id: req.params.id }).update(update);
    await auditLog('suppliers', req.params.id, 'update', req.user.id, supplier, { ...supplier, ...update }, trx);
    await trx.commit();
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] PUT /api/suppliers/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.delete('/:id', requirePermission('suppliers'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const supplier = await db('suppliers').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!supplier) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '供应商不存在' });
    }

    const hasRecords = await db('stock_in').transacting(trx).where({ supplier_id: req.params.id, deletestatus: 0 }).first();
    if (hasRecords) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '该供应商有关联的入库记录，无法删除' });
    }

    await db('suppliers').transacting(trx).where({ id: req.params.id }).update({ deletestatus: 1 });
    await auditLog('suppliers', req.params.id, 'delete', req.user.id, supplier, null, trx);
    await trx.commit();
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] DELETE /api/suppliers/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
