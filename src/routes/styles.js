const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Apply general rate limiter
router.use(generalLimiter);

// Get all available style cards
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { rarity, category, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (rarity) where.rarity = rarity.toUpperCase();
    if (category) where.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [styles, total] = await Promise.all([
      prisma.styleCard.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [
          { rarity: 'asc' },
          { name: 'asc' }
        ],
        include: {
          _count: {
            select: {
              userStyles: true,
              activations: {
                where: {
                  createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                  }
                }
              }
            }
          }
        }
      }),
      prisma.styleCard.count({ where })
    ]);

    const stylesWithStats = styles.map(style => ({
      ...style,
      totalOwners: style._count.userStyles,
      recentActivations: style._count.activations,
      _count: undefined
    }));

    res.json({
      styles: stylesWithStats,
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

// Get specific style card details
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const style = await prisma.styleCard.findUnique({
      where: { id },
      include: {
        activations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                league: true,
                position: true
              }
            }
          }
        },
        _count: {
          select: {
            userStyles: true,
            activations: true
          }
        }
      }
    });

    if (!style) {
      return res.status(404).json({
        error: 'Style card not found',
        code: 'STYLE_NOT_FOUND'
      });
    }

    // Get recent performance stats
    const recentActivations = await prisma.styleActivation.findMany({
      where: {
        styleCardId: id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      select: {
        points: true,
        bonusPoints: true,
        confidence: true,
        gameweek: true
      },
      orderBy: { gameweek: 'desc' }
    });

    const avgPoints = recentActivations.length > 0 
      ? recentActivations.reduce((sum, act) => sum + act.points + act.bonusPoints, 0) / recentActivations.length
      : 0;

    const avgConfidence = recentActivations.length > 0
      ? recentActivations.reduce((sum, act) => sum + act.confidence, 0) / recentActivations.length
      : 0;

    res.json({
      ...style,
      stats: {
        totalOwners: style._count.userStyles,
        totalActivations: style._count.activations,
        avgPointsLast30Days: Math.round(avgPoints * 100) / 100,
        avgConfidenceLast30Days: Math.round(avgConfidence * 100) / 100,
        recentActivations: recentActivations.slice(0, 5)
      },
      _count: undefined
    });
  } catch (error) {
    next(error);
  }
});

// Get user's owned styles
router.get('/user/owned', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [userStyles, total] = await Promise.all([
      prisma.userStyle.findMany({
        where: { userId: req.user.id },
        skip,
        take: parseInt(limit),
        include: {
          styleCard: {
            include: {
              _count: {
                select: {
                  activations: {
                    where: {
                      createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      }
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: [
          { styleCard: { rarity: 'desc' } },
          { createdAt: 'desc' }
        ]
      }),
      prisma.userStyle.count({
        where: { userId: req.user.id }
      })
    ]);

    const stylesWithStats = userStyles.map(userStyle => ({
      id: userStyle.id,
      tokenId: userStyle.tokenId,
      totalPoints: userStyle.totalPoints,
      weeklyPoints: userStyle.weeklyPoints,
      activationCount: userStyle.activationCount,
      ownedSince: userStyle.createdAt,
      style: {
        ...userStyle.styleCard,
        recentActivations: userStyle.styleCard._count.activations,
        _count: undefined
      }
    }));

    res.json({
      styles: stylesWithStats,
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

// Get style leaderboard
router.get('/:id/leaderboard', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { timeframe = 'weekly' } = req.query;

    // Validate style exists
    const style = await prisma.styleCard.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!style) {
      return res.status(404).json({
        error: 'Style card not found',
        code: 'STYLE_NOT_FOUND'
      });
    }

    let dateFilter = {};
    if (timeframe === 'weekly') {
      dateFilter = {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      };
    } else if (timeframe === 'monthly') {
      dateFilter = {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      };
    }

    const leaderboard = await prisma.userStyle.findMany({
      where: {
        styleCardId: id,
        ...dateFilter
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: timeframe === 'weekly' 
        ? { weeklyPoints: 'desc' }
        : { totalPoints: 'desc' },
      take: 100
    });

    const leaderboardWithRanks = leaderboard.map((entry, index) => ({
      rank: index + 1,
      points: timeframe === 'weekly' ? entry.weeklyPoints : entry.totalPoints,
      activations: entry.activationCount,
      user: {
        id: entry.user.id,
        username: entry.user.username,
        displayName: entry.user.profile?.displayName || entry.user.username,
        avatar: entry.user.profile?.avatar
      }
    }));

    res.json({
      style: {
        id: style.id,
        name: style.name
      },
      timeframe,
      leaderboard: leaderboardWithRanks
    });
  } catch (error) {
    next(error);
  }
});

// Get style activation history
router.get('/:id/activations', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activations, total] = await Promise.all([
      prisma.styleActivation.findMany({
        where: { styleCardId: id },
        skip,
        take: parseInt(limit),
        include: {
          player: {
            select: {
              id: true,
              name: true,
              team: true,
              league: true,
              position: true,
              country: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.styleActivation.count({
        where: { styleCardId: id }
      })
    ]);

    res.json({
      activations,
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
