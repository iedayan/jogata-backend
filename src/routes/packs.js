const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { packLimiter } = require('../middleware/rateLimiter');
const { csrfProtection } = require('../middleware/csrf');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { sanitizeForLog } = require('../utils/sanitize');

const router = express.Router();
const prisma = new PrismaClient();

// Pack configurations based on business plan
const PACK_TYPES = {
  STARTER: {
    name: 'Starter Pack',
    price: 999, // $9.99 in cents
    cards: 5,
    rarityDistribution: {
      COMMON: 5,
      RARE: 0,
      LEGENDARY: 0,
      MYTHIC: 0
    }
  },
  PREMIUM: {
    name: 'Premium Pack',
    price: 2499, // $24.99 in cents
    cards: 5,
    rarityDistribution: {
      COMMON: 2,
      RARE: 3,
      LEGENDARY: 0,
      MYTHIC: 0
    }
  },
  EVOLUTION: {
    name: 'Evolution Pack',
    price: 4999, // $49.99 in cents
    cards: 3,
    rarityDistribution: {
      COMMON: 0,
      RARE: 2,
      LEGENDARY: 1,
      MYTHIC: 0
    }
  },
  GENESIS: {
    name: 'Genesis Pack',
    price: 9999, // $99.99 in cents
    cards: 2,
    rarityDistribution: {
      COMMON: 0,
      RARE: 0,
      LEGENDARY: 1,
      MYTHIC: 1
    }
  }
};

// Apply pack purchase rate limiter
router.use(packLimiter);

// Get available pack types
router.get('/types', async (req, res) => {
  const packTypes = Object.entries(PACK_TYPES).map(([key, config]) => ({
    id: key,
    ...config
  }));

  res.json({
    packs: packTypes
  });
});

// Purchase pack
router.post('/purchase', authenticateToken, csrfProtection, [
  body('packType').isIn(Object.keys(PACK_TYPES)),
  body('quantity').isInt({ min: 1, max: 10 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { packType, quantity = 1 } = req.body;
    const packConfig = PACK_TYPES[packType];
    const totalCost = packConfig.price * quantity;

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId: req.user.id,
          type: 'PACK_PURCHASE',
          amount: totalCost,
          description: `${quantity}x ${packConfig.name}`,
          status: 'COMPLETED' // In real app, this would be PENDING until payment confirms
        }
      });

      // Generate cards for each pack
      const allCards = [];
      for (let i = 0; i < quantity; i++) {
        const packCards = await generatePackCards(packConfig, tx);
        allCards.push(...packCards);
      }

      // Create user styles for all cards
      const userStyles = await Promise.all(
        allCards.map(card => 
          tx.userStyle.create({
            data: {
              userId: req.user.id,
              styleCardId: card.id
            },
            include: {
              styleCard: true
            }
          })
        )
      );

      // Update user profile stats
      await tx.userProfile.update({
        where: { userId: req.user.id },
        data: {
          packsPurchased: {
            increment: quantity
          }
        }
      });

      return {
        transaction,
        cards: userStyles
      };
    });

    logger.info(`Pack purchase completed: User ${req.user.id} bought ${quantity}x ${sanitizeForLog(packType)}`);

    res.json({
      message: 'Pack purchase successful',
      transaction: result.transaction,
      cards: result.cards.map(userStyle => ({
        id: userStyle.id,
        style: userStyle.styleCard,
        ownedSince: userStyle.createdAt
      }))
    });

  } catch (error) {
    next(error);
  }
});

// Open pack (reveal cards)
router.post('/open/:transactionId', authenticateToken, async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    // Verify transaction belongs to user and is a pack purchase
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: req.user.id,
        type: 'PACK_PURCHASE',
        status: 'COMPLETED'
      }
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found or invalid',
        code: 'INVALID_TRANSACTION'
      });
    }

    // Get cards from this purchase (simplified - in real app would track pack-to-card relationships)
    const recentCards = await prisma.userStyle.findMany({
      where: {
        userId: req.user.id,
        createdAt: {
          gte: transaction.createdAt,
          lte: new Date(transaction.createdAt.getTime() + 60000) // Within 1 minute of purchase
        }
      },
      include: {
        styleCard: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      message: 'Pack opened successfully',
      cards: recentCards.map(userStyle => ({
        id: userStyle.id,
        style: userStyle.styleCard,
        isNew: true
      }))
    });

  } catch (error) {
    next(error);
  }
});

// Get user's pack purchase history
router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: req.user.id,
          type: 'PACK_PURCHASE'
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.transaction.count({
        where: {
          userId: req.user.id,
          type: 'PACK_PURCHASE'
        }
      })
    ]);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    next(error);
  }
});

// Helper function to generate cards for a pack
async function generatePackCards(packConfig, tx) {
  const cards = [];
  
  for (const [rarity, count] of Object.entries(packConfig.rarityDistribution)) {
    if (count === 0) continue;

    // Get available cards of this rarity
    const availableCards = await tx.styleCard.findMany({
      where: { rarity }
    });

    if (availableCards.length === 0) {
      throw new Error(`No ${sanitizeForLog(rarity)} cards available`);
    }

    // Randomly select cards
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * availableCards.length);
      cards.push(availableCards[randomIndex]);
    }
  }

  return cards;
}

module.exports = router;
