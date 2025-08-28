const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { marketplaceLimiter } = require('../middleware/rateLimiter');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Apply marketplace rate limiter
router.use(marketplaceLimiter);

// Get marketplace listings
router.get('/listings', optionalAuth, async (req, res, next) => {
  try {
    const { 
      rarity, 
      category, 
      minPrice, 
      maxPrice, 
      sortBy = 'price', 
      sortOrder = 'asc',
      page = 1, 
      limit = 20 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { status: 'ACTIVE' };

    // Build filters
    if (rarity || category) {
      where.styleCard = {};
      if (rarity) where.styleCard.rarity = rarity.toUpperCase();
      if (category) where.styleCard.category = category;
    }

    if (minPrice) where.price = { gte: parseInt(minPrice) };
    if (maxPrice) {
      where.price = where.price || {};
      where.price.lte = parseInt(maxPrice);
    }

    // Build sort order
    let orderBy = {};
    if (sortBy === 'price') {
      orderBy.price = sortOrder;
    } else if (sortBy === 'date') {
      orderBy.listedAt = sortOrder;
    } else if (sortBy === 'rarity') {
      orderBy.styleCard = { rarity: sortOrder };
    }

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          styleCard: {
            select: {
              id: true,
              name: true,
              rarity: true,
              category: true,
              imageUrl: true,
              description: true
            }
          },
          seller: {
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
        orderBy
      }),
      prisma.marketplaceListing.count({ where })
    ]);

    res.json({
      listings,
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

// Create marketplace listing
router.post('/listings', authenticateToken, [
  body('userStyleId').isUUID(),
  body('price').isInt({ min: 100 }) // Minimum $1.00
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userStyleId, price } = req.body;

    // Verify user owns the style
    const userStyle = await prisma.userStyle.findFirst({
      where: {
        id: userStyleId,
        userId: req.user.id
      },
      include: {
        styleCard: {
          select: {
            id: true,
            name: true,
            rarity: true
          }
        }
      }
    });

    if (!userStyle) {
      return res.status(404).json({
        error: 'Style not found or not owned by user',
        code: 'STYLE_NOT_OWNED'
      });
    }

    // Check if style is already listed
    const existingListing = await prisma.marketplaceListing.findFirst({
      where: {
        styleCardId: userStyle.styleCardId,
        sellerId: req.user.id,
        status: 'ACTIVE'
      }
    });

    if (existingListing) {
      return res.status(409).json({
        error: 'Style is already listed for sale',
        code: 'ALREADY_LISTED'
      });
    }

    // Create listing
    const listing = await prisma.marketplaceListing.create({
      data: {
        sellerId: req.user.id,
        styleCardId: userStyle.styleCardId,
        price: parseInt(price),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      },
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
    });

    logger.info(`Marketplace listing created: ${listing.id} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Listing created successfully',
      listing
    });
  } catch (error) {
    next(error);
  }
});

// Purchase from marketplace
router.post('/listings/:id/purchase', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
      include: {
        styleCard: true,
        seller: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (!listing) {
      return res.status(404).json({
        error: 'Listing not found',
        code: 'LISTING_NOT_FOUND'
      });
    }

    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Listing is no longer active',
        code: 'LISTING_INACTIVE'
      });
    }

    if (listing.sellerId === req.user.id) {
      return res.status(400).json({
        error: 'Cannot purchase your own listing',
        code: 'SELF_PURCHASE'
      });
    }

    // Check if listing has expired
    if (listing.expiresAt && listing.expiresAt < new Date()) {
      await prisma.marketplaceListing.update({
        where: { id },
        data: { status: 'EXPIRED' }
      });

      return res.status(400).json({
        error: 'Listing has expired',
        code: 'LISTING_EXPIRED'
      });
    }

    // Process purchase
    const result = await prisma.$transaction(async (tx) => {
      // Update listing status
      const updatedListing = await tx.marketplaceListing.update({
        where: { id },
        data: {
          status: 'SOLD',
          buyerId: req.user.id,
          soldAt: new Date()
        }
      });

      // Create buyer transaction
      const buyerTransaction = await tx.transaction.create({
        data: {
          userId: req.user.id,
          type: 'MARKETPLACE_BUY',
          amount: listing.price,
          description: `Purchased ${listing.styleCard.name}`,
          status: 'COMPLETED'
        }
      });

      // Create seller transaction (minus 5% fee)
      const sellerAmount = Math.floor(listing.price * 0.95);
      const sellerTransaction = await tx.transaction.create({
        data: {
          userId: listing.sellerId,
          type: 'MARKETPLACE_SELL',
          amount: sellerAmount,
          description: `Sold ${listing.styleCard.name}`,
          status: 'COMPLETED'
        }
      });

      // Transfer ownership
      const newUserStyle = await tx.userStyle.create({
        data: {
          userId: req.user.id,
          styleCardId: listing.styleCardId
        },
        include: {
          styleCard: true
        }
      });

      // Remove from seller's collection
      await tx.userStyle.deleteMany({
        where: {
          userId: listing.sellerId,
          styleCardId: listing.styleCardId
        }
      });

      return {
        listing: updatedListing,
        buyerTransaction,
        sellerTransaction,
        userStyle: newUserStyle
      };
    });

    logger.info(`Marketplace purchase completed: ${id} by user ${req.user.id}`);

    res.json({
      message: 'Purchase completed successfully',
      listing: result.listing,
      transaction: result.buyerTransaction,
      userStyle: result.userStyle
    });
  } catch (error) {
    next(error);
  }
});

// Cancel marketplace listing
router.delete('/listings/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id,
        sellerId: req.user.id,
        status: 'ACTIVE'
      }
    });

    if (!listing) {
      return res.status(404).json({
        error: 'Listing not found or cannot be cancelled',
        code: 'LISTING_NOT_FOUND'
      });
    }

    const updatedListing = await prisma.marketplaceListing.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    logger.info(`Marketplace listing cancelled: ${id} by user ${req.user.id}`);

    res.json({
      message: 'Listing cancelled successfully',
      listing: updatedListing
    });
  } catch (error) {
    next(error);
  }
});

// Get user's marketplace activity
router.get('/user/activity', authenticateToken, async (req, res, next) => {
  try {
    const { type = 'all', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};
    if (type === 'selling') {
      where.sellerId = req.user.id;
    } else if (type === 'buying') {
      where.buyerId = req.user.id;
    } else {
      where = {
        OR: [
          { sellerId: req.user.id },
          { buyerId: req.user.id }
        ]
      };
    }

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
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
          seller: {
            select: {
              id: true,
              username: true
            }
          },
          buyer: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: { listedAt: 'desc' }
      }),
      prisma.marketplaceListing.count({ where })
    ]);

    res.json({
      listings,
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
