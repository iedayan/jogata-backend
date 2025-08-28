const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sanitizeForLog } = require('../utils/sanitize');

const prisma = new PrismaClient();

class AuthService {
  async register({ email, username, password }) {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      throw new Error(existingUser.email === email ? 'Email already registered' : 'Username taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with profile
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        profile: {
          create: { displayName: username }
        }
      },
      include: { profile: true }
    });

    const token = this.generateToken(user.id);
    return { user: this.sanitizeUser(user), token };
  }

  async login({ login, password }) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: login }, { username: login }] },
      include: { profile: true }
    });

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user.id);
    return { user: this.sanitizeUser(user), token };
  }

  async connectWallet(userId, walletAddress) {
    const existingWallet = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (existingWallet && existingWallet.id !== userId) {
      throw new Error('Wallet already connected');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { walletAddress },
      include: { profile: true }
    });

    return this.sanitizeUser(user);
  }

  generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
    });
  }

  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  sanitizeUser(user) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}

module.exports = new AuthService();