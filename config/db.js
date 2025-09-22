const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const sqlFilePath = path.join(__dirname, '../sqlscri.sql');
const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'spedocity';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: DB_NAME,
  connectionLimit: process.env.DB_CONNECTION_LIMIT || 20,
  acquireTimeout: 60000,
  timeout: 60000,
  queueLimit: 0,
  waitForConnections: true,
  multipleStatements: true
});

// Initialize database and tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    const adminPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '1234',
      connectionLimit: 1,
      multipleStatements: true
    });

    adminPool.getConnection((err, connection) => {
      if (err) return reject(err);

      // First, create database if not exists
      connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``, (err) => {
        if (err) {
          connection.release();
          return reject(err);
        }

        console.log(`Database '${DB_NAME}' is ready!`);
        
        // Use the database
        connection.query(`USE \`${DB_NAME}\``, (err) => {
          if (err) {
            connection.release();
            return reject(err);
          }

          // Execute the SQL script with multiple statements
          connection.query(sqlScript, (err, results) => {
            connection.release();
            if (err) {
              console.error('SQL execution error:', err.message);
              return reject(err);
            }
            console.log('SQL file executed successfully');
            resolve(results);
          });
        });
      });
    });
  });
};

// Alternative: Execute SQL file without DELIMITER issues
const initDatabaseSafe = () => {
  return new Promise((resolve, reject) => {
    const adminPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '1234',
      connectionLimit: 1,
      multipleStatements: true
    });

    adminPool.getConnection((err, connection) => {
      if (err) return reject(err);

      // Create database and use it
      connection.query(`
        CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
        USE \`${DB_NAME}\`;
      `, (err) => {
        if (err) {
          connection.release();
          return reject(err);
        }

        console.log(`Database '${DB_NAME}' is ready!`);

        // Remove DELIMITER commands and execute as single statement
        const cleanedSql = cleanSqlScript(sqlScript);
        
        connection.query(cleanedSql, (err, results) => {
          connection.release();
          if (err) {
            console.error('SQL execution error:', err.message);
            return reject(err);
          }
          console.log('SQL file executed successfully');
          resolve(results);
        });
      });
    });
  });
};

// Function to clean SQL script by removing DELIMITER commands
const cleanSqlScript = (sql) => {
  // Remove DELIMITER commands and use standard semicolons
  return sql
    .replace(/DELIMITER \$\$/g, '')
    .replace(/DELIMITER ;/g, '')
    .replace(/\$\$/g, ';');
};

// Promisified version for async/await
const promisePool = pool.promise();

module.exports = {
  pool,
  promisePool,
  initDatabase,
  initDatabaseSafe
};