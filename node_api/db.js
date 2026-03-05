const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,
    enableArithAbort: true
  }
};

const poolPromise = new sql.ConnectionPool(config).connect().then(pool => {
  console.log('Connected to MSSQL');
  return pool;
}).catch(err => {
  console.error('Database Connection Failed! Bad Config: ', err);
  throw err;
});

module.exports = {
  sql, poolPromise
};
