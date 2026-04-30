const db = require('../config/db');

async function auditLog(tableName, recordId, action, operatorId, oldData, newData) {
  await db('audit_logs').insert({
    table_name: tableName,
    record_id: recordId,
    action,
    operator_id: operatorId,
    old_data: oldData ? JSON.stringify(oldData) : null,
    new_data: newData ? JSON.stringify(newData) : null,
  });
}

module.exports = { auditLog };
