exports.up = function (knex) {
  return knex.schema
    .createTable('users', (t) => {
      t.increments('id').primary();
      t.string('username', 50).notNullable().unique();
      t.string('password', 255).notNullable();
      t.string('real_name', 50).notNullable();
      t.enu('role', ['admin', 'operator']).notNullable().defaultTo('operator');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('vehicles', (t) => {
      t.increments('id').primary();
      t.string('plate_number', 20).notNullable().unique();
      t.string('notes', 200).defaultTo('');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('oil_categories', (t) => {
      t.increments('id').primary();
      t.string('name', 50).notNullable().unique();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('stock_in', (t) => {
      t.increments('id').primary();
      t.integer('oil_category_id').unsigned().notNullable().references('id').inTable('oil_categories');
      t.integer('vehicle_id').unsigned().notNullable().references('id').inTable('vehicles');
      t.decimal('price_per_liter', 10, 2).notNullable();
      t.decimal('liters', 10, 2).notNullable();
      t.decimal('total_amount', 12, 2).notNullable();
      t.date('stock_date').notNullable();
      t.integer('operator_id').unsigned().notNullable().references('id').inTable('users');
      t.string('remark', 500).defaultTo('');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('stock_out', (t) => {
      t.increments('id').primary();
      t.integer('vehicle_id').unsigned().notNullable().references('id').inTable('vehicles');
      t.integer('oil_category_id').unsigned().notNullable().references('id').inTable('oil_categories');
      t.string('buyer_name', 100).notNullable();
      t.decimal('unit_price', 10, 2).notNullable();
      t.decimal('liters', 10, 2).notNullable();
      t.decimal('total_amount', 12, 2).notNullable();
      t.date('purchase_date').notNullable();
      t.integer('operator_id').unsigned().notNullable().references('id').inTable('users');
      t.string('remark', 500).defaultTo('');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('stock_out')
    .dropTableIfExists('stock_in')
    .dropTableIfExists('oil_categories')
    .dropTableIfExists('vehicles')
    .dropTableIfExists('users');
};
