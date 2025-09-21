const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

// Game state
let games = {};
let waitingPlayers = [];

/**
 * Initialize the game server with the HTTP server
 * @param {Server} httpServer - HTTP server to attach socket.io to
 * @returns {Server} The Socket.IO server instance
 */
function initGameServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Game server: User connected:', socket.id);

    // Player joins with name
    socket.on('registerPlayer', (playerName) => {
      socket.playerName = playerName;
      console.log(`Game server: Player registered: ${playerName} (${socket.id})`);
      socket.emit('registered', { id: socket.id, name: playerName });
    });

    // Player selects color and waits for opponent
    socket.on('selectColor', (color) => {
      if (!socket.playerName) {
        socket.emit('error', { message: 'Please register your name first' });
        return;
      }

      // Check if player is already waiting
      const existingPlayer = waitingPlayers.find(p => p.id === socket.id);
      if (existingPlayer) {
        existingPlayer.color = color;
        socket.emit('waitingForOpponent', { message: 'Waiting for an opponent...' });
        return;
      }

      // Check if there's someone waiting with opposite color
      const opponent = waitingPlayers.find(p => p.color !== color);
      if (opponent) {
        // Create a new game
        const gameId = uuidv4();
        const whitePlayer = color === 'white' ?
          { id: socket.id, name: socket.playerName } :
          { id: opponent.id, name: opponent.name };

        const blackPlayer = color === 'black' ?
          { id: socket.id, name: socket.playerName } :
          { id: opponent.id, name: opponent.name };

        games[gameId] = {
          id: gameId,
          white: whitePlayer,
          black: blackPlayer,
          moves: [],
          status: 'waiting', // waiting, active, finished
          turn: 'white',
          startTime: new Date(),
          lastMoveTime: null
        };

        // Remove opponent from waiting list
        waitingPlayers = waitingPlayers.filter(p => p.id !== opponent.id);

        // Join both players to game room
        socket.join(gameId);
        io.sockets.sockets.get(opponent.id).join(gameId);

        // Notify both players
        io.to(gameId).emit('gameCreated', {
          gameId,
          white: whitePlayer,
          black: blackPlayer
        });

        console.log(`Game server: Game created: ${gameId} - White: ${whitePlayer.name}, Black: ${blackPlayer.name}`);
      } else {
        // Add to waiting list
        waitingPlayers.push({
          id: socket.id,
          name: socket.playerName,
          color
        });
        socket.emit('waitingForOpponent', { message: 'Waiting for an opponent...' });
      }
    });

    // Start game (white player starts)
    socket.on('startGame', (gameId) => {
      const game = games[gameId];

      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      if (socket.id !== game.white.id) {
        socket.emit('error', { message: 'Only white player can start the game' });
        return;
      }

      game.status = 'active';
      game.lastMoveTime = new Date();
      io.to(gameId).emit('gameStarted', { gameId, turn: 'white' });
    });

    // Player makes a move
    socket.on('makeMove', ({ gameId, move }) => {
      const game = games[gameId];

      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Check if it's player's turn
      const playerColor = game.white.id === socket.id ? 'white' : 'black';
      if (game.turn !== playerColor) {
        socket.emit('error', { message: "It's not your turn" });
        return;
      }

      // Add move to game history
      game.moves.push({
        ...move,
        timestamp: new Date()
      });

      // Switch turns
      game.turn = game.turn === 'white' ? 'black' : 'white';
      game.lastMoveTime = new Date();

      // Broadcast move to both players
      io.to(gameId).emit('moveMade', {
        gameId,
        move,
        turn: game.turn,
        by: playerColor
      });
    });

    // Request to resign
    socket.on('resign', (gameId) => {
      const game = games[gameId];

      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      const playerColor = game.white.id === socket.id ? 'white' : 'black';
      const winner = playerColor === 'white' ? 'black' : 'white';

      game.status = 'finished';
      game.winner = winner;
      game.endTime = new Date();
      game.endReason = 'resignation';

      io.to(gameId).emit('gameOver', {
        gameId,
        winner,
        reason: 'resignation'
      });
    });

    // Handle disconnections
    socket.on('disconnect', () => {
      console.log('Game server: User disconnected:', socket.id);

      // Remove from waiting list
      waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);

      // Check if player was in a game
      Object.entries(games).forEach(([gameId, game]) => {
        if (game.white.id === socket.id || game.black.id === socket.id) {
          const playerColor = game.white.id === socket.id ? 'white' : 'black';
          const opponentColor = playerColor === 'white' ? 'black' : 'white';

          // Only handle if game is still active
          if (game.status === 'active' || game.status === 'waiting') {
            // Notify opponent
            io.to(gameId).emit('playerDisconnected', {
              gameId,
              player: playerColor,
              message: `${game[playerColor].name} has disconnected`
            });

            // Mark game as finished
            game.status = 'finished';
            game.winner = opponentColor;
            game.endTime = new Date();
            game.endReason = 'disconnection';
          }
        }
      });
    });
  });

  console.log('Game server initialized');
  return io;
}

/**
 * Get all active games
 * @returns {Array} Array of game objects
 */
function getActiveGames() {
  return Object.values(games).filter(game => game.status === 'active');
}

/**
 * Get a specific game by ID
 * @param {string} gameId - ID of the game to retrieve
 * @returns {Object|null} Game object or null if not found
 */
function getGameById(gameId) {
  return games[gameId] || null;
}

module.exports = {
  initGameServer,
  getActiveGames,
  getGameById
};
