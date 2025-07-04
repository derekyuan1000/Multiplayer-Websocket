document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const loginSection = document.getElementById('login-section');
  const gameSelectionSection = document.getElementById('game-selection-section');
  const stockfishLobbySection = document.getElementById('stockfish-lobby-section');
  const serverSection = document.getElementById('server-section');
  const lobbySection = document.getElementById('lobby-section');
  const gameSection = document.getElementById('game-section');
  const playerNameInput = document.getElementById('player-name');
  const loginButton = document.getElementById('login-button');
  const serverList = document.getElementById('server-list');
  const gameStatus = document.getElementById('game-status');
  const whitePlayerElement = document.getElementById('white-player').querySelector('span');
  const blackPlayerElement = document.getElementById('black-player').querySelector('span');
  const leaveGameButton = document.getElementById('leave-game');
  const resignButton = document.getElementById('resign-game');

  // Stockfish lobby elements
  const leaveStockfishLobbyButton = document.getElementById('leave-stockfish-lobby');
  const startStockfishGameButton = document.getElementById('start-stockfish-game');
  const stockfishStatus = document.getElementById('stockfish-status');

  // Online users elements
  const onlineUsersList = document.getElementById('online-users-list');
  const serverOnlineUsersList = document.getElementById('server-online-users-list');
  const lobbyOnlineUsersList = document.getElementById('lobby-online-users-list');

  // Lobby elements
  const lobbyServerName = document.getElementById('lobby-server-name');
  const leaveLobbyButton = document.getElementById('leave-lobby');
  const joinWhiteButton = document.getElementById('join-white');
  const joinBlackButton = document.getElementById('join-black');
  const whitePlayerInfo = document.getElementById('white-player-info');
  const blackPlayerInfo = document.getElementById('black-player-info');
  const startGameButton = document.getElementById('start-game-btn');
  const lobbyStatus = document.getElementById('lobby-status');

  // Time control elements
  const timeControlSection = document.getElementById('time-control-section');
  const customTimeInputs = document.getElementById('custom-time-inputs');
  const customRadio = document.getElementById('custom');
  const customMinutes = document.getElementById('custom-minutes');
  const customIncrement = document.getElementById('custom-increment');

  // Time display elements
  const whiteTimeDisplay = document.getElementById('white-time');
  const blackTimeDisplay = document.getElementById('black-time');
  const whiteTimeControl = document.querySelector('.white-time');
  const blackTimeControl = document.querySelector('.black-time');

  // Chat elements
  const chatContainer = document.getElementById('chat-container');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendChatButton = document.getElementById('send-chat-button');
  const toggleChatButton = document.getElementById('toggle-chat-button');

  // Game selection elements
  const gameCards = document.querySelectorAll('.game-card');
  const selectGameButtons = document.querySelectorAll('.select-game-btn');

  // Game state
  let playerName = '';
  let currentServerId = null;
  let currentGameId = null;
  let playerColor = null;
  let chessGame = null;
  let isWhitePlayer = false;
  let selectedGame = null;

  // Time control state
  let gameTimeControl = null;
  let whiteTimeRemaining = 0;
  let blackTimeRemaining = 0;
  let timeInterval = null;
  let lastMoveTime = null;

  // Connect to Socket.IO server
  const socket = io({
    transports: ['websocket', 'polling'],
    path: '/socket.io/'
  });

  // Socket.IO event handlers
  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
  });

  socket.on('serverList', (servers) => {
    renderServerList(servers);
  });

  socket.on('onlineUsers', (users) => {
    renderOnlineUsers(users);
  });

  socket.on('joinedServer', (server) => {
    currentServerId = server.id;
    lobbyServerName.textContent = server.name;
    updateLobbyDisplay(server);
    showSection(lobbySection);
  });

  socket.on('serverError', (errorMessage) => {
    alert(`Server error: ${errorMessage}`);
  });

  socket.on('gameStarted', (game) => {
    currentGameId = game.id;

    // Initialize time control
    gameTimeControl = game.timeControl;
    whiteTimeRemaining = gameTimeControl.whiteTimeRemaining;
    blackTimeRemaining = gameTimeControl.blackTimeRemaining;
    lastMoveTime = new Date(game.timeControl.lastMoveTime);

    // Update time displays
    updateTimeDisplay();

    // Start the timer
    startTimer();

    // Determine player color
    if (game.whitePlayer.id === socket.id) {
      playerColor = 'white';
      whitePlayerElement.textContent = `${game.whitePlayer.name} (You)`;
      blackPlayerElement.textContent = game.blackPlayer.name;
      isWhitePlayer = true;
    } else {
      playerColor = 'black';
      whitePlayerElement.textContent = game.whitePlayer.name;
      blackPlayerElement.textContent = `${game.blackPlayer.name} (You)`;
      isWhitePlayer = false;

      // Flip time controls for black player
      const timeControlsContainer = document.getElementById('time-controls-container');
      timeControlsContainer.classList.add('flipped');
    }

    gameStatus.textContent = 'Game started!';

    // Initialize chess game with the player's color
    chessGame = new ChessGame(playerColor);
    chessGame.onMove = (move) => {
      socket.emit('makeMove', currentServerId, currentGameId, move);
    };

    // Show resign button
    resignButton.classList.remove('hidden');

    // Transition to the game section
    showSection(gameSection);
  });

  socket.on('moveMade', (game) => {
    if (!chessGame) return;

    // Update time control state from server
    if (game.timeControl) {
      whiteTimeRemaining = game.timeControl.whiteTimeRemaining;
      blackTimeRemaining = game.timeControl.blackTimeRemaining;
      lastMoveTime = new Date(game.timeControl.lastMoveTime);
      updateTimeDisplay();
    }

    // Get the last move made
    const lastMove = game.moves[game.moves.length - 1];

    // Apply the move if it's from the other player
    if (lastMove.player !== playerColor) {
      // Extract the actual move data from the lastMove object
      const moveData = lastMove.move || lastMove;
      chessGame.applyRemoteMove(moveData);
    }
  });

  socket.on('gameEnded', (game) => {
    let message = 'Game ended: ';

    if (game.endReason === 'playerDisconnected') {
      message += 'Opponent disconnected';
    } else if (game.endReason === 'resignation') {
      message += `${game.winner === 'white' ? 'Black' : 'White'} resigned`;
    } else {
      message += game.endReason;
    }

    gameStatus.textContent = message;

    // Stop the timer when game ends
    stopTimer();

    // Disable the chessboard
    const chessboard = document.getElementById('chessboard');
    chessboard.style.pointerEvents = 'none';
    chessboard.style.opacity = '0.7';

    // Hide resign button
    resignButton.classList.add('hidden');

    // Show analyze button when game ends
    if (chessGame) {
      chessGame.showAnalyzeButton();
    }
  });

  socket.on('serverUpdated', (server) => {
    // Update the server in the server list
    const serverElement = document.querySelector(`[data-server-id="${server.id}"]`);
    if (serverElement) {
      const whiteCount = server.whitePlayer ? 1 : 0;
      const blackCount = server.blackPlayer ? 1 : 0;
      const totalPlayers = whiteCount + blackCount;

      const playersCount = serverElement.querySelector('.players-count');
      playersCount.textContent = `${totalPlayers}/2 players`;

      const joinButton = serverElement.querySelector('button');
      joinButton.disabled = server.gameStarted;
    }

    // Update lobby display if we're currently in this server's lobby
    if (currentServerId === server.id && !lobbySection.classList.contains('hidden')) {
      updateLobbyDisplay(server);
    }
  });

  // UI event handlers
  loginButton.addEventListener('click', () => {
    playerName = playerNameInput.value.trim();

    if (!playerName) {
      alert('Please enter your name');
      return;
    }

    // Send the user's name to the server
    socket.emit('setUserName', playerName);

    // Show game selection screen instead of directly going to server list
    showSection(gameSelectionSection);
  });

  // Game selection event handlers
  gameCards.forEach(card => {
    const gameType = card.getAttribute('data-game');
    const selectButton = card.querySelector('.select-game-btn');

    if (!selectButton.disabled) {
      selectButton.addEventListener('click', () => {
        selectedGame = gameType;

        if (gameType === 'chess') {
          // Request server list for chess
          socket.emit('serverList');
          showSection(serverSection);
        } else if (gameType === 'stockfish') {
          // Show Stockfish lobby for computer games
          showSection(stockfishLobbySection);
        } else {
          // For other games that are coming soon
          alert(`${gameType.charAt(0).toUpperCase() + gameType.slice(1)} is coming soon!`);
        }
      });
    }
  });

  // Stockfish lobby event handlers
  leaveStockfishLobbyButton.addEventListener('click', () => {
    showSection(gameSelectionSection);
  });

  startStockfishGameButton.addEventListener('click', () => {
    startStockfishGame();
  });

  function startStockfishGame() {
    // Get selected options
    const selectedColor = document.querySelector('input[name="playerColor"]:checked').value;
    const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
    const selectedTimeControl = document.querySelector('input[name="sfTimeControl"]:checked').value;

    // Determine player color
    let finalPlayerColor;
    if (selectedColor === 'random') {
      finalPlayerColor = Math.random() < 0.5 ? 'white' : 'black';
    } else {
      finalPlayerColor = selectedColor;
    }

    // Set up player info
    playerColor = finalPlayerColor;
    const computerColor = finalPlayerColor === 'white' ? 'black' : 'white';

    // Update UI
    if (finalPlayerColor === 'white') {
      whitePlayerElement.textContent = `${playerName} (You)`;
      blackPlayerElement.textContent = 'Stockfish';
    } else {
      whitePlayerElement.textContent = 'Stockfish';
      blackPlayerElement.textContent = `${playerName} (You)`;

      // Flip time controls for black player
      const timeControlsContainer = document.getElementById('time-controls-container');
      timeControlsContainer.classList.add('flipped');
    }

    gameStatus.textContent = 'Playing against Stockfish';

    // Initialize chess game
    chessGame = new ChessGame(finalPlayerColor);

    // Set up Stockfish
    if (chessGame.stockfish) {
      chessGame.stockfish.setSkillLevel(parseInt(selectedDifficulty));
    }

    // Override the onMove callback to handle Stockfish moves
    chessGame.onMove = (moveData) => {
      // Update the last move time for timer tracking
      if (whiteTimeRemaining > 0 || blackTimeRemaining > 0) {
        lastMoveTime = new Date();
      }

      // After player moves, get Stockfish's response
      if (chessGame.currentTurn !== playerColor) {
        setTimeout(() => {
          chessGame.playAgainstEngine();
        }, 500); // Small delay to make it feel more natural
      }
    };

    // Handle time control
    if (selectedTimeControl !== 'unlimited') {
      const [minutes, increment] = selectedTimeControl.split('+').map(num => parseInt(num));

      // Set up time control
      whiteTimeRemaining = minutes * 60;
      blackTimeRemaining = minutes * 60;
      lastMoveTime = new Date();

      // Show time controls
      const timeControlsContainer = document.getElementById('time-controls-container');
      timeControlsContainer.style.display = 'flex';

      updateTimeDisplay();
      startTimer();
    } else {
      // Hide time controls for unlimited games
      const timeControlsContainer = document.getElementById('time-controls-container');
      timeControlsContainer.style.display = 'none';
    }

    // Show resign button
    resignButton.classList.remove('hidden');

    // If computer plays white, make the first move
    if (finalPlayerColor === 'black') {
      setTimeout(() => {
        chessGame.playAgainstEngine();
      }, 1000);
    }

    // Transition to game section
    showSection(gameSection);
  }

  // Helper function to get selected time control
  function getSelectedTimeControl() {
    const selectedRadio = document.querySelector('input[name="timeControl"]:checked');

    if (selectedRadio.value === 'custom') {
      return {
        minutes: parseInt(customMinutes.value) || 10,
        increment: parseInt(customIncrement.value) || 5
      };
    } else {
      // Parse preset time controls (e.g., "3+2" -> {minutes: 3, increment: 2})
      const [minutes, increment] = selectedRadio.value.split('+').map(num => parseInt(num));
      return { minutes, increment };
    }
  }

  // Helper functions
  function renderServerList(servers) {
    serverList.innerHTML = '';

    servers.forEach(server => {
      const serverCard = document.createElement('div');
      serverCard.classList.add('server-card');
      serverCard.dataset.serverId = server.id;

      const whiteCount = server.whitePlayer ? 1 : 0;
      const blackCount = server.blackPlayer ? 1 : 0;
      const totalPlayers = whiteCount + blackCount;

      let statusText = 'Empty';
      if (server.gameStarted) {
        statusText = 'Game in progress';
      } else if (totalPlayers === 1) {
        statusText = 'Waiting for opponent';
      } else if (totalPlayers === 2) {
        statusText = 'Ready to start';
      }

      serverCard.innerHTML = `
        <h3>${server.name}</h3>
        <div class="server-info">
          <p class="players-count">${totalPlayers}/2 players</p>
          <p>${statusText}</p>
        </div>
        <button ${server.gameStarted ? 'disabled' : ''}>Join Server</button>
      `;

      const joinButton = serverCard.querySelector('button');
      joinButton.addEventListener('click', () => {
        currentServerId = server.id;
        socket.emit('joinServer', server.id, playerName);
      });

      serverList.appendChild(serverCard);
    });
  }

  function updateLobbyDisplay(server) {
    // Reset all slots
    joinWhiteButton.classList.remove('hidden');
    joinBlackButton.classList.remove('hidden');
    whitePlayerInfo.classList.add('hidden');
    blackPlayerInfo.classList.add('hidden');
    startGameButton.classList.add('hidden');
    timeControlSection.classList.add('hidden');

    // Update white slot
    if (server.whitePlayer) {
      joinWhiteButton.classList.add('hidden');
      whitePlayerInfo.classList.remove('hidden');
      whitePlayerInfo.querySelector('.player-name').textContent = server.whitePlayer.name;

      if (server.whitePlayer.id === socket.id) {
        whitePlayerInfo.querySelector('.player-status').textContent = '(You)';
        isWhitePlayer = true;
        playerColor = 'white';
      } else {
        whitePlayerInfo.querySelector('.player-status').textContent = '';
      }
    }

    // Update black slot
    if (server.blackPlayer) {
      joinBlackButton.classList.add('hidden');
      blackPlayerInfo.classList.remove('hidden');
      blackPlayerInfo.querySelector('.player-name').textContent = server.blackPlayer.name;

      if (server.blackPlayer.id === socket.id) {
        blackPlayerInfo.querySelector('.player-status').textContent = '(You)';
        isWhitePlayer = false;
        playerColor = 'black';
      } else {
        blackPlayerInfo.querySelector('.player-status').textContent = '';
      }
    }

    // Show time control section and start button if both players are present and current user is white
    if (server.whitePlayer && server.blackPlayer && isWhitePlayer) {
      timeControlSection.classList.remove('hidden');
      startGameButton.classList.remove('hidden');
      startGameButton.disabled = false;
      lobbyStatus.textContent = 'Select time control and click "Start Game" to begin.';
    } else if (server.whitePlayer && server.blackPlayer) {
      lobbyStatus.textContent = 'Waiting for white player to start the game...';
    } else {
      lobbyStatus.textContent = 'Waiting for players to join...';
    }
  }

  function renderOnlineUsers(users) {
    // Clear all lists first
    onlineUsersList.innerHTML = '';
    serverOnlineUsersList.innerHTML = '';
    lobbyOnlineUsersList.innerHTML = '';

    // Filter out current user and create user items
    const otherUsers = users.filter(user => user.id !== socket.id);

    if (otherUsers.length === 0) {
      onlineUsersList.innerHTML = '<p class="no-users">No other users online</p>';
      serverOnlineUsersList.innerHTML = '<p class="no-users">No other users online</p>';
      lobbyOnlineUsersList.innerHTML = '<p class="no-users">No other users online</p>';
      return;
    }

    // Populate all three lists with all users (since they're all on the same platform)
    otherUsers.forEach(user => {
      const userItem = document.createElement('div');
      userItem.classList.add('user-item');

      if (user.status === 'in-game') {
        userItem.classList.add('in-game');
      }

      userItem.innerHTML = `
        <span class="user-name">${user.name}</span>
        <span class="user-status ${user.status}">${user.status === 'in-game' ? 'In Game' : 'Online'}</span>
      `;

      // Add to all lists
      onlineUsersList.appendChild(userItem.cloneNode(true));
      serverOnlineUsersList.appendChild(userItem.cloneNode(true));
      lobbyOnlineUsersList.appendChild(userItem.cloneNode(true));
    });
  }

  function showSection(section) {
    // Hide all sections
    loginSection.classList.add('hidden');
    gameSelectionSection.classList.add('hidden');
    stockfishLobbySection.classList.add('hidden');
    serverSection.classList.add('hidden');
    lobbySection.classList.add('hidden');
    gameSection.classList.add('hidden');

    // Show the specified section
    section.classList.remove('hidden');
  }

  // Time control functions
  function startTimer() {
    if (timeInterval) {
      clearInterval(timeInterval);
    }

    timeInterval = setInterval(() => {
      // For Stockfish games, check if we have time remaining values set
      // For multiplayer games, check if gameTimeControl exists
      if (!chessGame || (!gameTimeControl && whiteTimeRemaining === 0 && blackTimeRemaining === 0)) return;

      const now = new Date();
      const timeSinceLastMove = Math.floor((now - lastMoveTime) / 1000);

      // Deduct time from the current player's clock
      if (chessGame.currentTurn === 'white') {
        whiteTimeRemaining = Math.max(0, whiteTimeRemaining - timeSinceLastMove);
        if (whiteTimeRemaining <= 0) {
          handleTimeout('white');
          return;
        }
      } else {
        blackTimeRemaining = Math.max(0, blackTimeRemaining - timeSinceLastMove);
        if (blackTimeRemaining <= 0) {
          handleTimeout('black');
          return;
        }
      }

      lastMoveTime = now;
      updateTimeDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (timeInterval) {
      clearInterval(timeInterval);
      timeInterval = null;
    }
  }

  function updateTimeDisplay() {
    if (!whiteTimeDisplay || !blackTimeDisplay) return;

    const whiteTime = formatTime(whiteTimeRemaining);
    const blackTime = formatTime(blackTimeRemaining);

    whiteTimeDisplay.textContent = whiteTime;
    blackTimeDisplay.textContent = blackTime;

    // Update visual states
    updateTimeControlStyles();
  }

  function updateTimeControlStyles() {
    if (!chessGame) return;

    // Remove all active and low-time classes
    whiteTimeControl.classList.remove('active', 'low-time');
    blackTimeControl.classList.remove('active', 'low-time');

    // Add active class to current player
    if (chessGame.currentTurn === 'white') {
      whiteTimeControl.classList.add('active');
    } else {
      blackTimeControl.classList.add('active');
    }

    // Add low-time class if time is running low (under 30 seconds)
    if (whiteTimeRemaining <= 30) {
      whiteTimeControl.classList.add('low-time');
    }
    if (blackTimeRemaining <= 30) {
      blackTimeControl.classList.add('low-time');
    }
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function handleTimeout(color) {
    stopTimer();

    const winner = color === 'white' ? 'black' : 'white';
    gameStatus.textContent = `Time's up! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by timeout!`;

    // Disable the chessboard
    const chessboard = document.getElementById('chessboard');
    chessboard.style.pointerEvents = 'none';
    chessboard.style.opacity = '0.7';

    // Notify the server about the timeout
    socket.emit('timeOut', currentServerId, currentGameId, color);
  }

  // Clear timer when leaving game
  const originalLeaveGame = leaveGameButton.onclick;
  leaveGameButton.addEventListener('click', () => {
    stopTimer();
    // Reset time control state
    gameTimeControl = null;
    whiteTimeRemaining = 0;
    blackTimeRemaining = 0;
    lastMoveTime = null;
  });

  // Chat event handlers
  sendChatButton.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      sendChatMessage();
    }
  });

  // Add toggle chat functionality
  toggleChatButton.addEventListener('click', () => {
    chatContainer.classList.toggle('minimized');
    // Update the button text
    toggleChatButton.textContent = chatContainer.classList.contains('minimized') ? '+' : '−';
  });

  function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message && playerName) {
      socket.emit('chatMessage', { sender: playerName, text: message });
      chatInput.value = '';
    }
  }

  socket.on('chatMessage', (message) => {
    displayChatMessage(message);
  });

  function displayChatMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    messageElement.innerHTML = `<span class="chat-sender">${message.sender}:</span> <span class="chat-text">${message.text}</span>`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the bottom
  }
});
