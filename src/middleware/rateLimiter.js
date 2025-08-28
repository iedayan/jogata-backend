const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('redis');
const { authenticateToken } = require('./auth');

// Create Redis client for rate limiting
let redisClient;
if (process.env.REDIS_URL) {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });
  
  redisClient.connect();
}

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    })
  })
});

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    })
  })
});

// Pack purchase limiter (requires authentication)
const packLimiter = [authenticateToken, rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 pack purchases per minute
  message: {
    error: 'Too many pack purchases',
    code: 'PACK_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    })
  })
})];

// Marketplace limiter
const marketplaceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 marketplace actions per minute
  message: {
    error: 'Too many marketplace actions',
    code: 'MARKETPLACE_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    })
  })
});

module.exports = {
  generalLimiter,
  authLimiter,
  packLimiter,
  marketplaceLimiter
};
