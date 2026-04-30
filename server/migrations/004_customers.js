exports.up = function (knex) {
  return knex.schema
    .createTable('customers', (t) => {
      t.increments('id').primary();
      t.string('name', 100).notNullable().unique();
      t.string('phone', 30).defaultTo('');
      t.string('bank_name', 100).defaultTo('');
      t.string('bank_account', 50).defaultTo('');
      t.tinyint('deletestatus').defaultTo(0);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .alterTable('stock_out', (t) => {
      t.integer('customer_id').unsigned();
    });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('stock_out', (t) => {
      t.dropColumn('customer_id');
    })
    .dropTableIfExists('customers');
};
