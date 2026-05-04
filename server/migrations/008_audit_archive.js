exports.up = function (knex) {
  return knex.schema
    .createTable('audit_logs_archive', (t) => {
      t.increments('id').primary();
      t.string('table_name', 50).notNullable().index();
      t.integer('record_id').unsigned().notNullable();
      t.enu('action', ['create', 'update', 'delete']).notNullable();
      t.text('old_data').nullable();
      t.text('new_data').nullable();
      t.integer('operator_id').unsigned().notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('archived_at').defaultTo(knex.fn.now());
    })
    .table('audit_logs', (t) => {
      t.index('created_at');
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('audit_logs_archive')
    .table('audit_logs', (t) => {
      t.dropIndex('created_at');
    });
};
