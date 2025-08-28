const express = require('express');
const { body, validationResult } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const authService = require('../services/authService');
const logger = require('../utils/logger');
const { sanitizeForLog } = require('../utils/sanitize');

const router = express.Router();

// Apply auth rate limiter to all auth routes
router.use(authLimiter);

// Register
router.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('username').isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username: 3-20 chars, letters/numbers/underscore only'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password: min 8 chars, uppercase, lowercase, number'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, username, password } = req.body;
    const result = await authService.register({ email, username, password });

    logger.info(`New user registered: ${sanitizeForLog(email)}`);

    res.status(201).json({
      message: 'Registration successful',
      ...result
    });
  } catch (error) {
    if (error.message.includes('already')) {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

// Login
router.post('/login', authLimiter, [
  body('login').notEmpty().withMessage('Email or username required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { login, password } = req.body;
    const result = await authService.login({ login, password });

    logger.info(`User logged in: ${sanitizeForLog(result.user.email)}`);

    res.json({
      message: 'Login successful',
      ...result
    });
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    next(error);
  }
});

// Connect wallet
router.post('/connect-wallet', authenticateToken, csrfProtection, [
  body('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address format'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { walletAddress } = req.body;
    const user = await authService.connectWallet(req.user.id, walletAddress);

    logger.info(`Wallet connected for user: ${sanitizeForLog(user.email)}`);

    res.json({
      message: 'Wallet connected successfully',
      user
    });
  } catch (error) {
    if (error.message === 'Wallet already connected') {
      return res.status(409).json({ error: 'Wallet already connected to another account' });
    }
    next(error);
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      isVerified: req.user.isVerified,
      walletAddress: req.user.walletAddress,
      profile: req.user.profile
    }
  });
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  const token = authService.generateToken(req.user.id);

  res.json({
    message: 'Token refreshed',
    token
  });
});

// Logout
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
