const sql = require('mssql');
const path = require('path');
// Load .env located next to this file (node_api/.env) so server can be started from project root
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

// Helpful validation for required vars
if (!config.server || !config.user || !config.database) {
  console.error('Database configuration missing. Please ensure node_api/.env contains DB_SERVER, DB_USER, and DB_DATABASE');
}

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
