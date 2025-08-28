const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Get user profile
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        ownedStyles: {
          include: {
            styleCard: {
              select: {
                id: true,
                name: true,
                rarity: true,
                imageUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            ownedStyles: true,
            tournaments: true,
            transactions: {
              where: {
                type: 'PACK_PURCHASE',
                status: 'COMPLETED'
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Calculate collection stats
    const rarityCount = user.ownedStyles.reduce((acc, userStyle) => {
      const rarity = userStyle.styleCard.rarity;
      acc[rarity] = (acc[rarity] || 0) + 1;
      return acc;
    }, {});

    const totalPoints = user.ownedStyles.reduce((sum, userStyle) => sum + userStyle.totalPoints, 0);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      },
      profile: user.profile,
      stats: {
        totalStyles: user._count.ownedStyles,
        totalPoints,
        tournamentsEntered: user._count.tournaments,
        packsPurchased: user._count.transactions,
        collectionByRarity: rarityCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('displayName').optional().isLength({ min: 1, max: 50 }),
  body('bio').optional().isLength({ max: 500 }),
  body('country').optional().isLength({ min: 2, max: 2 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { displayName, bio, country } = req.body;
    const updateData = {};
    
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (country !== undefined) updateData.country = country;

    const updatedProfile = await prisma.userProfile.update({
      where: { userId: req.user.id },
      data: updateData
    });

    logger.info(`Profile updated for user: ${req.user.id}`);

    res.json({
      message: 'Profile updated successfully',
      profile: updatedProfile
    });
  } catch (error) {
    next(error);
  }
});

// Get user's dashboard data
router.get('/dashboard', authenticateToken, async (req, res, next) => {
  try {
    // Get recent activations for user's styles
    const recentActivations = await prisma.styleActivation.findMany({
      where: {
        styleCard: {
          userStyles: {
            some: {
              userId: req.user.id
            }
          }
        },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        styleCard: {
          select: {
            id: true,
            name: true,
            rarity: true,
            imageUrl: true
          }
        },
        player: {
          select: {
            name: true,
            team: true,
            league: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get user's weekly points
    const weeklyPoints = await prisma.userStyle.aggregate({
      where: { userId: req.user.id },
      _sum: { weeklyPoints: true }
    });

    // Get user's rank (simplified calculation)
    const userRank = await prisma.userProfile.findMany({
      select: { totalPoints: true },
      orderBy: { totalPoints: 'desc' }
    });

    const currentUserPoints = req.user.profile?.totalPoints || 0;
    const rank = userRank.findIndex(profile => profile.totalPoints <= currentUserPoints) + 1;

    // Get active tournaments
    const activeTournaments = await prisma.tournament.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: new Date()
        }
      },
      take: 5,
      orderBy: { endDate: 'asc' }
    });

    res.json({
      recentActivations,
      weeklyPoints: weeklyPoints._sum.weeklyPoints || 0,
      currentRank: rank,
      activeTournaments
    });
  } catch (error) {
    next(error);
  }
});

// Get user leaderboard position
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { timeframe = 'overall', page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let orderBy;
    if (timeframe === 'weekly') {
      // Sum weekly points from user styles
      orderBy = { weeklyRank: 'asc' };
    } else {
      orderBy = { totalPoints: 'desc' };
    }

    const leaderboard = await prisma.userProfile.findMany({
      skip,
      take: parseInt(limit),
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    const leaderboardWithRanks = leaderboard.map((profile, index) => ({
      rank: skip + index + 1,
      user: {
        id: profile.user.id,
        username: profile.user.username,
        displayName: profile.displayName || profile.user.username,
        avatar: profile.avatar,
        country: profile.country
      },
      points: timeframe === 'weekly' ? profile.weeklyRank : profile.totalPoints,
      packsPurchased: profile.packsPurchased
    }));

    res.json({
      timeframe,
      leaderboard: leaderboardWithRanks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user's transaction history
router.get('/transactions', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId: req.user.id };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.transaction.count({ where })
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

module.exports = router;
