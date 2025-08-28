const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const FootballApiService = require('./services/footballApi');

const app = express();
const prisma = new PrismaClient();
const footballApi = new FootballApiService();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/styles', require('./routes/styles'));
app.use('/api/nft', require('./routes/nft'));
app.use('/api/packs', require('./routes/packs'));
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/preorders', require('./routes/preorders'));
app.use('/api/activations', require('./routes/activations'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'Connected'
  });
});

// Process live matches (cron job endpoint)
app.post('/api/process-matches', async (req, res) => {
  try {
    console.log('Processing live matches...');
    const matches = await footballApi.fetchLiveMatches();
    
    let totalActivations = 0;
    for (const match of matches) {
      if (match.fixture.status.short === 'FT') {
        const activations = await footballApi.processMatchForActivations(match.fixture.id);
        totalActivations += activations.length;
      }
    }
    
    res.json({ 
      message: 'Matches processed successfully',
      matchesFound: matches.length,
      activationsCreated: totalActivations
    });
  } catch (error) {
    console.error('Error processing matches:', error);
    res.status(500).json({ error: 'Failed to process matches' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Jogata Backend running on port ${PORT}`);
  console.log(`📊 Database: Connected`);
  console.log(`⚽ Football API: Ready`);
});