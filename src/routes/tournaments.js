const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Get all tournaments
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status.toUpperCase();

    const [tournaments, total] = await Promise.all([
      prisma.tournament.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          _count: {
            select: { entries: true }
          }
        },
        orderBy: [
          { status: 'asc' },
          { startDate: 'asc' }
        ]
      }),
      prisma.tournament.count({ where })
    ]);

    const tournamentsWithStats = tournaments.map(tournament => ({
      ...tournament,
      entryCount: tournament._count.entries,
      spotsRemaining: tournament.maxEntries ? tournament.maxEntries - tournament._count.entries : null,
      _count: undefined
    }));

    res.json({
      tournaments: tournamentsWithStats,
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

// Get specific tournament
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        entries: {
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
          orderBy: [
            { rank: 'asc' },
            { totalPoints: 'desc' }
          ]
        },
        _count: {
          select: { entries: true }
        }
      }
    });

    if (!tournament) {
      return res.status(404).json({
        error: 'Tournament not found',
        code: 'TOURNAMENT_NOT_FOUND'
      });
    }

    // Check if current user is entered
    let userEntry = null;
    if (req.user) {
      userEntry = tournament.entries.find(entry => entry.userId === req.user.id);
    }

    res.json({
      ...tournament,
      entryCount: tournament._count.entries,
      spotsRemaining: tournament.maxEntries ? tournament.maxEntries - tournament._count.entries : null,
      userEntry,
      _count: undefined
    });
  } catch (error) {
    next(error);
  }
});

// Enter tournament
router.post('/:id/enter', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        _count: {
          select: { entries: true }
        }
      }
    });

    if (!tournament) {
      return res.status(404).json({
        error: 'Tournament not found',
        code: 'TOURNAMENT_NOT_FOUND'
      });
    }

    // Check tournament status
    if (tournament.status !== 'UPCOMING') {
      return res.status(400).json({
        error: 'Tournament is not accepting entries',
        code: 'TOURNAMENT_NOT_OPEN'
      });
    }

    // Check if tournament is full
    if (tournament.maxEntries && tournament._count.entries >= tournament.maxEntries) {
      return res.status(400).json({
        error: 'Tournament is full',
        code: 'TOURNAMENT_FULL'
      });
    }

    // Check if user already entered
    const existingEntry = await prisma.tournamentEntry.findUnique({
      where: {
        userId_tournamentId: {
          userId: req.user.id,
          tournamentId: id
        }
      }
    });

    if (existingEntry) {
      return res.status(409).json({
        error: 'Already entered in this tournament',
        code: 'ALREADY_ENTERED'
      });
    }

    // Create entry and transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId: req.user.id,
          type: 'TOURNAMENT_ENTRY',
          amount: tournament.entryFee,
          description: `Entry fee for ${tournament.name}`,
          status: 'COMPLETED'
        }
      });

      // Create tournament entry
      const entry = await tx.tournamentEntry.create({
        data: {
          userId: req.user.id,
          tournamentId: id,
          entryFee: tournament.entryFee
        },
        include: {
          user: {
            select: {
              username: true,
              profile: {
                select: {
                  displayName: true
                }
              }
            }
          }
        }
      });

      return { transaction, entry };
    });

    logger.info(`User ${req.user.id} entered tournament ${id}`);

    res.json({
      message: 'Successfully entered tournament',
      entry: result.entry,
      transaction: result.transaction
    });
  } catch (error) {
    next(error);
  }
});

// Get tournament leaderboard
router.get('/:id/leaderboard', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { id: true, name: true, status: true }
    });

    if (!tournament) {
      return res.status(404).json({
        error: 'Tournament not found',
        code: 'TOURNAMENT_NOT_FOUND'
      });
    }

    const [entries, total] = await Promise.all([
      prisma.tournamentEntry.findMany({
        where: { tournamentId: id },
        skip,
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  displayName: true,
                  avatar: true,
                  country: true
                }
              }
            }
          }
        },
        orderBy: [
          { rank: 'asc' },
          { totalPoints: 'desc' },
          { createdAt: 'asc' }
        ]
      }),
      prisma.tournamentEntry.count({
        where: { tournamentId: id }
      })
    ]);

    const leaderboard = entries.map((entry, index) => ({
      rank: entry.rank || (skip + index + 1),
      points: entry.totalPoints,
      prize: entry.prize,
      user: {
        id: entry.user.id,
        username: entry.user.username,
        displayName: entry.user.profile?.displayName || entry.user.username,
        avatar: entry.user.profile?.avatar,
        country: entry.user.profile?.country
      },
      entryDate: entry.createdAt
    }));

    res.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status
      },
      leaderboard,
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

// Get user's tournament history
router.get('/user/history', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [entries, total] = await Promise.all([
      prisma.tournamentEntry.findMany({
        where: { userId: req.user.id },
        skip,
        take: parseInt(limit),
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              status: true,
              startDate: true,
              endDate: true,
              totalPrize: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.tournamentEntry.count({
        where: { userId: req.user.id }
      })
    ]);

    res.json({
      entries,
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
