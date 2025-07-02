const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const net = require('net');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Game servers storage
const gameServers = {};

// Track all connected users
const connectedUsers = new Map(); // Map of socket.id -> user info

// Create some initial game servers
for (let i = 1; i <= 5; i++) {
  gameServers[`server-${i}`] = {
    id: `server-${i}`,
    name: `Chess Server ${i}`,
    whitePlayer: null,
    blackPlayer: null,
    maxPlayers: 2,
    games: {},
    gameStarted: false
  };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Send the list of available servers to the new client
  socket.emit('serverList', Object.values(gameServers));

  // Send current online users to the new client
  socket.emit('onlineUsers', Array.from(connectedUsers.values()));

  // Handle user setting their name
  socket.on('setUserName', (userName) => {
    // Add or update user in connected users
    connectedUsers.set(socket.id, {
      id: socket.id,
      name: userName,
      connectedAt: new Date(),
      status: 'online' // online, in-game, etc.
    });

    // Broadcast updated user list to all clients
    io.emit('onlineUsers', Array.from(connectedUsers.values()));

    // Also send server list to the user after they set their name
  });

  // Handle player joining a server
  socket.on('joinServer', (serverId, playerName) => {
    const server = gameServers[serverId];

    if (!server) {
      return socket.emit('serverError', 'Server not found');
    }

    if (server.gameStarted) {
      return socket.emit('serverError', 'Game already in progress');
    }

    // Update user status to in-game
    if (connectedUsers.has(socket.id)) {
      connectedUsers.get(socket.id).status = 'in-game';
      connectedUsers.get(socket.id).serverId = serverId;
    }

    // Create player object
    const player = {
      id: socket.id,
      name: playerName || `Player ${socket.id.substr(0, 5)}`,
      joinedAt: new Date()
    };

    // Add player to server
    if (!server.whitePlayer) {
      server.whitePlayer = player;
    } else if (!server.blackPlayer) {
      server.blackPlayer = player;
    } else {
      return socket.emit('serverError', 'Server is full');
    }

    // Join the server's room
    socket.join(serverId);

    // Notify the player they've joined
    socket.emit('joinedServer', server);

    // Notify all clients about the updated server
    io.emit('serverUpdated', server);
  });

  // Handle player joining a server with specific color preference
  socket.on('joinServerAsColor', (serverId, playerName, preferredColor) => {
    const server = gameServers[serverId];

    if (!server) {
      return socket.emit('serverError', 'Server not found');
    }

    if (server.gameStarted) {
      return socket.emit('serverError', 'Game already in progress');
    }

    // Update user status to in-game
    if (connectedUsers.has(socket.id)) {
      connectedUsers.get(socket.id).status = 'in-game';
      connectedUsers.get(socket.id).serverId = serverId;
    }

    // Create player object
    const player = {
      id: socket.id,
      name: playerName || `Player ${socket.id.substr(0, 5)}`,
      joinedAt: new Date()
    };

    // Remove player from any existing slot first
    if (server.whitePlayer && server.whitePlayer.id === socket.id) {
      server.whitePlayer = null;
    }
    if (server.blackPlayer && server.blackPlayer.id === socket.id) {
      server.blackPlayer = null;
    }

    // Try to assign to preferred color
    if (preferredColor === 'white') {
      if (!server.whitePlayer) {
        server.whitePlayer = player;
      } else if (server.whitePlayer.id === socket.id) {
        server.whitePlayer = player; // Player is already white, just update
      } else {
        return socket.emit('serverError', 'White slot is already taken');
      }
    } else if (preferredColor === 'black') {
      if (!server.blackPlayer) {
        server.blackPlayer = player;
      } else if (server.blackPlayer.id === socket.id) {
        server.blackPlayer = player; // Player is already black, just update
      } else {
        return socket.emit('serverError', 'Black slot is already taken');
      }
    }

    // Join the server's room
    socket.join(serverId);

    // Notify the player they've joined
    socket.emit('joinedServer', server);

    // Notify all clients about the updated server
    io.emit('serverUpdated', server);
  });

  // Handle chess move
  socket.on('makeMove', (serverId, gameId, move) => {
    const server = gameServers[serverId];

    if (!server || !server.games[gameId]) {
      return socket.emit('gameError', 'Game not found');
    }

    const game = server.games[gameId];
    let playerColor = null;

    // Determine player color based on socket ID
    if (game.whitePlayer.id === socket.id) {
      playerColor = 'white';
    } else if (game.blackPlayer.id === socket.id) {
      playerColor = 'black';
    } else {
      return socket.emit('gameError', 'Player not in this game');
    }

    if (game.currentTurn !== playerColor) {
      return socket.emit('gameError', 'Not your turn');
    }

    // Calculate time spent on this move
    const now = new Date();
    const timeSpent = Math.floor((now - new Date(game.timeControl.lastMoveTime)) / 1000);

    // Update the current player's time
    if (playerColor === 'white') {
      game.timeControl.whiteTimeRemaining = Math.max(0, game.timeControl.whiteTimeRemaining - timeSpent);
      // Add increment
      game.timeControl.whiteTimeRemaining += game.timeControl.increment;
    } else {
      game.timeControl.blackTimeRemaining = Math.max(0, game.timeControl.blackTimeRemaining - timeSpent);
      // Add increment
      game.timeControl.blackTimeRemaining += game.timeControl.increment;
    }

    // Update last move timef
    game.timeControl.lastMoveTime = now;

    // Add the move to the game with additional check/checkmate info
    game.moves.push({
      player: playerColor,
      move,
      inCheck: move.inCheck,
      isCheckmate: move.isCheckmate,
      timestamp: now
    });

    // Switch turns
    game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';

    // Update game status if checkmate
    if (move.isCheckmate) {
      game.status = 'ended';
      game.endReason = 'checkmate';
      game.winner = playerColor;
      game.endedAt = new Date();
    }

    // Broadcast the move to both players
    io.to(serverId).emit('moveMade', game);

    // If game ended, notify about the result
    if (move.isCheckmate) {
      io.to(serverId).emit('gameEnded', game);
    }
  });

  // Handle game start request (only white player can start)
  socket.on('startGame', (serverId, timeControl) => {
    const server = gameServers[serverId];

    if (!server) {
      return socket.emit('serverError', 'Server not found');
    }

    if (server.gameStarted) {
      return socket.emit('serverError', 'Game already started');
    }

    if (!server.whitePlayer || server.whitePlayer.id !== socket.id) {
      return socket.emit('serverError', 'Only the white player can start the game');
    }

    if (!server.blackPlayer) {
      return socket.emit('serverError', 'Waiting for black player to join');
    }

    // Validate time control
    if (!timeControl || !timeControl.minutes || timeControl.minutes < 1 || timeControl.minutes > 180) {
      return socket.emit('serverError', 'Invalid time control: minutes must be between 1 and 180');
    }

    if (timeControl.increment < 0 || timeControl.increment > 60) {
      return socket.emit('serverError', 'Invalid time control: increment must be between 0 and 60 seconds');
    }

    const gameId = uuidv4();
    const whitePlayer = server.whitePlayer;
    const blackPlayer = server.blackPlayer;

    // Create a new game with time control
    const game = {
      id: gameId,
      whitePlayer,
      blackPlayer,
      moves: [],
      currentTurn: 'white',
      status: 'active',
      timeControl: {
        minutes: timeControl.minutes,
        increment: timeControl.increment,
        whiteTimeRemaining: timeControl.minutes * 60, // Convert to seconds
        blackTimeRemaining: timeControl.minutes * 60, // Convert to seconds
        lastMoveTime: new Date()
      },
      startedAt: new Date()
    };

    server.games[gameId] = game;
    server.gameStarted = true;

    // Update both players' status to in-game
    [whitePlayer.id, blackPlayer.id].forEach(playerId => {
      if (connectedUsers.has(playerId)) {
        connectedUsers.get(playerId).status = 'in-game';
      }
    });

    // Notify players that a game has started
    io.to(serverId).emit('gameStarted', game);

    // Broadcast updated server list
    io.emit('serverUpdated', server);
    io.emit('onlineUsers', Array.from(connectedUsers.values()));
  });

  // Handle resign
  socket.on('resign', (serverId, gameId) => {
    const server = gameServers[serverId];

    if (!server || !server.games[gameId]) {
      return socket.emit('gameError', 'Game not found');
    }

    const game = server.games[gameId];

    // Determine the winner (opposite of the resigning player)
    const winner = socket.id === game.whitePlayer.id ? 'black' : 'white';

    // Update game status
    game.status = 'ended';
    game.endReason = 'resignation';
    game.winner = winner;
    game.endedAt = new Date();

    // Notify both players about the game end
    io.to(serverId).emit('gameEnded', game);
  });

  // Handle timeout
  socket.on('timeOut', (serverId, gameId, color) => {
    const server = gameServers[serverId];

    if (!server || !server.games[gameId]) {
      return socket.emit('gameError', 'Game not found');
    }

    const game = server.games[gameId];

    // End the game due to timeout
    game.status = 'ended';
    game.endReason = 'timeout';
    game.winner = color === 'white' ? 'black' : 'white';
    game.endedAt = new Date();

    // Notify both players about the timeout
    io.to(serverId).emit('gameEnded', game);
  });

  // Handle player leaving (disconnecting)
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Remove user from connected users
    connectedUsers.delete(socket.id);

    // Find which server the player was in
    for (const serverId in gameServers) {
      const server = gameServers[serverId];

      // Check if player was white or black
      if (server.whitePlayer && server.whitePlayer.id === socket.id) {
        server.whitePlayer = null;
        server.gameStarted = false;

        // End any active games
        for (const gameId in server.games) {
          const game = server.games[gameId];
          game.status = 'ended';
          game.endReason = 'playerDisconnected';
          game.endedAt = new Date();

          // Notify the remaining player
          io.to(serverId).emit('gameEnded', game);
        }

        // Clear games
        server.games = {};

        // Notify all clients about the updated server
        io.emit('serverUpdated', server);
        break;
      } else if (server.blackPlayer && server.blackPlayer.id === socket.id) {
        server.blackPlayer = null;
        server.gameStarted = false;

        // End any active games
        for (const gameId in server.games) {
          const game = server.games[gameId];
          game.status = 'ended';
          game.endReason = 'playerDisconnected';
          game.endedAt = new Date();

          // Notify the remaining player
          io.to(serverId).emit('gameEnded', game);
        }

        // Clear games
        server.games = {};

        // Notify all clients about the updated server
        io.emit('serverUpdated', server);
        break;
      }
    }

    // Broadcast updated user list to all remaining clients
    io.emit('onlineUsers', Array.from(connectedUsers.values()));
  });
});

// Function to check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port);
  });
}

// Start the server with fallback ports
async function startServer() {
  const BASE_PORT = process.env.PORT || 3000;
  let port = BASE_PORT;

  // Try up to 10 ports starting from the base port
  for (let i = 0; i < 10; i++) {
    const portInUse = await isPortInUse(port);
    if (!portInUse) {
      server.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
      });
      return;
    }

    console.log(`Port ${port} is in use, trying port ${port + 1}...`);
    port++;
  }

  console.error('Could not find an available port after multiple attempts');
}

// Use the new function to start the server
startServer();
