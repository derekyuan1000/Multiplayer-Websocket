const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

// Create Express app for web server
const app = express();
const webServer = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Create a dedicated server for WebSocket
const gameServer = http.createServer();
const io = new Server(gameServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game state
let games = {};
let waitingPlayers = [];

// Multiple server lobbies (1-6)
let serverLobbies = {};
for (let i = 1; i <= 6; i++) {
  serverLobbies[i] = {
    id: i,
    white: null,
    black: null,
    status: 'available', // available, waiting, in-game
    gameId: null,
    players: []
  };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Game server: User connected:', socket.id);

  // Player joins with name
  socket.on('registerPlayer', (playerName) => {
    socket.playerName = playerName;
    console.log(`Game server: Player registered: ${playerName} (${socket.id})`);
    socket.emit('registered', { id: socket.id, name: playerName });

    // Send current server lobby status to the new player
    socket.emit('serverLobbies', serverLobbies);
  });

  // Player selects a server
  socket.on('selectServer', (serverId) => {
    if (!socket.playerName) {
      socket.emit('error', { message: 'Please register your name first' });
      return;
    }

    const server = serverLobbies[serverId];
    if (!server) {
      socket.emit('error', { message: 'Invalid server selected' });
      return;
    }

    // Remove player from any other servers they might be in
    Object.values(serverLobbies).forEach(lobby => {
      if (lobby.white && lobby.white.id === socket.id) {
        lobby.white = null;
        if (!lobby.black) lobby.status = 'available';
      }
      if (lobby.black && lobby.black.id === socket.id) {
        lobby.black = null;
        if (!lobby.white) lobby.status = 'available';
      }
      lobby.players = lobby.players.filter(p => p.id !== socket.id);
    });

    // Add player to selected server
    socket.currentServer = serverId;
    server.players.push({ id: socket.id, name: socket.playerName });

    console.log(`Player ${socket.playerName} joined server ${serverId}`);

    // Broadcast updated server status
    io.emit('serverLobbies', serverLobbies);

    // Send server details to the player
    socket.emit('serverSelected', { serverId, server });
  });

  // Player selects color within a server
  socket.on('selectColor', ({ serverId, color }) => {
    if (!socket.playerName || !socket.currentServer) {
      socket.emit('error', { message: 'Please select a server first' });
      return;
    }

    const server = serverLobbies[serverId];
    if (!server || socket.currentServer !== serverId) {
      socket.emit('error', { message: 'Invalid server or not in this server' });
      return;
    }

    // Check if color is already taken
    if (server[color]) {
      socket.emit('error', { message: `${color} is already taken` });
      return;
    }

    console.log(`Player ${socket.playerName} selected ${color} in server ${serverId}`);

    // Remove player from any other color in this server
    if (server.white && server.white.id === socket.id) {
      server.white = null;
    }
    if (server.black && server.black.id === socket.id) {
      server.black = null;
    }

    // Assign player to the selected color
    server[color] = {
      id: socket.id,
      name: socket.playerName
    };

    // Update server status
    if (server.white && server.black) {
      server.status = 'ready'; // Both colors selected, ready to start
    } else {
      server.status = 'waiting'; // Waiting for opponent
    }

    // Broadcast updated server status
    io.emit('serverLobbies', serverLobbies);

    // Send updated server details to all players in this server
    server.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('serverSelected', { serverId, server });
      }
    });
  });

  // Start game in a server (white player starts)
  socket.on('startGame', (serverId) => {
    const server = serverLobbies[serverId];

    if (!server) {
      socket.emit('error', { message: 'Server not found' });
      return;
    }

    if (!server.white || server.white.id !== socket.id) {
      socket.emit('error', { message: 'Only white player can start the game' });
      return;
    }

    if (!server.black) {
      socket.emit('error', { message: 'Waiting for black player' });
      return;
    }

    // Create game
    const gameId = `game_${serverId}_${Date.now()}`;
    games[gameId] = {
      id: gameId,
      serverId: serverId,
      white: server.white,
      black: server.black,
      moves: [],
      status: 'active',
      turn: 'white',
      startTime: new Date()
    };

    server.gameId = gameId;
    server.status = 'in-game';

    // Join both players to game room
    const whiteSocket = io.sockets.sockets.get(server.white.id);
    const blackSocket = io.sockets.sockets.get(server.black.id);

    if (whiteSocket) whiteSocket.join(gameId);
    if (blackSocket) blackSocket.join(gameId);

    // Notify both players
    io.to(gameId).emit('gameStarted', {
      gameId,
      serverId,
      white: server.white,
      black: server.black,
      turn: 'white'
    });

    // Broadcast updated server status
    io.emit('serverLobbies', serverLobbies);

    console.log(`Game started in server ${serverId}: ${server.white.name} vs ${server.black.name}`);
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

    // Broadcast move to both players
    io.to(gameId).emit('moveMade', {
      gameId,
      move,
      turn: game.turn,
      by: playerColor
    });
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('Game server: User disconnected:', socket.id);

    // Remove player from all servers
    Object.values(serverLobbies).forEach(server => {
      if (server.white && server.white.id === socket.id) {
        server.white = null;
        if (server.status === 'in-game') {
          // Notify other player of disconnection
          if (server.black) {
            const blackSocket = io.sockets.sockets.get(server.black.id);
            if (blackSocket) {
              blackSocket.emit('playerDisconnected', {
                message: `${socket.playerName} has disconnected`
              });
            }
          }
        }
        if (!server.black) server.status = 'available';
        else if (server.status !== 'in-game') server.status = 'waiting';
      }

      if (server.black && server.black.id === socket.id) {
        server.black = null;
        if (server.status === 'in-game') {
          // Notify other player of disconnection
          if (server.white) {
            const whiteSocket = io.sockets.sockets.get(server.white.id);
            if (whiteSocket) {
              whiteSocket.emit('playerDisconnected', {
                message: `${socket.playerName} has disconnected`
              });
            }
          }
        }
        if (!server.white) server.status = 'available';
        else if (server.status !== 'in-game') server.status = 'waiting';
      }

      server.players = server.players.filter(p => p.id !== socket.id);

      // Reset server if no players
      if (server.players.length === 0) {
        server.status = 'available';
        server.gameId = null;
      }
    });

    // Broadcast updated server status
    io.emit('serverLobbies', serverLobbies);
  });
});

// Configure ports
const WEB_PORT = process.env.WEB_PORT || 3000;
const GAME_PORT = process.env.GAME_PORT || 3002;

// Start the servers
webServer.listen(WEB_PORT, () => {
  console.log(`Web server running on http://localhost:${WEB_PORT}`);
});

gameServer.listen(GAME_PORT, () => {
  console.log(`Game WebSocket server running on ws://localhost:${GAME_PORT}`);
});

// Log server info
console.log('------------------------------------');
console.log('All servers started successfully:');
console.log('- Web Server: http://localhost:3000');
console.log('- Game WebSocket Server: ws://localhost:3002');
console.log('Open your browser to: http://localhost:3000');
console.log('------------------------------------');
