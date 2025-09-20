const express = require('express');
const rateLimit = require('express-rate-limit');
const { authentication, verifyOTP, resendOTP, logout } = require('../../controllers/user/userAuthentication');
const auth = require('../../middleware/authMiddleware');

const router = express.Router();

// Rate limiting for OTP endpoints
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 OTP requests per windowMs
  message: {
    message: 'Too many OTP requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to OTP routes
router.use('/sepdocity/send-otp', otpLimiter);
router.use('/sepdocity/verify-otp', otpLimiter);
router.use('/sepdocity/resend-otp', otpLimiter);

// Routes
router.post('/sepdocity/send-otp', authentication); 
router.post('/sepdocity/verify-otp', verifyOTP); // Verify OTP
router.post('/sepdocity/resend-otp', resendOTP); // Resend OTP
router.post('/sepdocity/logout', auth.verifyToken, logout); // Logout

module.exports = router;