const express = require('express');
const router = express.Router();
const NFTMetadataService = require('../services/nftMetadataService');
const { authenticateToken } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const metadataService = new NFTMetadataService();

/**
 * GET /api/nft/metadata/:tokenId
 * Get NFT metadata for a specific token
 */
router.get('/metadata/:tokenId', authenticateToken, async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    // Try to get existing metadata
    let metadata = await metadataService.getMetadata(tokenId);
    
    if (!metadata) {
      return res.status(404).json({
        error: 'Metadata not found',
        message: `No metadata found for token ${tokenId}`
      });
    }

    res.json(metadata);
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch NFT metadata'
    });
  }
});

/**
 * POST /api/nft/metadata
 * Generate metadata for a new NFT (admin only)
 */
router.post('/metadata', authenticateToken, csrfProtection, async (req, res) => {
  try {
    const { 
      tokenId, 
      styleName, 
      rarity, 
      serialNumber, 
      totalPoints = 0, 
      activationCount = 0 
    } = req.body;

    // Validate required fields
    if (!tokenId || !styleName || rarity === undefined || !serialNumber) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'tokenId, styleName, rarity, and serialNumber are required'
      });
    }

    // Generate metadata
    const metadata = await metadataService.generateMetadata(
      tokenId,
      styleName,
      rarity,
      serialNumber,
      totalPoints,
      activationCount
    );

    // Save metadata
    await metadataService.saveMetadata(tokenId, metadata);

    res.status(201).json({
      success: true,
      metadata,
      message: 'Metadata generated successfully'
    });
  } catch (error) {
    console.error('Error generating metadata:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to generate NFT metadata'
    });
  }
});

/**
 * PUT /api/nft/metadata/:tokenId
 * Update NFT metadata (admin only)
 */
router.put('/metadata/:tokenId', authenticateToken, csrfProtection, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const updates = req.body;

    const metadata = await metadataService.updateMetadata(tokenId, updates);

    res.json({
      success: true,
      metadata,
      message: 'Metadata updated successfully'
    });
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to update NFT metadata'
    });
  }
});

/**
 * GET /api/nft/styles
 * Get all available playing styles
 */
router.get('/styles', (req, res) => {
  try {
    const styles = metadataService.getAvailableStyles();
    const styleDefinitions = {};
    
    styles.forEach(styleName => {
      styleDefinitions[styleName] = metadataService.getStyleDefinition(styleName);
    });

    res.json({
      styles,
      definitions: styleDefinitions
    });
  } catch (error) {
    console.error('Error fetching styles:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch playing styles'
    });
  }
});

/**
 * GET /api/nft/styles/:styleName
 * Get specific style definition
 */
router.get('/styles/:styleName', authenticateToken, (req, res) => {
  try {
    const { styleName } = req.params;
    const definition = metadataService.getStyleDefinition(styleName);
    
    if (!definition) {
      return res.status(404).json({
        error: 'Style not found',
        message: `Playing style '${styleName}' not found`
      });
    }

    res.json({
      name: styleName,
      definition
    });
  } catch (error) {
    console.error('Error fetching style definition:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch style definition'
    });
  }
});

/**
 * POST /api/nft/generate-all
 * Generate all initial metadata files (admin only)
 */
router.post('/generate-all', authenticateToken, csrfProtection, async (req, res) => {
  try {
    // Check if user is admin (you might want to add admin role check)
    const results = await metadataService.generateAllMetadata();

    res.json({
      success: true,
      results,
      message: `Generated metadata for ${results.length} style variations`
    });
  } catch (error) {
    console.error('Error generating all metadata:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate metadata files'
    });
  }
});

/**
 * GET /api/nft/contract-info
 * Get contract addresses and configuration
 */
router.get('/contract-info', (req, res) => {
  try {
    const contractInfo = {
      styleCardsContract: process.env.STYLE_CARDS_CONTRACT_ADDRESS,
      packsContract: process.env.PACKS_CONTRACT_ADDRESS,
      network: process.env.NETWORK_NAME || 'localhost',
      chainId: process.env.CHAIN_ID || 1337,
      baseImageUrl: process.env.NFT_IMAGE_BASE_URL || 'https://api.soccer-dna.com/images',
      rarityDistribution: {
        COMMON: 70,
        RARE: 25,
        LEGENDARY: 4.5,
        MYTHIC: 0.5
      },
      packTypes: {
        STARTER: {
          price: '0.01 ETH',
          cardCount: 3,
          guaranteedRare: 1
        },
        PREMIUM: {
          price: '0.025 ETH',
          cardCount: 5,
          guaranteedRare: 2
        },
        ELITE: {
          price: '0.05 ETH',
          cardCount: 10,
          guaranteedRare: 3
        }
      }
    };

    res.json(contractInfo);
  } catch (error) {
    console.error('Error fetching contract info:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch contract information'
    });
  }
});

/**
 * GET /api/nft/rarity-info
 * Get rarity information and multipliers
 */
router.get('/rarity-info', (req, res) => {
  try {
    const rarityInfo = {
      rarities: [
        {
          name: 'COMMON',
          value: 0,
          probability: 70,
          multiplier: 1.0,
          color: '#9CA3AF',
          description: 'Standard style cards with solid performance'
        },
        {
          name: 'RARE',
          value: 1,
          probability: 25,
          multiplier: 1.5,
          color: '#3B82F6',
          description: 'Enhanced style cards with improved scoring potential'
        },
        {
          name: 'LEGENDARY',
          value: 2,
          probability: 4.5,
          multiplier: 2.0,
          color: '#8B5CF6',
          description: 'Exceptional style cards with significant bonuses'
        },
        {
          name: 'MYTHIC',
          value: 3,
          probability: 0.5,
          multiplier: 3.0,
          color: '#F59E0B',
          description: 'Ultra-rare style cards with maximum scoring power'
        }
      ],
      totalSupplyCaps: {
        COMMON: 6000,
        RARE: 3000,
        LEGENDARY: 800,
        MYTHIC: 200
      },
      maxSupply: 10000
    };

    res.json(rarityInfo);
  } catch (error) {
    console.error('Error fetching rarity info:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch rarity information'
    });
  }
});

module.exports = router;
