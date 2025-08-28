const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Pre-order configuration
const PREORDER_CONFIG = {
  EARLY_BIRD_PRICE: 1200, // $12.00 in cents
  REGULAR_PRICE: 1500,    // $15.00 in cents
  MAX_PACKS_PER_USER: 10,
  EARLY_BIRD_END_DATE: new Date('2024-02-01'), // Adjust as needed
  PACK_CONTENTS: {
    total_cards: 3,
    guaranteed_rare: 1,
    available_styles: 10
  }
};

// Create pre-order
router.post('/create', authenticateToken, [
  body('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/),
  body('packCount').isInt({ min: 1, max: PREORDER_CONFIG.MAX_PACKS_PER_USER }),
  body('totalAmount').isInt({ min: PREORDER_CONFIG.EARLY_BIRD_PRICE })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { walletAddress, packCount, totalAmount } = req.body;
    
    // Verify pricing
    const expectedAmount = packCount * PREORDER_CONFIG.EARLY_BIRD_PRICE;
    if (totalAmount !== expectedAmount) {
      return res.status(400).json({
        error: 'Invalid total amount',
        expected: expectedAmount,
        received: totalAmount
      });
    }

    // Check if early bird period is still active
    const isEarlyBird = new Date() < PREORDER_CONFIG.EARLY_BIRD_END_DATE;
    if (!isEarlyBird) {
      return res.status(400).json({
        error: 'Early bird period has ended',
        code: 'EARLY_BIRD_EXPIRED'
      });
    }

    // Check existing pre-orders for this user
    const existingPreOrders = await prisma.preOrder.findMany({
      where: { userId: req.user.id }
    });

    const totalExistingPacks = existingPreOrders.reduce((sum, order) => sum + order.packCount, 0);
    if (totalExistingPacks + packCount > PREORDER_CONFIG.MAX_PACKS_PER_USER) {
      return res.status(400).json({
        error: `Maximum ${PREORDER_CONFIG.MAX_PACKS_PER_USER} packs per user`,
        code: 'MAX_PACKS_EXCEEDED'
      });
    }

    // Create pre-order record
    const preOrder = await prisma.preOrder.create({
      data: {
        userId: req.user.id,
        walletAddress,
        packCount,
        totalAmount,
        pricePerPack: PREORDER_CONFIG.EARLY_BIRD_PRICE,
        status: 'PENDING',
        isEarlyBird: true,
        packContents: PREORDER_CONFIG.PACK_CONTENTS
      }
    });

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: 'PACK_PREORDER',
        amount: totalAmount,
        description: `Pre-order: ${packCount} Starter Pack${packCount > 1 ? 's' : ''}`,
        status: 'PENDING',
        metadata: {
          preOrderId: preOrder.id,
          packCount,
          isEarlyBird: true
        }
      }
    });

    // Update user profile with founder status
    await prisma.userProfile.update({
      where: { userId: req.user.id },
      data: {
        isFounder: true,
        founderTier: 'GENESIS'
      }
    });

    logger.info(`Pre-order created: ${preOrder.id} for user ${req.user.id}`);

    // In production, this would integrate with payment processor
    // For MVP, we'll mark as completed immediately
    await prisma.preOrder.update({
      where: { id: preOrder.id },
      data: { status: 'CONFIRMED' }
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'COMPLETED' }
    });

    res.status(201).json({
      message: 'Pre-order created successfully',
      preOrder: {
        id: preOrder.id,
        packCount: preOrder.packCount,
        totalAmount: preOrder.totalAmount,
        savings: packCount * (PREORDER_CONFIG.REGULAR_PRICE - PREORDER_CONFIG.EARLY_BIRD_PRICE),
        status: 'CONFIRMED',
        estimatedDelivery: 'At platform launch'
      },
      transaction: {
        id: transaction.id,
        status: 'COMPLETED'
      },
      founderStatus: {
        isFounder: true,
        tier: 'GENESIS'
      }
    });

  } catch (error) {
    next(error);
  }
});

