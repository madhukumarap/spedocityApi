const mysql = require('mysql2');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'spedocity';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: DB_NAME, // Specify database here to avoid warnings
  connectionLimit: process.env.DB_CONNECTION_LIMIT || 20,
  acquireTimeout: 60000, // This should be valid for createPool
  timeout: 60000, // This should be valid for createPool
  queueLimit: 0,
  waitForConnections: true
});

// Initialize database and tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // First check if database exists and create if not
    const adminPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '1234',
      connectionLimit: 1
    });
    
    adminPool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting admin connection:', err);
        return reject(err);
      }

      // Create database if it doesn't exist
      connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``, (err) => {
        if (err) {
          connection.release();
          return reject(err);
        }
        
        console.log(`Database '${DB_NAME}' is ready!`);
        connection.release();
        
        // Now use our main pool to create tables
        pool.getConnection((err, connection) => {
          if (err) {
            console.error('Error getting connection:', err);
            return reject(err);
          }
          
          // Create users table if it doesn't exist
          const createTableQuery = `
            CREATE TABLE  IF NOT EXISTS users (
            user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            mobile_number VARCHAR(15) NOT NULL UNIQUE,
            country_code VARCHAR(5) DEFAULT '+91',
            is_verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) `;
          
          connection.query(createTableQuery, (err) => {
            connection.release();
            if (err) {
              return reject(err);
            }
            
            console.log('Users table is ready!');
            resolve();
          });
        });
      });
    });
  });
};

// Promisified version for async/await
const promisePool = pool.promise();

module.exports = {
  pool,
  promisePool,
  initDatabase
};