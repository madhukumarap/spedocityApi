const mysql = require('mysql2');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'spedocity';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Sahana@12',
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
            CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    mobile_number VARCHAR(15) NOT NULL,
    country_code VARCHAR(5) DEFAULT '+91',
    is_verified TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY unique_mobile (mobile_number),
    KEY idx_mobile_verified (mobile_number, is_verified),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB ROW_FORMAT=COMPRESSED KEY_BLOCK_SIZE=8;
`;
          connection.query(createTableQuery, (err) => {
            connection.release();
            if (err) {
              return reject(err);
            }
            
            console.log('Users table is ready!');
            resolve();
          });
          const createTableotp = `CREATE TABLE IF NOT EXISTS otps (
    otp_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    is_used TINYINT(1) DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (otp_id),
    KEY idx_user_id (user_id),
    KEY idx_expires_at (expires_at),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB;
`;
          connection.query(createTableotp, (err) => {
            connection.release();
            if (err) {
              return reject(err);
            }
            
            console.log('createTableotp table is ready!');
            resolve();
          });
          const createTableOtpArchive = `CREATE TABLE IF NOT EXISTS otps_archive (
    otp_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    is_used TINYINT(1) DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP,
    archive_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (otp_id, archive_date),
    KEY idx_archive_date (archive_date)
) ENGINE=InnoDB;
`;
          connection.query(createTableOtpArchive, (err) => {
            connection.release();
            if (err) {
              return reject(err);
            }
            
            console.log('createTableOtpArchive table is ready!');
            resolve();
          });
          const createTableblacklisted_tokens = `CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    token_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_id),
    KEY idx_token (token(64)),
    KEY idx_expires_at (expires_at)
) ENGINE=InnoDB`;
          connection.query(createTableblacklisted_tokens, (err) => {
            connection.release();
            if (err) {
              return reject(err);
            }
            
            console.log('createTableblacklisted_tokens table is ready!');
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