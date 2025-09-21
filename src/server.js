const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 3000;

// Game state
let games = {};
let waitingPlayers = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Player joins with name
  socket.on('registerPlayer', (playerName) => {
    socket.playerName = playerName;
    console.log(`Player registered: ${playerName} (${socket.id})`);
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
        turn: 'white'
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
      
      console.log(`Game created: ${gameId} - White: ${whitePlayer.name}, Black: ${blackPlayer.name}`);
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
    game.moves.push(move);
    
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
    console.log('User disconnected:', socket.id);
    
    // Remove from waiting list
    waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);
    
    // Check if player was in a game
    Object.entries(games).forEach(([gameId, game]) => {
      if (game.white.id === socket.id || game.black.id === socket.id) {
        const playerColor = game.white.id === socket.id ? 'white' : 'black';
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        
        // Notify opponent
        io.to(gameId).emit('playerDisconnected', {
          gameId,
          player: playerColor,
          message: `${socket[playerColor + 'Name']} has disconnected`
        });
        
        // Mark game as finished
        game.status = 'finished';
        game.winner = opponentColor;
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
