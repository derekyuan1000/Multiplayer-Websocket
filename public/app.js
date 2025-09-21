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
        validMoves: []
    };
    let chess = new Chess();
    let serverLobbies = {};

    // DOM elements
    const loginScreen = document.getElementById('login-screen');
    const serverLobbyScreen = document.getElementById('server-lobby-screen');
    const colorSelectionScreen = document.getElementById('color-selection-screen');
    const waitingScreen = document.getElementById('waiting-screen');
    const gameScreen = document.getElementById('game-screen');
    const playerNameInput = document.getElementById('player-name');
    const registerBtn = document.getElementById('register-btn');
    const serversGrid = document.getElementById('servers-grid');
    const selectedServerTitle = document.getElementById('selected-server-title');
    const serverStatus = document.getElementById('server-status');
    const colorOptions = document.querySelectorAll('.color-option');
    const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
    const backToServerBtn = document.getElementById('back-to-server-btn');
    const waitingMessage = document.getElementById('waiting-message');
    const opponentName = document.getElementById('opponent-name');
    const opponentColor = document.getElementById('opponent-color');
    const yourName = document.getElementById('your-name');
    const yourColor = document.getElementById('your-color');
    const gameStatus = document.getElementById('game-status');
    const chessboard = document.getElementById('chessboard');
    const startGameBtn = document.getElementById('start-game-btn');

    // Initialize the game
    function init() {
        connectToServer();
        setupEventListeners();
        createChessboard();
    }

    // Connect to WebSocket server
    function connectToServer() {
        // Connect to dedicated game server on port 3002
        socket = io('http://localhost:3002');

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

        socket.on('gameStarted', (data) => {
            gameState.id = data.gameId;
            gameState.serverId = data.serverId;
            gameState.status = 'active';
            gameState.turn = data.turn;

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

            updateGameStatus();
            showScreen(gameScreen);
        });

        socket.on('moveMade', (data) => {
            // Update game state
            gameState.turn = data.turn;

            // Make the move on the board
            const move = data.move;
            chess.makeMove(move);
            updateBoard();
            updateGameStatus();

            // Check for game end conditions
            checkGameEnd();
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

    // Update UI based on color selections in current server
    function updateColorSelections(server) {
        colorOptions.forEach(option => {
            const color = option.dataset.color;
            const nameSpan = option.querySelector('.player-name');

            // Reset classes
            option.classList.remove('selected', 'taken');
            option.removeAttribute('disabled');

            // Check if this color is selected by the current player
            if (server[color] && server[color].id === playerInfo.id) {
                option.classList.add('selected');
                nameSpan.textContent = `(${playerInfo.name})`;
            }
            // Check if this color is selected by another player
            else if (server[color]) {
                option.classList.add('taken');
                option.setAttribute('disabled', 'disabled');
                nameSpan.textContent = `(${server[color].name})`;
            } else {
                // Color is available
                nameSpan.textContent = '';
            }
        });

        // Show/hide start button
        if (server.white && server.white.id === playerInfo.id && server.black) {
            startGameBtn.classList.remove('hidden');
        } else {
            startGameBtn.classList.add('hidden');
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Register player name
        registerBtn.addEventListener('click', () => {
            const name = playerNameInput.value.trim();
            if (name) {
                socket.emit('registerPlayer', name);
            } else {
                alert('Please enter your name.');
            }
        });

        // Color selection
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

        // Back to lobby button
        backToLobbyBtn.addEventListener('click', () => {
            showScreen(serverLobbyScreen);
        });

        // Back to server button (from game)
        backToServerBtn.addEventListener('click', () => {
            showScreen(serverLobbyScreen);
        });

        // Start game button
        startGameBtn.addEventListener('click', () => {
            if (playerInfo.currentServer) {
                socket.emit('startGame', playerInfo.currentServer);
            }
        });
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
                validMoveSquares.forEach(s => s.classList.remove('valid-move'));
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
        waitingScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');

        // Show the requested screen
        screen.classList.remove('hidden');
    }

    // Start the app when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
