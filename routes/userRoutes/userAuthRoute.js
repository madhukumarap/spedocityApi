const express = require('express');
const rateLimit = require('express-rate-limit');
const { authentication, verifyOTP, resendOTP, logout, updateProfile, getUserInfo } = require('../../controllers/user/userAuthentication');
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
router.use('/spedocity/send-otp', otpLimiter);
router.use('/spedocity/verify-otp', otpLimiter);
router.use('/spedocity/resend-otp', otpLimiter);

// Routes
router.post('/spedocity/send-otp', authentication); 
router.post('/spedocity/verify-otp', verifyOTP); // Verify OTP
router.post('/spedocity/resend-otp', resendOTP); // Resend OTP
router.post('/spedocity/logout', auth.verifyToken, logout); // Logout
router.post('/spedocity/update-profile', auth.verifyToken, updateProfile);
router.get('/spedocity/get-user-info', auth.verifyToken, getUserInfo)
module.exports = router;