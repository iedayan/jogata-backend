const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class FootballApiService {
  constructor() {
    this.apiKey = process.env.FOOTBALL_API_KEY;
    this.baseUrl = 'https://api-football-v1.p.rapidapi.com/v3';
    this.headers = {
      'X-RapidAPI-Key': this.apiKey,
      'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
    };
  }

  // Fetch live matches
  async fetchLiveMatches() {
    try {
      const response = await axios.get(`${this.baseUrl}/fixtures`, {
        headers: this.headers,
        params: {
          live: 'all'
        }
      });

      const matches = response.data.response;
      
      for (const match of matches) {
        await this.saveMatch(match);
      }

      return matches;
    } catch (error) {
      console.error('Error fetching live matches:', error);
      return [];
    }
  }

  // Save match to database
  async saveMatch(matchData) {
    try {
      const match = await prisma.match.upsert({
        where: { apiId: matchData.fixture.id.toString() },
        update: {
          status: matchData.fixture.status.short,
          processed: false
        },
        create: {
          apiId: matchData.fixture.id.toString(),
          homeTeam: matchData.teams.home.name,
          awayTeam: matchData.teams.away.name,
          league: matchData.league.name,
          status: matchData.fixture.status.short,
          startTime: new Date(matchData.fixture.date),
          processed: false
        }
      });

      return match;
    } catch (error) {
      console.error('Error saving match:', error);
      return null;
    }
  }

  // Fetch match statistics
  async fetchMatchStats(matchId) {
    try {
      const response = await axios.get(`${this.baseUrl}/fixtures/statistics`, {
        headers: this.headers,
        params: {
          fixture: matchId
        }
      });

      return response.data.response;
    } catch (error) {
      console.error('Error fetching match stats:', error);
      return null;
    }
  }

  // Fetch player statistics
  async fetchPlayerStats(matchId) {
    try {
      const response = await axios.get(`${this.baseUrl}/fixtures/players`, {
        headers: this.headers,
        params: {
          fixture: matchId
        }
      });

      return response.data.response;
    } catch (error) {
      console.error('Error fetching player stats:', error);
      return null;
    }
  }

  // Process match for style activations
  async processMatchForActivations(matchId) {
    try {
      const playerStats = await this.fetchPlayerStats(matchId);
      if (!playerStats) return;

      const activations = [];

      for (const team of playerStats) {
        for (const player of team.players) {
          const playerActivations = await this.analyzePlayerPerformance(
            player,
            matchId,
            team.team.name
          );
          activations.push(...playerActivations);
        }
      }

      // Mark match as processed
      await prisma.match.update({
        where: { apiId: matchId.toString() },
        data: { processed: true }
      });

      return activations;
    } catch (error) {
      console.error('Error processing match:', error);
      return [];
    }
  }

  // Analyze player performance for style activations
  async analyzePlayerPerformance(player, matchId, teamName) {
    const activations = [];
    const stats = player.statistics[0];
    
    if (!stats) return activations;

    // Clinical Finisher - Goals scored
    if (stats.goals.total > 0) {
      activations.push({
        styleName: 'Clinical Finisher',
        playerId: player.player.id.toString(),
        playerName: player.player.name,
        points: stats.goals.total * 10,
        confidence: 0.9
      });
    }

    // Speedster - High pass accuracy + dribbles
    if (stats.passes.accuracy > 85 && stats.dribbles.success > 3) {
      activations.push({
        styleName: 'Speedster',
        playerId: player.player.id.toString(),
        playerName: player.player.name,
        points: 5,
        confidence: 0.7
      });
    }

    // Ball Winner - Tackles + interceptions
    const defensiveActions = (stats.tackles.total || 0) + (stats.tackles.interceptions || 0);
    if (defensiveActions > 5) {
      activations.push({
        styleName: 'Ball Winner',
        playerId: player.player.id.toString(),
        playerName: player.player.name,
        points: defensiveActions * 2,
        confidence: 0.8
      });
    }

    // Playmaker - Assists + key passes
    if (stats.goals.assists > 0 || stats.passes.key > 3) {
      activations.push({
        styleName: 'Playmaker',
        playerId: player.player.id.toString(),
        playerName: player.player.name,
        points: (stats.goals.assists * 8) + (stats.passes.key * 2),
        confidence: 0.85
      });
    }

    return activations;
  }

  // Save player to database
  async savePlayer(playerData, team, league) {
    try {
      const player = await prisma.player.upsert({
        where: { apiId: playerData.id.toString() },
        update: {
          name: playerData.name,
          team: team,
          league: league
        },
        create: {
          apiId: playerData.id.toString(),
          name: playerData.name,
          team: team,
          league: league,
          position: playerData.position || 'Unknown'
        }
      });

      return player;
    } catch (error) {
      console.error('Error saving player:', error);
      return null;
    }
  }
}

module.exports = FootballApiService;