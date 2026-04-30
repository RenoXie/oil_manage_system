exports.up = function (knex) {
  return knex.schema
    .table('users', (t) => { t.tinyint('deletestatus').notNullable().defaultTo(0).index(); })
    .table('vehicles', (t) => { t.tinyint('deletestatus').notNullable().defaultTo(0).index(); })
    .table('oil_categories', (t) => { t.tinyint('deletestatus').notNullable().defaultTo(0).index(); })
    .table('stock_in', (t) => { t.tinyint('deletestatus').notNullable().defaultTo(0).index(); })
    .table('stock_out', (t) => { t.tinyint('deletestatus').notNullable().defaultTo(0).index(); });
};

exports.down = function (knex) {
  return knex.schema
    .table('users', (t) => { t.dropColumn('deletestatus'); })
    .table('vehicles', (t) => { t.dropColumn('deletestatus'); })
    .table('oil_categories', (t) => { t.dropColumn('deletestatus'); })
    .table('stock_in', (t) => { t.dropColumn('deletestatus'); })
    .table('stock_out', (t) => { t.dropColumn('deletestatus'); });
};
