const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const styles = [
  // Common Styles (15)
  { name: 'Clinical Finisher', description: 'Deadly in front of goal with precise finishing', rarity: 'COMMON', category: 'Attacking' },
  { name: 'Speedster', description: 'Lightning pace to outrun defenders', rarity: 'COMMON', category: 'Physical' },
  { name: 'Aerial Threat', description: 'Dominates in the air for headers and crosses', rarity: 'COMMON', category: 'Physical' },
  { name: 'Ball Winner', description: 'Excels at tackles and interceptions', rarity: 'COMMON', category: 'Defensive' },
  { name: 'Playmaker', description: 'Creates chances with vision and passing', rarity: 'COMMON', category: 'Creative' },
  { name: 'Dribbler', description: 'Beats defenders with skill and close control', rarity: 'COMMON', category: 'Technical' },
  { name: 'Shot Stopper', description: 'Goalkeeper with exceptional reflexes', rarity: 'COMMON', category: 'Goalkeeping' },
  { name: 'Defender', description: 'Solid defensive positioning and clearances', rarity: 'COMMON', category: 'Defensive' },
  { name: 'Crosser', description: 'Delivers dangerous balls from wide areas', rarity: 'COMMON', category: 'Technical' },
  { name: 'Set Piece Specialist', description: 'Masters free kicks and corners', rarity: 'COMMON', category: 'Technical' },
  { name: 'Tackler', description: 'Times tackles perfectly to win possession', rarity: 'COMMON', category: 'Defensive' },
  { name: 'Passer', description: 'Accurate distribution and ball retention', rarity: 'COMMON', category: 'Technical' },
  { name: 'Poacher', description: 'Always in the right place at the right time', rarity: 'COMMON', category: 'Attacking' },
  { name: 'Winger', description: 'Provides width and pace down the flanks', rarity: 'COMMON', category: 'Attacking' },
  { name: 'Midfielder', description: 'Controls the tempo from the center', rarity: 'COMMON', category: 'Central' },

  // Rare Styles (8)
  { name: 'False 9', description: 'Drops deep to create space and link play', rarity: 'RARE', category: 'Tactical' },
  { name: 'Inverted Winger', description: 'Cuts inside from wide to create danger', rarity: 'RARE', category: 'Tactical' },
  { name: 'Box-to-Box Engine', description: 'Covers every blade of grass with energy', rarity: 'RARE', category: 'Physical' },
  { name: 'Sweeper Keeper', description: 'Goalkeeper who acts as extra defender', rarity: 'RARE', category: 'Goalkeeping' },
  { name: 'Deep Playmaker', description: 'Dictates play from deep positions', rarity: 'RARE', category: 'Creative' },
  { name: 'Wing Back', description: 'Provides attacking threat from defensive position', rarity: 'RARE', category: 'Tactical' },
  { name: 'Target Man', description: 'Holds up play and brings others into game', rarity: 'RARE', category: 'Physical' },
  { name: 'Regista', description: 'Deep-lying playmaker with exceptional vision', rarity: 'RARE', category: 'Creative' },

  // Legendary Styles (2)
  { name: 'Total Football', description: 'Can play any position with equal skill', rarity: 'LEGENDARY', category: 'Tactical' },
  { name: 'Tiki-Taka Maestro', description: 'Masters the art of possession football', rarity: 'LEGENDARY', category: 'Technical' },

  // Mythic Style (1)
  { name: 'Game Changer', description: 'Single-handedly changes the outcome of matches', rarity: 'MYTHIC', category: 'Mental' }
];

async function seedStyles() {
  try {
    console.log('Seeding playing styles...');

    for (const style of styles) {
      await prisma.style.upsert({
        where: { name: style.name },
        update: style,
        create: style
      });
      console.log(`✓ ${style.name} (${style.rarity})`);
    }

    console.log(`\n🎉 Successfully seeded ${styles.length} playing styles!`);
    
    // Display summary
    const summary = {
      COMMON: styles.filter(s => s.rarity === 'COMMON').length,
      RARE: styles.filter(s => s.rarity === 'RARE').length,
      LEGENDARY: styles.filter(s => s.rarity === 'LEGENDARY').length,
      MYTHIC: styles.filter(s => s.rarity === 'MYTHIC').length
    };

    console.log('\n📊 Rarity Distribution:');
    Object.entries(summary).forEach(([rarity, count]) => {
      console.log(`${rarity}: ${count} styles`);
    });

  } catch (error) {
    console.error('Error seeding styles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedStyles();
}

module.exports = { seedStyles, styles };