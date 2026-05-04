exports.up = function (knex) {
  return knex.schema
    // --- 供应商表 ---
    .createTable('suppliers', (t) => {
      t.increments('id').primary();
      t.string('name', 100).notNullable();
      t.string('contact_person', 50).defaultTo('');
      t.string('phone', 20).defaultTo('');
      t.string('address', 200).defaultTo('');
      t.string('notes', 500).defaultTo('');
      t.integer('deletestatus').notNullable().defaultTo(0);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    // --- stock_in 增加 supplier_id ---
    .alterTable('stock_in', (t) => {
      t.integer('supplier_id').unsigned().references('id').inTable('suppliers');
    })
    // --- stock_in 增加 last_modified_by ---
    .alterTable('stock_in', (t) => {
      t.integer('last_modified_by').unsigned().references('id').inTable('users');
    })
    // --- stock_out 增加 last_modified_by ---
    .alterTable('stock_out', (t) => {
      t.integer('last_modified_by').unsigned().references('id').inTable('users');
    })
    // --- users 增加 refresh_token ---
    .alterTable('users', (t) => {
      t.string('refresh_token', 255);
      t.timestamp('refresh_token_expires');
    })
    // --- 索引 ---
    .raw('CREATE INDEX idx_stock_in_date ON stock_in(stock_date)')
    .raw('CREATE INDEX idx_stock_in_vehicle_category ON stock_in(vehicle_id, oil_category_id)')
    .raw('CREATE INDEX idx_stock_out_date ON stock_out(purchase_date)')
    .raw('CREATE INDEX idx_stock_out_customer_date ON stock_out(customer_id, purchase_date)')
    .raw('CREATE INDEX idx_audit_logs_created ON audit_logs(created_at)')
    .raw('CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id)');
};

exports.down = function (knex) {
  return knex.schema
    .raw('DROP INDEX IF EXISTS idx_audit_logs_table_record ON audit_logs')
    .raw('DROP INDEX IF EXISTS idx_audit_logs_created ON audit_logs')
    .raw('DROP INDEX IF EXISTS idx_stock_out_customer_date ON stock_out')
    .raw('DROP INDEX IF EXISTS idx_stock_out_date ON stock_out')
    .raw('DROP INDEX IF EXISTS idx_stock_in_vehicle_category ON stock_in')
    .raw('DROP INDEX IF EXISTS idx_stock_in_date ON stock_in')
    .alterTable('users', (t) => {
      t.dropColumn('refresh_token_expires');
      t.dropColumn('refresh_token');
    })
    .alterTable('stock_out', (t) => {
      t.dropColumn('last_modified_by');
    })
    .alterTable('stock_in', (t) => {
      t.dropColumn('last_modified_by');
      t.dropColumn('supplier_id');
    })
    .dropTableIfExists('suppliers');
};
