const db = require('../config/db');

async function auditLog(tableName, recordId, action, operatorId, oldData, newData, trx) {
  const query = trx ? db('audit_logs').transacting(trx) : db('audit_logs');
  await query.insert({
    table_name: tableName,
    record_id: recordId,
    action,
    operator_id: operatorId,
    old_data: oldData ? JSON.stringify(oldData) : null,
    new_data: newData ? JSON.stringify(newData) : null,
  });
}

module.exports = { auditLog };
