const fs = require('fs').promises;
const path = require('path');

/**
 * NFT Metadata Service
 * Handles generation and management of NFT metadata for Style Cards
 */
class NFTMetadataService {
  constructor() {
    this.baseImageUrl = process.env.NFT_IMAGE_BASE_URL || 'https://api.soccer-dna.com/images';
    this.metadataDir = path.join(__dirname, '../../../public/metadata');
    this.imageDir = path.join(__dirname, '../../../public/images');
    
    // Style definitions with enhanced metadata
    this.styleDefinitions = {
      'Clinical Finisher': {
        description: 'Masters the art of converting chances into goals with clinical precision. These players have ice in their veins when it matters most.',
        category: 'Attacking',
        attributes: {
          'Shot Accuracy': 95,
          'Composure': 92,
          'Finishing': 98,
          'Penalty Taking': 88
        },
        backgroundColor: '#FF6B6B',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6', 
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      },
      'Speedster': {
        description: 'Lightning-fast players who leave defenders in their dust. Pure pace and acceleration that changes games in an instant.',
        category: 'Attacking',
        attributes: {
          'Pace': 99,
          'Acceleration': 97,
          'Sprint Speed': 98,
          'Agility': 89
        },
        backgroundColor: '#4ECDC4',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6', 
          MYTHIC: '#F59E0B'
        }
      },
      'Deep Playmaker': {
        description: 'Vision masters who thread perfect passes through tight spaces. The architects of beautiful football.',
        category: 'Midfield',
        attributes: {
          'Vision': 96,
          'Passing': 94,
          'Through Balls': 92,
          'Long Passing': 90
        },
        backgroundColor: '#45B7D1',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      },
      'Ball Winner': {
        description: 'Defensive specialists who win possession and break up play. The unsung heroes who do the dirty work.',
        category: 'Defensive',
        attributes: {
          'Tackling': 94,
          'Interceptions': 91,
          'Defensive Awareness': 89,
          'Aggression': 87
        },
        backgroundColor: '#96CEB4',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      },
      'Aerial Threat': {
        description: 'Dominant in the air, winning headers and aerial duels. Towers above the competition when crosses come in.',
        category: 'Attacking',
        attributes: {
          'Heading': 96,
          'Jumping': 93,
          'Aerial Duels': 95,
          'Positioning': 88
        },
        backgroundColor: '#FECA57',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      },
      'Rock Defender': {
        description: 'Solid defenders who keep clean sheets and make crucial blocks. The last line of defense you can always count on.',
        category: 'Defensive',
        attributes: {
          'Defending': 95,
          'Marking': 92,
          'Blocks': 94,
          'Positioning': 90
        },
        backgroundColor: '#A55EEA',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      },
      'Set Piece Master': {
        description: 'Dead ball specialists who score from free kicks and corners. When there\'s a set piece, all eyes are on them.',
        category: 'Specialist',
        attributes: {
          'Free Kicks': 97,
          'Corners': 91,
          'Penalties': 94,
          'Curve': 89
        },
        backgroundColor: '#26D0CE',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      },
      'Dribbler': {
        description: 'Skillful players who beat opponents with pace and trickery. Poetry in motion when they have the ball at their feet.',
        category: 'Attacking',
        attributes: {
          'Dribbling': 96,
          'Ball Control': 94,
          'Agility': 92,
          'Flair': 95
        },
        backgroundColor: '#FD79A8',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      },
      'Counter Attacker': {
        description: 'Explosive players who thrive in fast-break situations. When the opportunity arises, they strike like lightning.',
        category: 'Attacking',
        attributes: {
          'Counter Attack': 95,
          'Pace': 91,
          'Decision Making': 88,
          'Finishing': 86
        },
        backgroundColor: '#FDCB6E',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      },
      'Box-to-Box': {
        description: 'Complete players who contribute at both ends of the pitch. The engine room that never stops running.',
        category: 'Midfield',
        attributes: {
          'Stamina': 98,
          'Work Rate': 96,
          'Versatility': 94,
          'All-Round': 92
        },
        backgroundColor: '#6C5CE7',
        rarityColors: {
          COMMON: '#9CA3AF',
          RARE: '#3B82F6',
          LEGENDARY: '#8B5CF6',
          MYTHIC: '#F59E0B'
        }
      }
    };
  }

  /**
   * Generate metadata for a style NFT
   */
  async generateMetadata(tokenId, styleName, rarity, serialNumber, totalPoints = 0, activationCount = 0) {
    const styleData = this.styleDefinitions[styleName];
    if (!styleData) {
      throw new Error(`Unknown style: ${styleName}`);
    }

    const rarityName = this.getRarityName(rarity);
    const rarityMultiplier = this.getRarityMultiplier(rarity);

    const metadata = {
      name: `${styleName} #${serialNumber}`,
      description: styleData.description,
      image: `${this.baseImageUrl}/${styleName.toLowerCase().replace(/\s+/g, '-')}-${rarityName.toLowerCase()}.png`,
      external_url: `https://soccer-dna.com/nft/${tokenId}`,
      attributes: [
        {
          trait_type: 'Style',
          value: styleName
        },
        {
          trait_type: 'Category', 
          value: styleData.category
        },
        {
          trait_type: 'Rarity',
          value: rarityName
        },
        {
          trait_type: 'Serial Number',
          value: serialNumber,
          display_type: 'number'
        },
        {
          trait_type: 'Rarity Multiplier',
          value: rarityMultiplier,
          display_type: 'number'
        },
        {
          trait_type: 'Total Points',
          value: totalPoints,
          display_type: 'number'
        },
        {
          trait_type: 'Activations',
          value: activationCount,
          display_type: 'number'
        }
      ],
      properties: {
        category: styleData.category,
        rarity: rarityName,
        backgroundColor: styleData.backgroundColor,
        rarityColor: styleData.rarityColors[rarityName],
        attributes: styleData.attributes
      }
    };

    // Add style-specific attributes
    Object.entries(styleData.attributes).forEach(([key, value]) => {
      metadata.attributes.push({
        trait_type: key,
        value: value,
        max_value: 100,
        display_type: 'number'
      });
    });

    return metadata;
  }

  /**
   * Save metadata to file system
   */
  async saveMetadata(tokenId, metadata) {
    try {
      // Ensure metadata directory exists
      await fs.mkdir(this.metadataDir, { recursive: true });
      
      const filePath = path.join(this.metadataDir, `${tokenId}.json`);
      await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
      
      return filePath;
    } catch (error) {
      console.error('Error saving metadata:', error);
      throw error;
    }
  }

  /**
   * Get metadata from file system
   */
  async getMetadata(tokenId) {
    try {
      const filePath = path.join(this.metadataDir, `${tokenId}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File not found
      }
      throw error;
    }
  }

  /**
   * Update metadata with new stats
   */
  async updateMetadata(tokenId, updates) {
    const metadata = await this.getMetadata(tokenId);
    if (!metadata) {
      throw new Error(`Metadata not found for token ${tokenId}`);
    }

    // Update specific attributes
    if (updates.totalPoints !== undefined) {
      const pointsAttr = metadata.attributes.find(attr => attr.trait_type === 'Total Points');
      if (pointsAttr) pointsAttr.value = updates.totalPoints;
    }

    if (updates.activationCount !== undefined) {
      const activationsAttr = metadata.attributes.find(attr => attr.trait_type === 'Activations');
      if (activationsAttr) activationsAttr.value = updates.activationCount;
    }

    await this.saveMetadata(tokenId, metadata);
    return metadata;
  }

  /**
   * Generate all initial metadata files
   */
  async generateAllMetadata() {
    const results = [];
    
    for (const [styleName, styleData] of Object.entries(this.styleDefinitions)) {
      for (let rarity = 0; rarity < 4; rarity++) {
        const rarityName = this.getRarityName(rarity);
        const serialNumber = 1; // Example serial number
        
        const metadata = await this.generateMetadata(
          `${styleName}-${rarityName}`, 
          styleName, 
          rarity, 
          serialNumber
        );
        
        const filePath = await this.saveMetadata(`${styleName}-${rarityName}`, metadata);
        results.push({ styleName, rarity: rarityName, filePath });
      }
    }
    
    return results;
  }

  /**
   * Get rarity name from enum value
   */
  getRarityName(rarity) {
    const rarities = ['COMMON', 'RARE', 'LEGENDARY', 'MYTHIC'];
    return rarities[rarity] || 'COMMON';
  }

  /**
   * Get rarity multiplier for scoring
   */
  getRarityMultiplier(rarity) {
    const multipliers = [1.0, 1.5, 2.0, 3.0]; // COMMON, RARE, LEGENDARY, MYTHIC
    return multipliers[rarity] || 1.0;
  }

  /**
   * Get all available styles
   */
  getAvailableStyles() {
    return Object.keys(this.styleDefinitions);
  }

  /**
   * Get style definition
   */
  getStyleDefinition(styleName) {
    return this.styleDefinitions[styleName];
  }
}

module.exports = NFTMetadataService;
