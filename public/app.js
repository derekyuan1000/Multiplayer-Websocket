/**
 * Chess Game Frontend with Server Lobby System
 * Handles UI interactions and WebSocket communication for the multiplayer chess game
 */
(function() {
    // Game state
    let socket;
    let playerInfo = {
        id: null,
        name: null,
        color: null,
        currentServer: null
    };
    let gameState = {
        id: null,
        serverId: null,
        opponent: null,
        status: 'waiting', // waiting, active, finished
        turn: 'white',
        selectedPiece: null,
        validMoves: [],
        clocks: null,
        clockInterval: null
    };
    let chess = new Chess();
    let serverLobbies = {};
    let selectedTimeControl = null;

    // DOM elements
    const loginScreen = document.getElementById('login-screen');
    const serverLobbyScreen = document.getElementById('server-lobby-screen');
    const colorSelectionScreen = document.getElementById('color-selection-screen');
    const timeControlScreen = document.getElementById('time-control-screen');
    const waitingScreen = document.getElementById('waiting-screen');
    const gameScreen = document.getElementById('game-screen');
    const playerNameInput = document.getElementById('player-name');
    const registerBtn = document.getElementById('register-btn');
    const serversGrid = document.getElementById('servers-grid');
    const selectedServerTitle = document.getElementById('selected-server-title');
    const timeServerTitle = document.getElementById('time-server-title');
    const serverStatus = document.getElementById('server-status');
    const colorOptions = document.querySelectorAll('.color-option');
    const selectTimeBtn = document.getElementById('select-time-btn');
    const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
    const backToColorsBtn = document.getElementById('back-to-colors-btn');
    const backToServerBtn = document.getElementById('back-to-server-btn');
    const timeControlPresets = document.querySelectorAll('.time-control-preset');
    const selectCustomBtn = document.getElementById('select-custom-btn');
    const customMinutes = document.getElementById('custom-minutes');
    const customIncrement = document.getElementById('custom-increment');
    const selectedTimeDisplay = document.getElementById('selected-time-display');
    const selectedTimeText = document.getElementById('selected-time-text');
    const startTimedGameBtn = document.getElementById('start-timed-game-btn');
    const waitingMessage = document.getElementById('waiting-message');
    const opponentName = document.getElementById('opponent-name');
    const opponentColor = document.getElementById('opponent-color');
    const yourName = document.getElementById('your-name');
    const yourColor = document.getElementById('your-color');
    const gameStatus = document.getElementById('game-status');
    const chessboard = document.getElementById('chessboard');
    const startGameBtn = document.getElementById('start-game-btn');
    const playerClock = document.getElementById('player-clock');
    const opponentClock = document.getElementById('opponent-clock');

    // Initialize the game
    function init() {
        connectToServer();
        setupEventListeners();
        createChessboard();
    }

    // Connect to WebSocket server
    function connectToServer() {
        // Connect to the same server (no separate port needed on Render)
        socket = io();

        // Socket event handlers
        socket.on('connect', () => {
            console.log('Connected to server');
        });

        socket.on('registered', (data) => {
            playerInfo.id = data.id;
            playerInfo.name = data.name;
            showScreen(serverLobbyScreen);
        });

        // Handle server lobby updates
        socket.on('serverLobbies', (lobbies) => {
            serverLobbies = lobbies;
            updateServerLobby();
        });

        // Handle server selection
        socket.on('serverSelected', ({ serverId, server }) => {
            playerInfo.currentServer = serverId;
            gameState.serverId = serverId;
            selectedServerTitle.textContent = `Server ${serverId}`;
            updateServerInfo(server);
            updateColorSelections(server);
            showScreen(colorSelectionScreen);
        });

        // Handle time control selection event from server
        socket.on('timeControlSelected', ({ serverId, server, timeControl }) => {
            selectedTimeControl = timeControl;
            timeServerTitle.textContent = `Server ${serverId}`;

            // Show the selected time control
            selectedTimeDisplay.classList.remove('hidden');
            selectedTimeText.textContent = `${timeControl.minutes} minutes + ${timeControl.increment} seconds`;

            // Show time control screen
            showScreen(timeControlScreen);
        });

        socket.on('gameStarted', (data) => {
            gameState.id = data.gameId;
            gameState.serverId = data.serverId;
            gameState.status = 'active';
            gameState.turn = data.turn;

            // Initialize clocks if time control is present
            if (data.clocks) {
                gameState.clocks = data.clocks;
                startChessClocks();
            }

            // Determine player colors and opponent info
            if (data.white.id === socket.id) {
                playerInfo.color = 'white';
                gameState.opponent = {
                    id: data.black.id,
                    name: data.black.name,
                    color: 'black'
                };
            } else {
                playerInfo.color = 'black';
                gameState.opponent = {
                    id: data.white.id,
                    name: data.white.name,
                    color: 'white'
                };
            }

            // Update UI
            opponentName.textContent = gameState.opponent.name;
            opponentColor.textContent = `(${gameState.opponent.color})`;
            yourName.textContent = playerInfo.name;
            yourColor.textContent = `(${playerInfo.color})`;

            // Update clocks
            updateClockDisplay();
            updateGameStatus();
            showScreen(gameScreen);
        });

        socket.on('moveMade', (data) => {
            // Update game state
            gameState.turn = data.turn;

            // Update clocks if present
            if (data.clocks) {
                gameState.clocks = data.clocks;
                updateClockDisplay();
            }

            // Make the move on the board
            const move = data.move;
            chess.makeMove(move);
            updateBoard();
            updateGameStatus();

            // Check for game end conditions
            checkGameEnd();
        });

        socket.on('gameEnded', (data) => {
            // Handle game ending due to resignation or disconnection
            gameState.status = 'finished';
            gameState.winner = data.winner;

            alert(data.message);

            // Reset chess board to starting position
            chess.reset();
            updateBoard();

            // Return to server lobby
            showScreen(serverLobbyScreen);
        });

        socket.on('playerDisconnected', (data) => {
            alert(data.message);
            showScreen(serverLobbyScreen);
        });

        socket.on('error', (data) => {
            alert(`Error: ${data.message}`);
        });
    }

    // Update server lobby display
    function updateServerLobby() {
        serversGrid.innerHTML = '';

        Object.values(serverLobbies).forEach(server => {
            const serverCard = createServerCard(server);
            serversGrid.appendChild(serverCard);
        });
    }

    // Create a server card element
    function createServerCard(server) {
        const card = document.createElement('div');
        card.className = `server-card ${server.status}`;
        card.dataset.serverId = server.id;

        // Prevent clicking on in-game servers
        if (server.status !== 'in-game') {
            card.addEventListener('click', () => selectServer(server.id));
        }

        const header = document.createElement('div');
        header.className = 'server-header';

        const title = document.createElement('div');
        title.className = 'server-title';
        title.textContent = `Server ${server.id}`;

        const status = document.createElement('div');
        status.className = `server-status ${server.status}`;
        status.textContent = server.status;

        header.appendChild(title);
        header.appendChild(status);

        const players = document.createElement('div');
        players.className = 'server-players';

        // White player slot
        const whiteSlot = document.createElement('div');
        whiteSlot.className = `server-player white ${server.white ? 'occupied' : ''}`;

        const whiteLabel = document.createElement('div');
        whiteLabel.className = 'server-player-label';
        whiteLabel.textContent = 'White';

        const whiteName = document.createElement('div');
        whiteName.className = 'server-player-name';
        whiteName.textContent = server.white ? server.white.name : 'Available';

        whiteSlot.appendChild(whiteLabel);
        whiteSlot.appendChild(whiteName);

        // Black player slot
        const blackSlot = document.createElement('div');
        blackSlot.className = `server-player black ${server.black ? 'occupied' : ''}`;

        const blackLabel = document.createElement('div');
        blackLabel.className = 'server-player-label';
        blackLabel.textContent = 'Black';

        const blackName = document.createElement('div');
        blackName.className = 'server-player-name';
        blackName.textContent = server.black ? server.black.name : 'Available';

        blackSlot.appendChild(blackLabel);
        blackSlot.appendChild(blackName);

        players.appendChild(whiteSlot);
        players.appendChild(blackSlot);

        card.appendChild(header);
        card.appendChild(players);

        return card;
    }

    // Select a server
    function selectServer(serverId) {
        socket.emit('selectServer', serverId);
    }

    // Update server info display
    function updateServerInfo(server) {
        let statusText = '';
        switch(server.status) {
            case 'available':
                statusText = 'Ready for players';
                break;
            case 'waiting':
                statusText = 'Waiting for opponent';
                break;
            case 'ready':
                statusText = 'Ready to start game';
                break;
            case 'in-game':
                statusText = 'Game in progress';
                break;
        }
        serverStatus.textContent = statusText;
    }

    // Chess clock functions
    function startChessClocks() {
        if (gameState.clockInterval) {
            clearInterval(gameState.clockInterval);
        }

        gameState.clockInterval = setInterval(() => {
            if (gameState.status === 'active' && gameState.clocks) {
                // Decrease time for current player
                const currentPlayerColor = gameState.turn;
                gameState.clocks[currentPlayerColor] -= 1000; // Decrease by 1 second

                // Check for time forfeit
                if (gameState.clocks[currentPlayerColor] <= 0) {
                    gameState.clocks[currentPlayerColor] = 0;
                    gameState.status = 'finished';
                    const winner = currentPlayerColor === 'white' ? 'black' : 'white';
                    alert(`${currentPlayerColor === playerInfo.color ? 'You' : gameState.opponent.name} ran out of time! ${winner === playerInfo.color ? 'You win!' : 'You lose!'}`);
                    clearInterval(gameState.clockInterval);
                    return;
                }

                updateClockDisplay();
            }
        }, 1000);
    }

    function stopChessClocks() {
        if (gameState.clockInterval) {
            clearInterval(gameState.clockInterval);
            gameState.clockInterval = null;
        }
    }

    function updateClockDisplay() {
        if (!gameState.clocks) {
            // Hide clocks if no time control
            playerClock.style.display = 'none';
            opponentClock.style.display = 'none';
            return;
        }

        // Show clocks
        playerClock.style.display = 'block';
        opponentClock.style.display = 'block';

        // Update clock times
        const playerTime = gameState.clocks[playerInfo.color] || 0;
        const opponentTime = gameState.clocks[gameState.opponent.color] || 0;

        // Format time as MM:SS
        const formatTime = (ms) => {
            const totalSeconds = Math.max(0, Math.floor(ms / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        // Update clock displays
        playerClock.querySelector('.clock-time').textContent = formatTime(playerTime);
        opponentClock.querySelector('.clock-time').textContent = formatTime(opponentTime);

        // Add active class to current player's clock
        playerClock.classList.remove('active', 'low-time');
        opponentClock.classList.remove('active', 'low-time');

        if (gameState.turn === playerInfo.color) {
            playerClock.classList.add('active');
        } else {
            opponentClock.classList.add('active');
        }

        // Add low-time warning (under 30 seconds)
        if (playerTime < 30000) {
            playerClock.classList.add('low-time');
        }
        if (opponentTime < 30000) {
            opponentClock.classList.add('low-time');
        }
    }

    // Update UI based on color selections in current server
    function updateColorSelections(server) {
        if (colorOptions) {
            colorOptions.forEach(option => {
                const color = option.dataset.color;
                const nameSpan = option.querySelector('.player-name');

                // Reset classes
                option.classList.remove('selected', 'taken');
                option.removeAttribute('disabled');

                // Check if this color is selected by the current player
                if (server[color] && server[color].id === playerInfo.id) {
                    option.classList.add('selected');
                    if (nameSpan) nameSpan.textContent = `(${playerInfo.name})`;
                }
                // Check if this color is selected by another player
                else if (server[color]) {
                    option.classList.add('taken');
                    option.setAttribute('disabled', 'disabled');
                    if (nameSpan) nameSpan.textContent = `(${server[color].name})`;
                } else {
                    // Color is available
                    if (nameSpan) nameSpan.textContent = '';
                }
            });
        }

        // Show/hide buttons based on player role and server state
        if (server.white && server.white.id === playerInfo.id && server.black) {
            // White player with both colors selected
            if (startGameBtn) startGameBtn.classList.remove('hidden');
            if (selectTimeBtn) selectTimeBtn.classList.remove('hidden');
            console.log('Showing start and time control buttons for white player');
        } else {
            if (startGameBtn) startGameBtn.classList.add('hidden');
            if (selectTimeBtn) selectTimeBtn.classList.add('hidden');
            if (server.white && server.black) {
                console.log('Both players connected, but current player is not white');
            } else {
                console.log('Waiting for both players to select colors');
            }
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Register player name
        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                const name = playerNameInput.value.trim();
                if (name) {
                    socket.emit('registerPlayer', name);
                } else {
                    alert('Please enter your name.');
                }
            });
        }

        // Color selection
        if (colorOptions) {
            colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    // Skip if this color is already taken by another player
                    if (option.classList.contains('taken')) {
                        return;
                    }

                    const color = option.dataset.color;
                    socket.emit('selectColor', {
                        serverId: playerInfo.currentServer,
                        color: color
                    });
                });
            });
        }

        // Back to lobby button
        if (backToLobbyBtn) {
            backToLobbyBtn.addEventListener('click', () => {
                // If player is in an active game, emit leave to lobby event (which will resign them)
                if (gameState.status === 'active') {
                    socket.emit('leaveToLobby');
                } else if (playerInfo.currentServer) {
                    // If player is in a lobby but not in an active game, emit leave lobby event
                    socket.emit('leaveLobby');
                }
                showScreen(serverLobbyScreen);
            });
        }

        // Back to colors button (from time control)
        if (backToColorsBtn) {
            backToColorsBtn.addEventListener('click', () => {
                showScreen(colorSelectionScreen);
            });
        }

        // Back to server button (from game)
        if (backToServerBtn) {
            backToServerBtn.addEventListener('click', () => {
                // If player is in an active game, emit leave to lobby event (which will resign them)
                if (gameState.status === 'active') {
                    socket.emit('leaveToLobby');
                } else if (playerInfo.currentServer) {
                    // If player is in a lobby but not in an active game, emit leave lobby event
                    socket.emit('leaveLobby');
                }
                showScreen(serverLobbyScreen);
            });
        }

        // Select time control preset
        if (timeControlPresets) {
            timeControlPresets.forEach(preset => {
                preset.addEventListener('click', () => {
                    // Remove selected class from all presets
                    timeControlPresets.forEach(p => p.classList.remove('selected'));

                    // Add selected class to clicked preset
                    preset.classList.add('selected');

                    // Get preset values
                    const minutes = parseInt(preset.dataset.minutes);
                    const increment = parseInt(preset.dataset.increment);

                    // Create time control object
                    const timeControl = {
                        name: preset.querySelector('h3').textContent,
                        minutes: minutes,
                        increment: increment
                    };

                    // Emit time control selection to server
                    socket.emit('selectTimeControl', {
                        serverId: playerInfo.currentServer,
                        timeControl: timeControl
                    });
                });
            });
        }

        // Select custom time control
        if (selectCustomBtn) {
            selectCustomBtn.addEventListener('click', () => {
                const minutes = parseInt(customMinutes.value);
                const increment = parseInt(customIncrement.value);

                if (minutes > 0 && increment >= 0) {
                    const timeControl = {
                        name: 'Custom',
                        minutes: minutes,
                        increment: increment
                    };

                    // Emit custom time control selection
                    socket.emit('selectTimeControl', {
                        serverId: playerInfo.currentServer,
                        timeControl: timeControl
                    });
                } else {
                    alert('Please enter valid time controls (minutes > 0, increment >= 0).');
                }
            });
        }

        // Select time control button
        if (selectTimeBtn) {
            selectTimeBtn.addEventListener('click', () => {
                showScreen(timeControlScreen);
            });
        }

        // Start timed game button
        if (startTimedGameBtn) {
            startTimedGameBtn.addEventListener('click', () => {
                if (playerInfo.currentServer && selectedTimeControl) {
                    socket.emit('startGameWithTime', playerInfo.currentServer);
                }
            });
        }

        // Start game button (regular game without time control)
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => {
                if (playerInfo.currentServer) {
                    socket.emit('startGame', playerInfo.currentServer);
                }
            });
        }
    }

    // Create the chessboard UI
    function createChessboard() {
        chessboard.innerHTML = '';

        // Create 64 squares
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                const squareColor = (row + col) % 2 === 0 ? 'white' : 'black';
                square.className = `square ${squareColor}`;

                // Set data attributes for position
                const file = 'abcdefgh'[col];
                const rank = 8 - row;
                square.dataset.square = file + rank;

                // Add click event
                square.addEventListener('click', handleSquareClick);

                chessboard.appendChild(square);
            }
        }

        // Update the board with pieces
        updateBoard();
    }

    // Update the board based on current chess position
    function updateBoard() {
        // Remove all pieces
        const pieces = document.querySelectorAll('.chess-piece');
        pieces.forEach(piece => piece.remove());

        // Reset selection
        const selectedSquares = document.querySelectorAll('.square.selected');
        selectedSquares.forEach(square => square.classList.remove('selected'));

        const validMoveSquares = document.querySelectorAll('.square.valid-move');
        validMoveSquares.forEach(square => square.classList.remove('valid-move'));

        gameState.selectedPiece = null;
        gameState.validMoves = [];

        // Add pieces based on current position
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const file = 'abcdefgh'[col];
                const rank = 8 - row;
                const square = file + rank;

                const piece = chess.get(square);
                if (piece) {
                    const squareElement = document.querySelector(`.square[data-square="${square}"]`);
                    const pieceElement = document.createElement('div');
                    pieceElement.className = 'chess-piece';

                    // Set piece image
                    const pieceColor = piece.color === chess.COLORS.WHITE ? 'white' : 'black';
                    let pieceType = '';

                    switch(piece.type) {
                        case chess.PIECES.PAWN: pieceType = 'pawn'; break;
                        case chess.PIECES.KNIGHT: pieceType = 'knight'; break;
                        case chess.PIECES.BISHOP: pieceType = 'bishop'; break;
                        case chess.PIECES.ROOK: pieceType = 'rook'; break;
                        case chess.PIECES.QUEEN: pieceType = 'queen'; break;
                        case chess.PIECES.KING: pieceType = 'king'; break;
                    }

                    pieceElement.style.backgroundImage = `url('pieces/${pieceColor}-${pieceType}.png')`;
                    squareElement.appendChild(pieceElement);
                }
            }
        }

        // Flip board for black player
        if (playerInfo.color === 'black') {
            chessboard.style.transform = 'rotate(180deg)';
            const allPieces = document.querySelectorAll('.chess-piece');
            allPieces.forEach(piece => {
                piece.style.transform = 'rotate(180deg)';
            });
        }
    }

    // Handle square click
    function handleSquareClick(event) {
        // Only allow moves if game is active and it's player's turn
        if (gameState.status !== 'active' || gameState.turn !== playerInfo.color) {
            return;
        }

        const square = event.target.closest('.square');
        if (!square) return;

        const squareName = square.dataset.square;

        // If no piece is selected, try to select one
        if (!gameState.selectedPiece) {
            const piece = chess.get(squareName);

            // Can only select own pieces
            if (piece && ((piece.color === chess.COLORS.WHITE && playerInfo.color === 'white') ||
                         (piece.color === chess.COLORS.BLACK && playerInfo.color === 'black'))) {

                gameState.selectedPiece = squareName;
                square.classList.add('selected');

                // Find valid moves
                const moves = chess.generateMoves({ legal: true });
                gameState.validMoves = moves.filter(move => move.from === squareName);

                // Highlight valid moves
                gameState.validMoves.forEach(move => {
                    const targetSquare = document.querySelector(`.square[data-square="${move.to}"]`);
                    if (targetSquare) {
                        targetSquare.classList.add('valid-move');
                    }
                });
            }
        }
        // If a piece is already selected
        else {
            // Check if clicked on same square (deselect)
            if (squareName === gameState.selectedPiece) {
                // Deselect
                square.classList.remove('selected');
                gameState.selectedPiece = null;

                // Remove highlights
                const validMoveSquares = document.querySelectorAll('.square.valid-move');
                validMoveSquares.forEach(square => square.classList.remove('valid-move'));
                gameState.validMoves = [];

            }
            // Check if clicked on valid move square
            else {
                const move = gameState.validMoves.find(move => move.to === squareName);

                if (move) {
                    // Make the move
                    socket.emit('makeMove', {
                        gameId: gameState.id,
                        move: move
                    });

                    // Clear selection
                    const selectedSquare = document.querySelector('.square.selected');
                    if (selectedSquare) selectedSquare.classList.remove('selected');

                    const validMoveSquares = document.querySelectorAll('.square.valid-move');
                    validMoveSquares.forEach(s => s.classList.remove('valid-move'));

                    gameState.selectedPiece = null;
                    gameState.validMoves = [];
                } else {
                    // Clicked on invalid square, try selecting a different piece
                    const piece = chess.get(squareName);

                    // Deselect current piece
                    const selectedSquare = document.querySelector('.square.selected');
                    if (selectedSquare) selectedSquare.classList.remove('selected');

                    const validMoveSquares = document.querySelectorAll('.square.valid-move');
                    validMoveSquares.forEach(s => s.classList.remove('valid-move'));

                    gameState.selectedPiece = null;
                    gameState.validMoves = [];

                    // Select new piece if it's player's piece
                    if (piece && ((piece.color === chess.COLORS.WHITE && playerInfo.color === 'white') ||
                                 (piece.color === chess.COLORS.BLACK && playerInfo.color === 'black'))) {

                        gameState.selectedPiece = squareName;
                        square.classList.add('selected');

                        // Find valid moves
                        const moves = chess.generateMoves({ legal: true });
                        gameState.validMoves = moves.filter(move => move.from === squareName);

                        // Highlight valid moves
                        gameState.validMoves.forEach(move => {
                            const targetSquare = document.querySelector(`.square[data-square="${move.to}"]`);
                            if (targetSquare) {
                                targetSquare.classList.add('valid-move');
                            }
                        });
                    }
                }
            }
        }
    }

    // Update game status display
    function updateGameStatus() {
        if (gameState.status === 'waiting') {
            if (playerInfo.color === 'white') {
                gameStatus.textContent = "Press 'Start Game' to begin";
            } else {
                gameStatus.textContent = "Waiting for white to start the game...";
            }
        } else if (gameState.status === 'active') {
            if (gameState.turn === playerInfo.color) {
                gameStatus.textContent = "Your turn";
            } else {
                gameStatus.textContent = `${gameState.opponent.name}'s turn`;
            }

            // Check for check
            if (chess.isKingAttacked(gameState.turn === 'white' ? chess.COLORS.WHITE : chess.COLORS.BLACK)) {
                gameStatus.textContent += " (CHECK)";
            }
        } else if (gameState.status === 'finished') {
            if (gameState.winner) {
                gameStatus.textContent = `Game over - ${gameState.winner === playerInfo.color ? 'You win!' : 'You lose!'}`;
            } else {
                gameStatus.textContent = "Game over - Draw";
            }
        }
    }

    // Check for game end conditions
    function checkGameEnd() {
        const gameOver = chess.isGameOver();

        if (gameOver) {
            gameState.status = 'finished';

            if (gameOver === 'checkmate') {
                // The player who just moved wins
                gameState.winner = gameState.turn === 'white' ? 'black' : 'white';
                alert(gameState.winner === playerInfo.color ? 'Checkmate! You win!' : 'Checkmate! You lose!');
            } else {
                // Draw
                gameState.winner = null;
                alert(`Game drawn by ${gameOver}`);
            }

            updateGameStatus();
        }
    }

    // Helper to show a specific screen
    function showScreen(screen) {
        // Hide all screens
        loginScreen.classList.add('hidden');
        serverLobbyScreen.classList.add('hidden');
        colorSelectionScreen.classList.add('hidden');
        timeControlScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');

        // Show the requested screen
        screen.classList.remove('hidden');
    }

    // Update the selected time display
    function updateSelectedTimeDisplay(minutes, increment) {
        selectedTimeDisplay.textContent = `${minutes}m ${increment}s`;
        selectedTimeText.textContent = `(${minutes} minutes + ${increment} seconds)`;
    }

    // Start the app when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
