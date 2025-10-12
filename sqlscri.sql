-- Create database and use it
CREATE DATABASE IF NOT EXISTS spedocity;
USE spedocity;

-- Users table
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
) ENGINE=InnoDB;

-- OTPs table
CREATE TABLE IF NOT EXISTS otps (
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

-- Archive table for old OTP records
CREATE TABLE IF NOT EXISTS otps_archive (
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

-- Blacklisted tokens table
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    token_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_id),
    KEY idx_token (token(64)),
    KEY idx_expires_at (expires_at)
) ENGINE=InnoDB;

-- Karnataka table
CREATE TABLE IF NOT EXISTS karnataka (
  karnataka_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  district_name VARCHAR(100) NOT NULL,
  taluk_name VARCHAR(100),
  hobai_name  VARCHAR(100),
  pin_code BIGINT UNSIGNED NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (karnataka_id),
  KEY idx_user_id (user_id),
  KEY idx_district_name (district_name),
  CONSTRAINT fk_karnataka_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Drop procedures if they exist
DROP PROCEDURE IF EXISTS archive_old_otps;
DROP PROCEDURE IF EXISTS clean_expired_data;

-- Procedure to archive old OTP records (simplified without DELIMITER)
CREATE PROCEDURE archive_old_otps()
BEGIN
    START TRANSACTION;
    INSERT INTO otps_archive (otp_id, user_id, otp_code, is_used, expires_at, created_at)
    SELECT otp_id, user_id, otp_code, is_used, expires_at, created_at
    FROM otps 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    DELETE FROM otps 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    COMMIT;
END;

-- Procedure to clean up expired OTPs and tokens
CREATE PROCEDURE clean_expired_data()
BEGIN
    DELETE FROM otps WHERE expires_at < NOW();
    DELETE FROM blacklisted_tokens WHERE expires_at < NOW();
END;

-- Drop events if they exist
DROP EVENT IF EXISTS monthly_archive;
DROP EVENT IF EXISTS daily_cleanup;

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;

-- Event to run archiving monthly
CREATE EVENT monthly_archive
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
    CALL archive_old_otps();

-- Event to run cleanup daily
CREATE EVENT daily_cleanup
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
    CALL clean_expired_data();
CREATE TABLE IF NOT EXISTS user_info (
    info_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(150),
    email VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (info_id),
    KEY idx_user_id (user_id),
    CONSTRAINT fk_user_info_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
)ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_address (
    id INT AUTO_INCREMENT ,
    user_id BIGINT UNSIGNED NOT NULL,
    langitude VARCHAR(100),
    latitude VARCHAR(100),
    user_address VARCHAR (2000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    CONSTRAINT fk_user_address_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
)ENGINE=InnoDB;