// Get user's pre-orders
router.get('/my-orders', authenticateToken, async (req, res, next) => {
  try {
    const preOrders = await prisma.preOrder.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            deliveredPacks: true
          }
        }
      }
    });

    const totalPacks = preOrders.reduce((sum, order) => sum + order.packCount, 0);
    const totalSpent = preOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalSavings = preOrders
      .filter(order => order.isEarlyBird)
      .reduce((sum, order) => sum + (order.packCount * (PREORDER_CONFIG.REGULAR_PRICE - PREORDER_CONFIG.EARLY_BIRD_PRICE)), 0);

    res.json({
      preOrders: preOrders.map(order => ({
        id: order.id,
        packCount: order.packCount,
        totalAmount: order.totalAmount,
        pricePerPack: order.pricePerPack,
        status: order.status,
        isEarlyBird: order.isEarlyBird,
        createdAt: order.createdAt,
        deliveredPacks: order._count.deliveredPacks,
        packContents: order.packContents
      })),
      summary: {
        totalPacks,
        totalSpent,
        totalSavings,
        averagePricePerPack: totalPacks > 0 ? Math.round(totalSpent / totalPacks) : 0
      }
    });

  } catch (error) {
    next(error);
  }
});

// Get pre-order statistics (admin only)
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    // Simple admin check - in production, use proper role-based auth
    if (req.user.email !== 'admin@soccerdna.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await prisma.preOrder.aggregate({
      _count: { id: true },
      _sum: { 
        packCount: true,
        totalAmount: true 
      }
    });

    const userStats = await prisma.preOrder.groupBy({
      by: ['userId'],
      _count: { id: true },
      _sum: { packCount: true }
    });

    const dailyStats = await prisma.preOrder.groupBy({
      by: ['createdAt'],
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    res.json({
      overview: {
        totalOrders: stats._count.id || 0,
        totalPacks: stats._sum.packCount || 0,
        totalRevenue: stats._sum.totalAmount || 0,
        averageOrderSize: stats._count.id > 0 ? Math.round((stats._sum.packCount || 0) / stats._count.id) : 0,
        uniqueCustomers: userStats.length
      },
      userDistribution: {
        totalUsers: userStats.length,
        averagePacksPerUser: userStats.length > 0 ? Math.round(userStats.reduce((sum, user) => sum + (user._sum.packCount || 0), 0) / userStats.length) : 0,
        topCustomers: userStats
          .sort((a, b) => (b._sum.packCount || 0) - (a._sum.packCount || 0))
          .slice(0, 10)
          .map(user => ({
            userId: user.userId,
            orders: user._count.id,
            totalPacks: user._sum.packCount || 0
          }))
      },
      dailyTrend: dailyStats.map(day => ({
        date: day.createdAt,
        orders: day._count.id,
        revenue: day._sum.totalAmount || 0
      }))
    });

  } catch (error) {
    next(error);
  }
});

// Cancel pre-order (within 24 hours)
router.delete('/:preOrderId', authenticateToken, async (req, res, next) => {
  try {
    const { preOrderId } = req.params;

    const preOrder = await prisma.preOrder.findFirst({
      where: {
        id: preOrderId,
        userId: req.user.id,
        status: 'CONFIRMED'
      }
    });

    if (!preOrder) {
      return res.status(404).json({
        error: 'Pre-order not found or cannot be cancelled',
        code: 'PREORDER_NOT_FOUND'
      });
    }

    // Check if within 24-hour cancellation window
    const hoursSinceOrder = (new Date() - preOrder.createdAt) / (1000 * 60 * 60);
    if (hoursSinceOrder > 24) {
      return res.status(400).json({
        error: 'Cancellation period expired (24 hours)',
        code: 'CANCELLATION_EXPIRED'
      });
    }

    // Cancel the pre-order
    await prisma.preOrder.update({
      where: { id: preOrderId },
      data: { 
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    });

    // Update transaction
    await prisma.transaction.updateMany({
      where: {
        userId: req.user.id,
        metadata: {
          path: ['preOrderId'],
          equals: preOrderId
        }
      },
      data: { status: 'REFUNDED' }
    });

    logger.info(`Pre-order cancelled: ${preOrderId} by user ${req.user.id}`);

    res.json({
      message: 'Pre-order cancelled successfully',
      refundAmount: preOrder.totalAmount,
      refundMethod: 'Original payment method'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
