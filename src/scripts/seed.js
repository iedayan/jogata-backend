const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed style cards
  const styleCards = [
    // Common Styles (60%)
    {
      id: 'style_clinical_finisher',
      name: 'Clinical Finisher',
      description: 'Masters the art of converting chances into goals with ruthless efficiency',
      rarity: 'COMMON',
      category: 'Attacking',
      attributes: {
        playstyle: 'clinical',
        position_preference: ['ST', 'CF'],
        key_attributes: ['finishing', 'composure', 'positioning']
      },
      keyMetrics: ['shot_conversion', 'goals', 'shots_on_target', 'penalty_conversion'],
      imageUrl: 'https://api.soccer-dna.com/images/clinical-finisher.png',
      basePoints: 6,
      bonusMultiplier: 1.0,
      maxSupply: 1500,
      minThreshold: 0.75
    },
    {
      id: 'style_speedster',
      name: 'Speedster',
      description: 'Lightning pace and acceleration to burn past defenders',
      rarity: 'COMMON',
      category: 'Attacking',
      attributes: {
        playstyle: 'pace',
        position_preference: ['RW', 'LW', 'ST'],
        key_attributes: ['pace', 'acceleration', 'dribbling']
      },
      keyMetrics: ['pace', 'dribbles_completed', 'progressive_runs', 'sprint_speed'],
      imageUrl: 'https://api.soccer-dna.com/images/speedster.png',
      basePoints: 4,
      bonusMultiplier: 1.2,
      maxSupply: 1500,
      minThreshold: 0.7
    },
    {
      id: 'style_ball_winner',
      name: 'Ball Winner',
      description: 'Defensive midfielder who breaks up play and wins possession',
      rarity: 'COMMON',
      category: 'Defensive',
      attributes: {
        playstyle: 'defensive',
        position_preference: ['CDM', 'CM'],
        key_attributes: ['tackling', 'interceptions', 'work_rate']
      },
      keyMetrics: ['tackles_won', 'interceptions', 'duels_won', 'recoveries'],
      imageUrl: 'https://api.soccer-dna.com/images/ball-winner.png',
      basePoints: 4,
      bonusMultiplier: 1.1,
      maxSupply: 1500,
      minThreshold: 0.7
    },
    // Rare Styles (30%)
    {
      id: 'style_false_9',
      name: 'False 9',
      description: 'Drops deep to create space and link play between midfield and attack',
      rarity: 'RARE',
      category: 'Attacking',
      attributes: {
        playstyle: 'creative',
        position_preference: ['CF', 'CAM'],
        key_attributes: ['passing', 'dribbling', 'positioning']
      },
      keyMetrics: ['deep_completions', 'assists', 'goals', 'creative_actions'],
      imageUrl: 'https://api.soccer-dna.com/images/false-9.png',
      basePoints: 7,
      bonusMultiplier: 1.3,
      maxSupply: 750,
      minThreshold: 0.8
    },
    // Legendary Styles (8%)
    {
      id: 'style_total_football',
      name: 'Total Football',
      description: 'Ultimate versatility - can play multiple positions at elite level',
      rarity: 'LEGENDARY',
      category: 'Universal',
      attributes: {
        playstyle: 'complete',
        position_preference: ['ANY'],
        key_attributes: ['versatility', 'intelligence', 'technique']
      },
      keyMetrics: ['positional_versatility', 'all_round_stats', 'adaptability', 'multi_position_actions'],
      imageUrl: 'https://api.soccer-dna.com/images/total-football.png',
      basePoints: 12,
      bonusMultiplier: 1.8,
      maxSupply: 200,
      minThreshold: 0.85
    },
    // Mythic Styles (2%)
    {
      id: 'style_game_changer',
      name: 'Game Changer',
      description: 'Single-handedly alters the course of matches with moments of brilliance',
      rarity: 'MYTHIC',
      category: 'Universal',
      attributes: {
        playstyle: 'transcendent',
        position_preference: ['ANY'],
        key_attributes: ['genius', 'unpredictability', 'impact']
      },
      keyMetrics: ['match_winning_actions', 'momentum_shifts', 'decisive_moments', 'impact_rating'],
      imageUrl: 'https://api.soccer-dna.com/images/game-changer.png',
      basePoints: 20,
      bonusMultiplier: 2.5,
      maxSupply: 50,
      minThreshold: 0.9
    }
  ];

  for (const card of styleCards) {
    await prisma.styleCard.upsert({
      where: { id: card.id },
      update: card,
      create: card
    });
  }

  // Seed sample players
  const players = [
    {
      id: 'player_haaland',
      name: 'Erling Haaland',
      position: 'ST',
      team: 'Manchester City',
      league: 'Premier League',
      country: 'Norway',
      externalId: 'haaland_9',
      appearances: 25,
      goals: 22,
      assists: 3
    },
    {
      id: 'player_mbappe',
      name: 'Kylian Mbappé',
      position: 'LW',
      team: 'Paris Saint-Germain',
      league: 'Ligue 1',
      country: 'France',
      externalId: 'mbappe_7',
      appearances: 28,
      goals: 18,
      assists: 12
    }
  ];

  for (const player of players) {
    await prisma.player.upsert({
      where: { id: player.id },
      update: player,
      create: player
    });
  }

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });