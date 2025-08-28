const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get all styles
router.get('/', async (req, res) => {
  try {
    const styles = await prisma.style.findMany({
      orderBy: [
        { rarity: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({ styles });
  } catch (error) {
    console.error('Error fetching styles:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get style by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const style = await prisma.style.findUnique({
      where: { id },
      include: {
        activations: {
          take: 10,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!style) {
      return res.status(404).json({ error: 'Style not found' });
    }

    res.json({ style });
  } catch (error) {
    console.error('Error fetching style:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get styles by rarity
router.get('/rarity/:rarity', async (req, res) => {
  try {
    const { rarity } = req.params;
    
    const styles = await prisma.style.findMany({
      where: { rarity: rarity.toUpperCase() },
      orderBy: { name: 'asc' }
    });

    res.json({ styles });
  } catch (error) {
    console.error('Error fetching styles by rarity:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Activate style (internal API)
router.post('/activate', async (req, res) => {
  try {
    const { styleId, playerId, playerName, matchId, leagueId, points, confidence } = req.body;

    // Create activation
    const activation = await prisma.activation.create({
      data: {
        styleId,
        playerId,
        playerName,
        matchId,
        leagueId,
        points,
        confidence
      }
    });

    // Update style stats
    await prisma.style.update({
      where: { id: styleId },
      data: {
        totalPoints: { increment: points },
        activationCount: { increment: 1 }
      }
    });

    // Update user points for all owners of this style
    const userStyles = await prisma.userStyle.findMany({
      where: { styleId }
    });

    for (const userStyle of userStyles) {
      await prisma.userStyle.update({
        where: { id: userStyle.id },
        data: { points: { increment: points } }
      });

      await prisma.user.update({
        where: { id: userStyle.userId },
        data: { totalPoints: { increment: points } }
      });
    }

    res.json({ 
      message: 'Style activated successfully',
      activation,
      affectedUsers: userStyles.length
    });
  } catch (error) {
    console.error('Error activating style:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;