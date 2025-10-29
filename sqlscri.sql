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

CREATE TABLE IF NOT EXISTS vehicle (
    vehicle_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    vehicle_type VARCHAR(100) NOT NULL,
    no_of_tyres INT NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    per_km_price DECIMAL(10,2) NOT NULL,
    image_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (vehicle_id)
)ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS  order_table(
    order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NOT NULL,
    pickup_address VARCHAR(2000) NOT NULL,
    drop_address VARCHAR(2000) NOT NULL,
    distance_km DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    order_status VARCHAR(100) NOT NULL,
    scheduled_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (order_id),
    KEY idx_user_id (user_id),
    KEY idx_vehicle_id (vehicle_id),
    CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_order_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
)ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS drivers (
    driver_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    driver_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    vehicle_id BIGINT UNSIGNED NOT NULL,
    current_lat DECIMAL(10,6) NOT NULL,
    current_lng DECIMAL(10,6) NOT NULL,
    availability_status ENUM('available', 'busy') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (driver_id),
    CONSTRAINT fk_driver_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE ON UPDATE CASCADE
)ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_assignment (
    assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    driver_id BIGINT UNSIGNED NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (assignment_id),
    CONSTRAINT fk_assignment_order FOREIGN KEY (order_id) REFERENCES order_table(order_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_assignment_driver FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
        ON DELETE CASCADE ON UPDATE CASCADE
)ENGINE=InnoDB;
DELIMITER $$

CREATE PROCEDURE assign_driver_to_order(IN p_order_id BIGINT)
BEGIN
    DECLARE v_vehicle_type VARCHAR(100);
    DECLARE v_pickup_lat DECIMAL(10,6);
    DECLARE v_pickup_lng DECIMAL(10,6);
    DECLARE v_driver_id BIGINT;

    -- Assume pickup_address contains coordinates (for example: "lat,lng")
    -- You can adjust this to use a proper geocoding approach
    -- Example pickup_address: "17.3850,78.4867 Hyderabad"
    
    -- Extract vehicle type from the order
    SELECT v.vehicle_type
    INTO v_vehicle_type
    FROM order_table o
    JOIN vehicle v ON o.vehicle_id = v.vehicle_id
    WHERE o.order_id = p_order_id;

    -- Get pickup coordinates (assuming you already store them in a location table or directly in order_table)
    SELECT pickup_lat, pickup_lng
    INTO v_pickup_lat, v_pickup_lng
    FROM order_table
    WHERE order_id = p_order_id;

    -- Find nearest available driver with same vehicle type
    SELECT d.driver_id
    INTO v_driver_id
    FROM drivers d
    JOIN vehicle v ON d.vehicle_id = v.vehicle_id
    WHERE v.vehicle_type = v_vehicle_type
      AND d.availability_status = 'available'
    ORDER BY
      (POW(d.current_lat - v_pickup_lat, 2) + POW(d.current_lng - v_pickup_lng, 2)) ASC
    LIMIT 1;

    -- Assign driver if found
    IF v_driver_id IS NOT NULL THEN
        -- Insert record into order_assignment
        INSERT INTO order_assignment (order_id, driver_id)
        VALUES (p_order_id, v_driver_id);

        -- Update driver status to busy
        UPDATE drivers
        SET availability_status = 'busy'
        WHERE driver_id = v_driver_id;

        -- Optionally, update order status
        UPDATE order_table
        SET order_status = 'Assigned'
        WHERE order_id = p_order_id;
    ELSE
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No available driver found for this vehicle type';
    END IF;
END$$

DELIMITER ;
-- CALL assign_driver_to_order(101);
