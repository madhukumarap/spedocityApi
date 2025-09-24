const { promisePool } = require('../../config/db');
const auth = require('../../middleware/authMiddleware');
const twilio = require('twilio');
require('dotenv').config();

// Initialize logger
const logger = require('../../utils/logger'); // Adjust path as needed

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const OTP_EXPIRY_MINUTES = 5;

// In-memory store for OTP sessions (use Redis in production)
const otpSessions = new Map();

// Log application startup
logger.info('Authentication service starting up', { 
  environment: process.env.NODE_ENV,
  nodeVersion: process.version 
});

// Clean up expired sessions every hour
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  for (const [sessionId, session] of otpSessions.entries()) {
    if (session.expiresAt < now) {
      otpSessions.delete(sessionId);
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    logger.info('Cleaned up expired OTP sessions', { count: expiredCount });
  }
}, 60 * 60 * 1000); // Cleanup every hour

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate session ID
const generateSessionId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const authentication = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  try {
    const { number, } = req.body;

    logger.info('Authentication request received', { 
      requestId, 
      mobileNumber: number 
    });
    
    if (!number) {
      logger.warn('Missing mobile number in request', { requestId });
      return res.status(400).json({ message: "Mobile number is required" });
    }

    // Validate mobile number format (basic validation)
    const mobileRegex = /^[+]?[1-9][\d]{0,15}$/;
    if (!mobileRegex.test(number)) {
      logger.warn('Invalid mobile number format', { 
        requestId, 
        mobileNumber: number 
      });
      return res.status(400).json({ message: "Invalid mobile number format" });
    }

    // Check if user exists with this number
    const [users] = await promisePool.execute(
      'SELECT * FROM users WHERE mobile_number = ?',
      [number]
    );
    let userId;
    if (users.length === 0) {
      // Create new user with mobile number
      logger.info('Creating new user', { requestId, mobileNumber: number });
      
      const [result] = await promisePool.execute(
        'INSERT INTO users (mobile_number) VALUES (?)',
        [number]
      );
      userId = result.insertId;
      logger.info('New user created', { 
        requestId, 
        userId, 
        mobileNumber: number 
      });
    } else {
      userId = users[0].user_id;
      logger.info('Existing user found', { 
        requestId, 
        userId, 
        mobileNumber: number 
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    // Store OTP in database
    await promisePool.execute(
      'INSERT INTO otps (user_id, otp_code, expires_at) VALUES (?, ?, ?)',
      [userId, otp, expiresAt]
    );

    logger.info('OTP stored in database', { 
      requestId, 
      userId, 
      otp: '***' // Don't log actual OTP in production
    });

    // Create session and store mobile number
    const sessionId = generateSessionId();
    const sessionExpiresAt = Date.now() + (OTP_EXPIRY_MINUTES + 5) * 60 * 1000; // 5 minutes extra for verification
    
    otpSessions.set(sessionId, {
      userId,
      mobileNumber: number,
      expiresAt: sessionExpiresAt
    });

    logger.info('OTP session created', { 
      requestId, 
      sessionId, 
      userId, 
      expiresAt: new Date(sessionExpiresAt).toISOString() 
    });

    // Send OTP via Twilio
    try {
      await twilioClient.messages.create({
        body: `Your Spedocity verification code is: ${otp}. This code will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: number
      });

      logger.info('OTP sent successfully via Twilio', { 
        requestId, 
        userId, 
        sessionId 
      });

      res.status(200).json({
        message: "OTP sent successfully",
        sessionId: sessionId,
        expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
      });
    } catch (twilioError) {
      logger.error('Twilio SMS delivery failed', { 
        requestId, 
        error: twilioError.message,
        userId 
      });
      
      // Clean up session if Twilio fails
      otpSessions.delete(sessionId);
      
      // Still return success but indicate SMS might not have been delivered
      res.status(200).json({
        message: "OTP generated successfully",
        sessionId: sessionId,
        otp: otp, // Only for development/testing - remove in production
        expiresIn: `${OTP_EXPIRY_MINUTES} minutes`,
        note: "SMS delivery might have failed - check Twilio configuration"
      });
    }

  } catch (error) {
    logger.error('Authentication process failed', { 
      requestId, 
      error: error.message,
      stack: error.stack 
    });
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: "User already exists" });
    }
    
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    const duration = Date.now() - startTime;
    logger.info('Authentication request processed', { 
      requestId, 
      durationMs: duration 
    });
  }
};

const verifyOTP = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  try {
    const { sessionId, otp } = req.body;
    
    logger.info('OTP verification request received', { 
      requestId, 
      sessionId 
    });
    
    if (!sessionId || !otp) {
      logger.warn('Missing sessionId or OTP in verification request', { requestId });
      return res.status(400).json({ 
        success: false,
        message: "Session ID and OTP are required" 
      });
    }

    // Get session data
    const session = otpSessions.get(sessionId);
    
    if (!session) {
      logger.warn('Invalid session ID provided', { requestId, sessionId });
      return res.status(404).json({ 
        success: false,
        message: "Invalid or expired session" 
      });
    }

    // Check if session expired
    if (session.expiresAt < Date.now()) {
      otpSessions.delete(sessionId);
      logger.warn('Expired session ID provided', { requestId, sessionId });
      return res.status(401).json({ 
        success: false,
        message: "Session expired. Please request a new OTP." 
      });
    }

    const { userId, mobileNumber, countryCode } = session;

    // Find valid OTP for this user
    const [otps] = await promisePool.execute(
      `SELECT * FROM otps 
       WHERE user_id = ? AND otp_code = ? AND is_used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, otp]
    );

    if (otps.length === 0) {
      logger.warn('Invalid OTP provided', { 
        requestId, 
        userId, 
        sessionId 
      });
      return res.status(401).json({ 
        success: false,
        message: "Invalid or expired OTP" 
      });
    }

    const otpRecord = otps[0];

    // Mark OTP as used
    await promisePool.execute(
      'UPDATE otps SET is_used = 1 WHERE otp_id = ?',
      [otpRecord.otp_id]
    );

    logger.info('OTP marked as used', { 
      requestId, 
      userId, 
      otpId: otpRecord.otp_id 
    });

    // Update user verification status
    await promisePool.execute(
      'UPDATE users SET is_verified = 1 WHERE user_id = ?',
      [userId]
    );

    // Generate JWT token
    const token = auth.createToken({ 
      id: userId, 
      mobile_number: mobileNumber 
    });

    // Clear the session after successful verification
    otpSessions.delete(sessionId);

    logger.info('OTP verified successfully', { 
      requestId, 
      userId, 
      sessionId 
    });

    // STANDARDIZED RESPONSE FORMAT
    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {
        token: token,
        user_id: userId,
        mobile_number: mobileNumber,
        country_code: countryCode || '+91',
        is_verified: true
      }
    });

  } catch (error) {
    logger.error('OTP verification process failed', { 
      requestId, 
      error: error.message,
      stack: error.stack 
    });
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  } finally {
    const duration = Date.now() - startTime;
    logger.info('OTP verification request processed', { 
      requestId, 
      durationMs: duration 
    });
  }
};

// Optional: Endpoint to resend OTP using existing session
const resendOTP = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  try {
    const { sessionId } = req.body;
    
    logger.info('Resend OTP request received', { 
      requestId, 
      sessionId 
    });
    
    if (!sessionId) {
      logger.warn('Missing sessionId in resend request', { requestId });
      return res.status(400).json({ message: "Session ID is required" });
    }

    // Get session data
    const session = otpSessions.get(sessionId);
    
    if (!session) {
      logger.warn('Invalid session ID provided for resend', { requestId, sessionId });
      return res.status(404).json({ message: "Invalid or expired session" });
    }

    // Check if session expired
    if (session.expiresAt < Date.now()) {
      otpSessions.delete(sessionId);
      logger.warn('Expired session ID provided for resend', { requestId, sessionId });
      return res.status(401).json({ message: "Session expired. Please request a new OTP." });
    }

    const { userId, mobileNumber } = session;

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store new OTP in database
    await promisePool.execute(
      'INSERT INTO otps (user_id, otp_code, expires_at) VALUES (?, ?, ?)',
      [userId, otp, expiresAt]
    );

    logger.info('New OTP stored for resend', { 
      requestId, 
      userId, 
      sessionId 
    });

    // Send new OTP via Twilio
    try {
      await twilioClient.messages.create({
        body: `Your new Spedocity verification code is: ${otp}. This code will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: mobileNumber
      });

      logger.info('Resent OTP sent successfully via Twilio', { 
        requestId, 
        userId, 
        sessionId 
      });

      res.status(200).json({
        message: "New OTP sent successfully",
        expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
      });
    } catch (twilioError) {
      logger.error('Twilio SMS delivery failed for resent OTP', { 
        requestId, 
        error: twilioError.message,
        userId 
      });
      
      res.status(200).json({
        message: "New OTP generated successfully",
        otp: otp, // Only for development/testing - remove in production
        expiresIn: `${OTP_EXPIRY_MINUTES} minutes`,
        note: "SMS delivery might have failed - check Twilio configuration"
      });
    }

  } catch (error) {
    logger.error('Resend OTP process failed', { 
      requestId, 
      error: error.message,
      stack: error.stack 
    });
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    const duration = Date.now() - startTime;
    logger.info('Resend OTP request processed', { 
      requestId, 
      durationMs: duration 
    });
  }
};

const logout = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '') || 
                  req.headers['x-access-token'];
    
    logger.info('Logout request received', { requestId });
    
    if (token) {
      auth.invalidateToken(token);
      logger.info('Token invalidated', { requestId });
    }
    
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    logger.error('Logout process failed', { 
      requestId, 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ message: "Internal server error" });
  } finally {
    const duration = Date.now() - startTime;
    logger.info('Logout request processed', { 
      requestId, 
      durationMs: duration 
    });
  }
};
const updateProfile = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  try {
    const { name, email, dateOfBirth, gender, userId } = req.body;

    // Validate required fields
    if (!userId) {
      logger.warn('User ID is required', { requestId });
      return res.status(400).json({ message: "User ID is required" });
    }

    // Validate that at least one field is provided for update
    if (!name && !email && !dateOfBirth && !gender) {
      logger.warn('No profile data provided for update', { requestId, userId });
      return res.status(400).json({ message: "At least one profile field is required" });
    }

    // Check if profile exists
    const findQuery = `SELECT * FROM user_info WHERE user_id = ?`;
    const [existingProfiles] = await promisePool.execute(findQuery, [userId]);
    
    // Use proper MySQL datetime format
    const currentTime = new Date();
    const formattedDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

    if (existingProfiles.length > 0) {
      // Update existing profile
      logger.info('Updating existing profile', { requestId, userId });
      
      // Build dynamic update query based on provided fields
      const updateFields = [];
      const updateValues = [];
      
      if (name) {
        updateFields.push('full_name = ?');
        updateValues.push(name);
      }
      if (email) {
        updateFields.push('email = ?');
        updateValues.push(email);
      }
      if (dateOfBirth) {
        updateFields.push('date_of_birth = ?');
        updateValues.push(formattedDateOfBirth);
      }
      if (gender) {
        updateFields.push('gender = ?');
        updateValues.push(gender);
      }
      
      // Always update the updated_at timestamp
      updateFields.push('updated_at = ?');
      updateValues.push(currentTime);
      
      // Add userId for WHERE clause
      updateValues.push(userId);
      
      const updateSql = `UPDATE user_info SET ${updateFields.join(', ')} WHERE user_id = ?`;
      
      const [result] = await promisePool.execute(updateSql, updateValues);
      
      if (result.affectedRows === 1) {
        logger.info('Profile updated successfully', { requestId, userId });
        return res.status(200).json({ success:true, message: "Profile updated successfully" });
      } else {
        logger.warn('Profile update failed - no rows affected', { requestId, userId });
        return res.status(400).json({ message: "Profile update failed" });
      }
    } else {
      // Create new profile - validate that all required fields are present for new profile
      if (!name) {
        logger.warn('Name is required for new profile', { requestId, userId });
        return res.status(400).json({ message: "Name is required for new profile" });
      }

      logger.info('Creating new profile', { requestId, userId });
      
      const insertSql = `INSERT INTO user_info (user_id, full_name, email, date_of_birth, gender, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;
      
      const values = [userId, name, email, formattedDateOfBirth, gender, currentTime, currentTime];
      
      const [result] = await promisePool.execute(insertSql, values);
      
      if (result.affectedRows === 1) {
        logger.info('Profile created successfully', { requestId, userId });
        return res.status(200).json({success:true, message: "Profile created successfully" });
      } else {
        logger.warn('Profile creation failed', { requestId, userId });
        return res.status(400).json({ message: "Profile creation failed" });
      }
    }
  } catch (error) {
    logger.error('Update profile process failed', { 
      service: "spedocity-api",
      requestId, 
      error: error.message, 
      stack: error.stack
    });
    
    // Handle specific MySQL errors
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ message: "Database configuration error - table not found" });
    } else if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: "Profile already exists for this user" });
    } else if (error.code === 'ER_TRUNCATED_WRONG_VALUE') {
      return res.status(400).json({ message: "Invalid date format" });
    } else if (error.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ message: "Data too long for one or more fields" });
    }
    
    return res.status(500).json({ message: "Internal server error" });
  }  
};
const getUserInfo = async (req, res) => {
  try {
    const userId = req.query.userId;
    
    // Validate userId
    if (!userId) {
      logger.error('User ID is required');
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    logger.info(`The requestID for USER_INFO IS ${userId}`);
    
    const user_info = `SELECT * FROM USER_INFO WHERE USER_ID = ?`;
    const [result] = await promisePool.execute(user_info, [userId]); // Note: pass as array
    
    if (result.length > 0) {
      logger.info(`User info found for ID: ${userId}`);
      
      // Remove sensitive data if needed (like password)
      const userData = { ...result[0] };
      // delete userData.password; // Uncomment if you have password field
      
      return res.status(200).json({
        success: true,
        message: 'User info retrieved successfully',
        data: userData
      });
    } else {
      logger.warn(`No user found with ID: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
  } catch (error) {
    logger.error('Error in getUserInfo:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
module.exports = {
  authentication,
  verifyOTP,
  resendOTP,
  logout,
  updateProfile,
  getUserInfo
};