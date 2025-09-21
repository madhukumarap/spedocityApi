USE spedocity;

-- Users table (optimized for 1M+ users)
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

-- OTPs table (with partitioning for large data)
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

-- Drop procedures if they exist to avoid errors
DROP PROCEDURE IF EXISTS archive_old_otps;
DROP PROCEDURE IF EXISTS clean_expired_data;

-- Procedure to archive old OTP records
DELIMITER $$
CREATE PROCEDURE archive_old_otps()
BEGIN
    START TRANSACTION;
    
    -- Insert records older than 30 days into archive
    INSERT INTO otps_archive (otp_id, user_id, otp_code, is_used, expires_at, created_at)
    SELECT otp_id, user_id, otp_code, is_used, expires_at, created_at
    FROM otps 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Delete the archived records
    DELETE FROM otps 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    COMMIT;
END$$
DELIMITER ;

-- Drop events if they exist
DROP EVENT IF EXISTS monthly_archive;
DROP EVENT IF EXISTS daily_cleanup;

-- Event to run archiving monthly
CREATE EVENT monthly_archive
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
    CALL archive_old_otps();

-- Blacklisted tokens table (for logout functionality)
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    token_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_id),
    KEY idx_token (token(64)),
    KEY idx_expires_at (expires_at)
) ENGINE=InnoDB;

-- Procedure to clean up expired OTPs and tokens
DELIMITER $$
CREATE PROCEDURE clean_expired_data()
BEGIN
    DELETE FROM otps WHERE expires_at < NOW();
    DELETE FROM blacklisted_tokens WHERE expires_at < NOW();
END$$
DELIMITER ;

-- Event scheduler to run cleanup daily
SET GLOBAL event_scheduler = ON;
CREATE EVENT daily_cleanup
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
    CALL clean_expired_data();

CREATE TABLE karnataka (
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
  KEY idx_user_id (user_id), -- Index for faster lookup
  KEY  idx_district_name (district_name),
  CONSTRAINT fk_karnataka_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;
