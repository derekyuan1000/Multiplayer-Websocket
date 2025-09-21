const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Create single HTTP server for both web and WebSocket
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
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
    status: 'available', // available, waiting, in-game, time-control
    gameId: null,
    players: [],
    timeControl: null // Will store selected time control
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

  // Player selects time control (only white player can do this)
  socket.on('selectTimeControl', ({ serverId, timeControl }) => {
    if (!socket.playerName || !socket.currentServer) {
      socket.emit('error', { message: 'Please select a server first' });
      return;
    }

    const server = serverLobbies[serverId];
    if (!server || socket.currentServer !== serverId) {
      socket.emit('error', { message: 'Invalid server or not in this server' });
      return;
    }

    // Only white player can select time control
    if (!server.white || server.white.id !== socket.id) {
      socket.emit('error', { message: 'Only white player can select time control' });
      return;
    }

    // Must have both players
    if (!server.black) {
      socket.emit('error', { message: 'Need both players before selecting time control' });
      return;
    }

    console.log(`Player ${socket.playerName} selected time control in server ${serverId}:`, timeControl);

    // Set time control
    server.timeControl = timeControl;
    server.status = 'time-control';

    // Broadcast updated server status
    io.emit('serverLobbies', serverLobbies);

    // Send time control details to both players in this server
    server.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('timeControlSelected', { serverId, server, timeControl });
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

  // Start game with time control
  socket.on('startGameWithTime', (serverId) => {
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

    if (!server.timeControl) {
      socket.emit('error', { message: 'Please select time control first' });
      return;
    }

    // Create game with time control
    const gameId = `game_${serverId}_${Date.now()}`;
    const timeControlMs = server.timeControl.minutes * 60 * 1000; // Convert to milliseconds
    const incrementMs = server.timeControl.increment * 1000; // Convert to milliseconds

    games[gameId] = {
      id: gameId,
      serverId: serverId,
      white: server.white,
      black: server.black,
      moves: [],
      status: 'active',
      turn: 'white',
      startTime: new Date(),
      timeControl: server.timeControl,
      clocks: {
        white: timeControlMs,
        black: timeControlMs
      },
      increment: incrementMs,
      lastMoveTime: new Date()
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
      turn: 'white',
      timeControl: server.timeControl,
      clocks: games[gameId].clocks
    });

    // Broadcast updated server status
    io.emit('serverLobbies', serverLobbies);

    console.log(`Game started in server ${serverId} with time control: ${server.timeControl.name} - ${server.white.name} vs ${server.black.name}`);
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

    // Calculate time used if game has time control
    if (game.clocks && game.lastMoveTime) {
      const currentTime = new Date();
      const timeUsed = currentTime - game.lastMoveTime;

      // Subtract time used from current player's clock
      game.clocks[playerColor] -= timeUsed;

      // Add increment for the move just made
      if (game.increment && game.moves.length > 0) { // No increment for first move
        game.clocks[playerColor] += game.increment;
      }

      // Check for time forfeit
      if (game.clocks[playerColor] <= 0) {
        game.status = 'finished';
        game.winner = playerColor === 'white' ? 'black' : 'white';
        game.endTime = new Date();
        game.endReason = 'time';

        // Notify both players
        io.to(gameId).emit('gameEnded', {
          gameId: game.id,
          winner: game.winner,
          reason: 'time',
          message: `${playerColor === 'white' ? game.white.name : game.black.name} ran out of time. ${game.winner === 'white' ? game.white.name : game.black.name} wins!`
        });
        return;
      }

      game.lastMoveTime = currentTime;
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
      by: playerColor,
      clocks: game.clocks || null
    });
  });

  // Handle player leaving to lobby during game
  socket.on('leaveToLobby', () => {
    if (!socket.playerName) {
      return;
    }

    console.log(`Player ${socket.playerName} is leaving to lobby`);

    // Check if player is in an active game
    Object.values(serverLobbies).forEach(server => {
      if (server.status === 'in-game' && server.gameId) {
        const game = games[server.gameId];

        if (game && game.status === 'active') {
          const isWhitePlayer = server.white && server.white.id === socket.id;
          const isBlackPlayer = server.black && server.black.id === socket.id;

          if (isWhitePlayer || isBlackPlayer) {
            const leavingColor = isWhitePlayer ? 'white' : 'black';
            const winningColor = isWhitePlayer ? 'black' : 'white';
            const opponent = isWhitePlayer ? server.black : server.white;

            // End the game - opponent wins by resignation
            game.status = 'finished';
            game.winner = winningColor;
            game.endTime = new Date();
            game.endReason = 'resignation';

            console.log(`Game ${game.id}: ${leavingColor} resigned, ${winningColor} wins`);

            // Notify the opponent they won
            if (opponent) {
              const opponentSocket = io.sockets.sockets.get(opponent.id);
              if (opponentSocket) {
                opponentSocket.emit('gameEnded', {
                  gameId: game.id,
                  winner: winningColor,
                  reason: 'resignation',
                  message: `${socket.playerName} has resigned. You win!`
                });
              }
            }

            // Reset server status
            server.status = 'available';
            server.white = null;
            server.black = null;
            server.gameId = null;
            server.players = [];

            // Broadcast updated server status
            io.emit('serverLobbies', serverLobbies);
          }
        }
      }
    });
  });

  // Handle player leaving a lobby (before game starts)
  socket.on('leaveLobby', () => {
    if (!socket.playerName) {
      return;
    }

    console.log(`Player ${socket.playerName} is leaving lobby`);

    // Remove player from any servers they're currently in
    Object.values(serverLobbies).forEach(server => {
      // Remove from white slot
      if (server.white && server.white.id === socket.id) {
        console.log(`Removing ${socket.playerName} from white slot in server ${server.id}`);
        server.white = null;

        // Update server status
        if (!server.black && server.status !== 'in-game') {
          server.status = 'available';
        } else if (server.black && server.status !== 'in-game') {
          server.status = 'waiting';
        }
      }

      // Remove from black slot
      if (server.black && server.black.id === socket.id) {
        console.log(`Removing ${socket.playerName} from black slot in server ${server.id}`);
        server.black = null;

        // Update server status
        if (!server.white && server.status !== 'in-game') {
          server.status = 'available';
        } else if (server.white && server.status !== 'in-game') {
          server.status = 'waiting';
        }
      }

      // Remove from players list
      const initialPlayerCount = server.players.length;
      server.players = server.players.filter(p => p.id !== socket.id);

      if (server.players.length !== initialPlayerCount) {
        console.log(`Removed ${socket.playerName} from players list in server ${server.id}`);
      }
    });

    // Clear the player's current server
    socket.currentServer = null;

    // Broadcast updated server status to all players
    io.emit('serverLobbies', serverLobbies);
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('Game server: User disconnected:', socket.id);

    // Remove player from all servers and handle game resignation
    Object.values(serverLobbies).forEach(server => {
      if (server.white && server.white.id === socket.id) {
        // If player was in an active game, end it
        if (server.status === 'in-game' && server.gameId) {
          const game = games[server.gameId];
          if (game && game.status === 'active') {
            game.status = 'finished';
            game.winner = 'black';
            game.endTime = new Date();
            game.endReason = 'disconnection';

            // Notify black player they won
            if (server.black) {
              const blackSocket = io.sockets.sockets.get(server.black.id);
              if (blackSocket) {
                blackSocket.emit('gameEnded', {
                  gameId: game.id,
                  winner: 'black',
                  reason: 'disconnection',
                  message: `${socket.playerName} has disconnected. You win!`
                });
              }
            }
          }
        }

        server.white = null;
        if (!server.black) server.status = 'available';
        else if (server.status !== 'in-game') server.status = 'waiting';
      }

      if (server.black && server.black.id === socket.id) {
        // If player was in an active game, end it
        if (server.status === 'in-game' && server.gameId) {
          const game = games[server.gameId];
          if (game && game.status === 'active') {
            game.status = 'finished';
            game.winner = 'white';
            game.endTime = new Date();
            game.endReason = 'disconnection';

            // Notify white player they won
            if (server.white) {
              const whiteSocket = io.sockets.sockets.get(server.white.id);
              if (whiteSocket) {
                whiteSocket.emit('gameEnded', {
                  gameId: game.id,
                  winner: 'white',
                  reason: 'disconnection',
                  message: `${socket.playerName} has disconnected. You win!`
                });
              }
            }
          }
        }

        server.black = null;
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

// Configure ports - Use Render's PORT environment variable
const WEB_PORT = process.env.PORT || 3000;
const GAME_PORT = process.env.GAME_PORT || (process.env.PORT || 3002);

// Start single server (Render only allows one port)
server.listen(WEB_PORT, () => {
  console.log(`Server running on port ${WEB_PORT}`);
});

// Log server info
console.log('------------------------------------');
console.log('Server started successfully');
console.log(`Running on port: ${WEB_PORT}`);
console.log('------------------------------------');
