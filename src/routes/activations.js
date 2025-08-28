const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Get current week's activations
router.get('/current', optionalAuth, async (req, res, next) => {
  try {
    const currentDate = new Date();
    const currentWeek = getGameweek(currentDate);
    const currentSeason = getCurrentSeason(currentDate);

    const activations = await prisma.styleActivation.findMany({
      where: {
        gameweek: currentWeek,
        season: currentSeason
      },
      include: {
        styleCard: {
          select: {
            id: true,
            name: true,
            rarity: true,
            category: true,
            imageUrl: true
          }
        },
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
      orderBy: [
        { styleCard: { rarity: 'desc' } },
        { rank: 'asc' }
      ]
    });

    // Group by style card
    const activationsByStyle = activations.reduce((acc, activation) => {
      const styleId = activation.styleCardId;
      if (!acc[styleId]) {
        acc[styleId] = {
          style: activation.styleCard,
          activations: []
        };
      }
      acc[styleId].activations.push({
        rank: activation.rank,
        points: activation.points,
        bonusPoints: activation.bonusPoints,
        confidence: activation.confidence,
        matchDate: activation.matchDate,
        player: activation.player
      });
      return acc;
    }, {});

    res.json({
      gameweek: currentWeek,
      season: currentSeason,
      activations: Object.values(activationsByStyle)
    });
  } catch (error) {
    next(error);
  }
});

// Get activation history
router.get('/history', async (req, res, next) => {
  try {
    const { 
      styleId, 
      playerId, 
      gameweek, 
      season, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (styleId) where.styleCardId = styleId;
    if (playerId) where.playerId = playerId;
    if (gameweek) where.gameweek = parseInt(gameweek);
    if (season) where.season = season;

    const [activations, total] = await Promise.all([
      prisma.styleActivation.findMany({
        where,
        skip,
        take: parseInt(limit),
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
              id: true,
              name: true,
              team: true,
              league: true,
              position: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.styleActivation.count({ where })
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

// Get activation statistics
router.get('/stats', async (req, res, next) => {
  try {
    const { timeframe = 'season' } = req.query;
    
    let dateFilter = {};
    if (timeframe === 'month') {
      dateFilter = {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      };
    } else if (timeframe === 'week') {
      dateFilter = {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      };
    }

    // Get activation counts by style rarity
    const activationsByRarity = await prisma.styleActivation.groupBy({
      by: ['styleCardId'],
      where: dateFilter,
      _count: {
        id: true
      },
      _avg: {
        points: true,
        confidence: true
      }
    });

    // Get style card details for grouping
    const styleCards = await prisma.styleCard.findMany({
      where: {
        id: {
          in: activationsByRarity.map(a => a.styleCardId)
        }
      },
      select: {
        id: true,
        rarity: true
      }
    });

    const styleCardMap = styleCards.reduce((acc, style) => {
      acc[style.id] = style;
      return acc;
    }, {});

    // Group by rarity
    const statsByRarity = activationsByRarity.reduce((acc, activation) => {
      const style = styleCardMap[activation.styleCardId];
      if (!style) return acc;

      const rarity = style.rarity;
      if (!acc[rarity]) {
        acc[rarity] = {
          totalActivations: 0,
          avgPoints: 0,
          avgConfidence: 0,
          count: 0
        };
      }

      acc[rarity].totalActivations += activation._count.id;
      acc[rarity].avgPoints += activation._avg.points || 0;
      acc[rarity].avgConfidence += activation._avg.confidence || 0;
      acc[rarity].count += 1;

      return acc;
    }, {});

    // Calculate averages
    Object.keys(statsByRarity).forEach(rarity => {
      const stats = statsByRarity[rarity];
      stats.avgPoints = stats.avgPoints / stats.count;
      stats.avgConfidence = stats.avgConfidence / stats.count;
      delete stats.count;
    });

    // Get top performing players
    const topPlayers = await prisma.styleActivation.groupBy({
      by: ['playerId'],
      where: dateFilter,
      _count: {
        id: true
      },
      _sum: {
        points: true,
        bonusPoints: true
      },
      orderBy: {
        _sum: {
          points: 'desc'
        }
      },
      take: 10
    });

    const playerDetails = await prisma.player.findMany({
      where: {
        id: {
          in: topPlayers.map(p => p.playerId)
        }
      },
      select: {
        id: true,
        name: true,
        team: true,
        league: true,
        position: true
      }
    });

    const playerMap = playerDetails.reduce((acc, player) => {
      acc[player.id] = player;
      return acc;
    }, {});

    const topPlayersWithDetails = topPlayers.map(player => ({
      player: playerMap[player.playerId],
      activations: player._count.id,
      totalPoints: (player._sum.points || 0) + (player._sum.bonusPoints || 0)
    }));

    res.json({
      timeframe,
      statsByRarity,
      topPlayers: topPlayersWithDetails
    });
  } catch (error) {
    next(error);
  }
});

// Get upcoming activation predictions (mock data for now)
router.get('/predictions', async (req, res, next) => {
  try {
    // In a real implementation, this would call the AI service
    // For now, return mock predictions
    const predictions = [
      {
        styleId: 'style-1',
        styleName: 'Speedster',
        predictedPlayers: [
          {
            playerId: 'player-1',
            playerName: 'Kylian Mbappé',
            team: 'PSG',
            confidence: 0.92,
            expectedPoints: 15
          },
          {
            playerId: 'player-2',
            playerName: 'Vinicius Jr.',
            team: 'Real Madrid',
            confidence: 0.87,
            expectedPoints: 12
          }
        ]
      }
    ];

    res.json({
      message: 'Predictions are currently in development',
      predictions
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function getGameweek(date) {
  // Simplified gameweek calculation
  // In reality, this would be more complex based on actual fixture schedules
  const startOfSeason = new Date(date.getFullYear(), 7, 1); // August 1st
  const weeksSinceStart = Math.floor((date - startOfSeason) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(38, weeksSinceStart + 1));
}

function getCurrentSeason(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Season runs from August to May
  if (month >= 7) { // August onwards
    return `${year}-${year + 1}`;
  } else { // January to July
    return `${year - 1}-${year}`;
  }
}

module.exports = router;
