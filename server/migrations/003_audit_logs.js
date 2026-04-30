exports.up = function (knex) {
  return knex.schema.createTable('audit_logs', (t) => {
    t.increments('id').primary();
    t.string('table_name', 50).notNullable().index();
    t.integer('record_id').unsigned().notNullable();
    t.enu('action', ['create', 'update', 'delete']).notNullable();
    t.text('old_data').nullable();
    t.text('new_data').nullable();
    t.integer('operator_id').unsigned().notNullable().references('id').inTable('users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('audit_logs');
};
