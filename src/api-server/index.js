const express = require('express');
const http = require('http');
const cors = require('cors');
const { getActiveGames, getGameById } = require('../game-server');

// Create Express app for API
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.API_PORT || 3001;

// API Routes

// Get all active games
app.get('/api/games', (req, res) => {
  const activeGames = getActiveGames();
  res.json({
    count: activeGames.length,
    games: activeGames.map(game => ({
      id: game.id,
      white: { name: game.white.name },
      black: { name: game.black.name },
      status: game.status,
      turn: game.turn,
      moveCount: game.moves.length,
      startTime: game.startTime
    }))
  });
});

// Get specific game by ID
app.get('/api/games/:id', (req, res) => {
  const game = getGameById(req.params.id);

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  res.json({
    id: game.id,
    white: { name: game.white.name },
    black: { name: game.black.name },
    status: game.status,
    turn: game.turn,
    moves: game.moves,
    startTime: game.startTime,
    lastMoveTime: game.lastMoveTime
  });
});

// Get statistics
app.get('/api/stats', (req, res) => {
  const games = Object.values(getActiveGames());

  const stats = {
    totalActiveGames: games.length,
    totalPlayers: new Set([
      ...games.map(game => game.white.id),
      ...games.map(game => game.black.id)
    ]).size,
    whiteWins: games.filter(game => game.winner === 'white').length,
    blackWins: games.filter(game => game.winner === 'black').length,
    draws: games.filter(game => game.status === 'finished' && !game.winner).length
  };

  res.json(stats);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start server
server.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

module.exports = { app, server };
