// Chess piece Unicode characters
const chessPieces = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙'
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟'
  }
};

class ChessGame {
  constructor(playerColor = 'white') {
    this.board = this.createInitialBoard();
    this.currentTurn = 'white';
    this.selectedPiece = null;
    this.validMoves = [];
    this.gameElement = document.getElementById('chessboard');
    this.playerColor = playerColor;
    this.inCheck = { white: false, black: false };
    this.isCheckmate = false;

    // Initialize Stockfish
    this.stockfish = new StockfishWrapper();
    this.stockfish.onMessage = (message) => this.handleStockfishMessage(message);
    this.stockfish.setSkillLevel(10); // Set default skill level to 10 (medium)

    this.renderBoard();

    // Set up analyze button event listener
    this.setupAnalyzeButton();
  }

  setupAnalyzeButton() {
    const analyzeButton = document.getElementById('analyze-game');
    analyzeButton.addEventListener('click', () => {
      alert('Analysis feature coming soon!');
    });
  }

  // Add method to show analyze button when game ends
  showAnalyzeButton() {
    const analyzeButton = document.getElementById('analyze-game');
    analyzeButton.classList.remove('hidden');
  }

  // Add method to handle Stockfish messages
  handleStockfishMessage(message) {
    if (typeof message !== 'string') return;

    if (message.startsWith('bestmove')) {
      const move = message.split(' ')[1];
      // Convert UCI move format (e.g., 'e2e4') to our move format
      if (move && move.length >= 4) {
        const from = {
          row: 8 - parseInt(move[1]),
          col: move[0].charCodeAt(0) - 'a'.charCodeAt(0)
        };
        const to = {
          row: 8 - parseInt(move[3]),
          col: move[2].charCodeAt(0) - 'a'.charCodeAt(0)
        };

        // Apply Stockfish's move
        this.makeMove({ from, to });
      }
    }
  }

  // Add method to get current position in FEN format
  getFEN() {
    let fen = '';

    // Board position
    for (let row = 0; row < 8; row++) {
      let emptyCount = 0;
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          const pieceChar = this.getPieceFENChar(piece);
          fen += pieceChar;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (row < 7) fen += '/';
    }

    // Active color
    fen += ' ' + this.currentTurn[0];

    // Castling availability (simplified - assuming no castling)
    fen += ' -';

    // En passant target square (simplified - assuming no en passant)
    fen += ' -';

    // Halfmove clock and fullmove number (simplified)
    fen += ' 0 1';

    return fen;
  }

  getPieceFENChar(piece) {
    const chars = {
      king: 'k',
      queen: 'q',
      rook: 'r',
      bishop: 'b',
      knight: 'n',
      pawn: 'p'
    };
    return piece.color === 'white'
      ? chars[piece.type].toUpperCase()
      : chars[piece.type];
  }

  // Add method to get Stockfish's suggestion
  getStockfishMove() {
    const fen = this.getFEN();
    this.stockfish.evaluatePosition(fen);
  }

  // Add method to play against Stockfish
  playAgainstEngine() {
    if (this.currentTurn !== this.playerColor) {
      this.getStockfishMove();
    }
  }

  createInitialBoard() {
    // Create 8x8 empty board
    const board = Array(8).fill().map(() => Array(8).fill(null));

    // Set up pawns
    for (let col = 0; col < 8; col++) {
      board[1][col] = { type: 'pawn', color: 'black' };
      board[6][col] = { type: 'pawn', color: 'white' };
    }

    // Set up other pieces
    const backRowPieces = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

    for (let col = 0; col < 8; col++) {
      board[0][col] = { type: backRowPieces[col], color: 'black' };
      board[7][col] = { type: backRowPieces[col], color: 'white' };
    }

    return board;
  }

  renderBoard() {
    this.gameElement.innerHTML = '';

    // Determine if the board should be flipped (when player is black)
    const isFlipped = this.playerColor === 'black';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        // Calculate the actual row and column based on whether the board is flipped
        const actualRow = isFlipped ? 7 - row : row;
        const actualCol = isFlipped ? 7 - col : col;

        const square = document.createElement('div');
        const isWhiteSquare = (actualRow + actualCol) % 2 === 0;

        square.classList.add('square', isWhiteSquare ? 'white' : 'black');
        square.dataset.row = actualRow;
        square.dataset.col = actualCol;

        const piece = this.board[actualRow][actualCol];
        if (piece) {
          square.textContent = chessPieces[piece.color][piece.type];
        }

        // Highlight selected piece and valid moves
        if (this.selectedPiece && this.selectedPiece.row === actualRow && this.selectedPiece.col === actualCol) {
          square.classList.add('selected');
        }

        if (this.validMoves.some(move => move.row === actualRow && move.col === actualCol)) {
          square.classList.add('valid-move');
        }

        square.addEventListener('click', () => this.handleSquareClick(actualRow, actualCol));
        this.gameElement.appendChild(square);
      }
    }
  }

  handleSquareClick(row, col) {
    const piece = this.board[row][col];

    // Only allow the player to interact when it's their turn
    if (this.currentTurn !== this.playerColor) {
      console.log("Not your turn");
      return;
    }

    // If no piece is selected and the clicked square has a piece of the current turn's color
    if (!this.selectedPiece && piece && piece.color === this.currentTurn) {
      this.selectedPiece = { row, col, ...piece };
      this.validMoves = this.getValidMoves(row, col, piece);
      this.renderBoard();
      return;
    }

    // If a piece is already selected
    if (this.selectedPiece) {
      // If clicking on another piece of the same color, select that piece instead
      if (piece && piece.color === this.currentTurn) {
        this.selectedPiece = { row, col, ...piece };
        this.validMoves = this.getValidMoves(row, col, piece);
        this.renderBoard();
        return;
      }

      // Check if the move is valid
      const isValidMove = this.validMoves.some(move => move.row === row && move.col === col);

      if (isValidMove) {
        // Make the move
        this.makeMove({
          from: { row: this.selectedPiece.row, col: this.selectedPiece.col },
          to: { row, col }
        });
      }

      // Reset selection
      this.selectedPiece = null;
      this.validMoves = [];
      this.renderBoard();
    }
  }

  getValidMoves(row, col, piece) {
    const moves = [];

    switch (piece.type) {
      case 'pawn':
        this.getPawnMoves(row, col, piece.color, moves);
        break;
      case 'rook':
        this.getRookMoves(row, col, piece.color, moves);
        break;
      case 'knight':
        this.getKnightMoves(row, col, piece.color, moves);
        break;
      case 'bishop':
        this.getBishopMoves(row, col, piece.color, moves);
        break;
      case 'queen':
        this.getQueenMoves(row, col, piece.color, moves);
        break;
      case 'king':
        this.getKingMoves(row, col, piece.color, moves);
        break;
    }

    // Filter out moves that would leave the king in check
    return this.filterMovesForCheck(row, col, piece, moves);
  }

  filterMovesForCheck(row, col, piece, moves) {
    // For now, return all moves to get basic movement working
    // We'll implement proper check validation after basic movement works
    return moves;

    /* Commenting out temporarily to debug the movement issue
    const validMoves = [];
    const originalPiece = { ...this.board[row][col] };

    // Check each move to see if it would leave the king in check
    for (const move of moves) {
      // Make a temporary move
      const capturedPiece = this.board[move.row][move.col];
      this.board[move.row][move.col] = originalPiece;
      this.board[row][col] = null;

      // Check if the king would be in check after this move
      const kingInCheck = this.isKingInCheck(piece.color);

      // Undo the temporary move
      this.board[row][col] = originalPiece;
      this.board[move.row][move.col] = capturedPiece;

      // Only add the move if it doesn't leave the king in check
      if (!kingInCheck) {
        validMoves.push(move);
      }
    }

    return validMoves;
    */
  }

  isKingInCheck(kingColor) {
    // Find the king's position
    let kingRow = -1;
    let kingCol = -1;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.type === 'king' && piece.color === kingColor) {
          kingRow = row;
          kingCol = col;
          break;
        }
      }
      if (kingRow !== -1) break;
    }

    // Check if any opponent piece can attack the king
    const opponentColor = kingColor === 'white' ? 'black' : 'white';

    // Check for attacks from pawns
    const pawnDirection = opponentColor === 'white' ? -1 : 1;
    const pawnAttackOffsets = [{ row: pawnDirection, col: -1 }, { row: pawnDirection, col: 1 }];

    for (const offset of pawnAttackOffsets) {
      const checkRow = kingRow + offset.row;
      const checkCol = kingCol + offset.col;

      if (this.isValidPosition(checkRow, checkCol)) {
        const piece = this.board[checkRow][checkCol];
        if (piece && piece.type === 'pawn' && piece.color === opponentColor) {
          return true;
        }
      }
    }

    // Check for attacks from knights
    const knightOffsets = [
      { row: -2, col: -1 }, { row: -2, col: 1 },
      { row: -1, col: -2 }, { row: -1, col: 2 },
      { row: 1, col: -2 }, { row: 1, col: 2 },
      { row: 2, col: -1 }, { row: 2, col: 1 }
    ];

    for (const offset of knightOffsets) {
      const checkRow = kingRow + offset.row;
      const checkCol = kingCol + offset.col;

      if (this.isValidPosition(checkRow, checkCol)) {
        const piece = this.board[checkRow][checkCol];
        if (piece && piece.type === 'knight' && piece.color === opponentColor) {
          return true;
        }
      }
    }

    // Check for attacks from rooks, bishops, and queens (linear pieces)
    const directions = [
      { row: 0, col: 1 },  // right
      { row: 0, col: -1 }, // left
      { row: 1, col: 0 },  // down
      { row: -1, col: 0 }, // up
      { row: 1, col: 1 },  // down-right
      { row: 1, col: -1 }, // down-left
      { row: -1, col: 1 }, // up-right
      { row: -1, col: -1 } // up-left
    ];

    for (const direction of directions) {
      let currentRow = kingRow + direction.row;
      let currentCol = kingCol + direction.col;

      while (this.isValidPosition(currentRow, currentCol)) {
        const piece = this.board[currentRow][currentCol];

        if (piece) {
          if (piece.color === opponentColor) {
            const isDiagonal = direction.row !== 0 && direction.col !== 0;
            const isOrthogonal = direction.row === 0 || direction.col === 0;

            if ((isDiagonal && (piece.type === 'bishop' || piece.type === 'queen')) ||
                (isOrthogonal && (piece.type === 'rook' || piece.type === 'queen'))) {
              return true;
            }

            // Check for king (only one square away)
            if (piece.type === 'king' &&
                Math.abs(currentRow - kingRow) <= 1 &&
                Math.abs(currentCol - kingCol) <= 1) {
              return true;
            }
          }
          // Stop checking in this direction if we hit any piece
          break;
        }

        currentRow += direction.row;
        currentCol += direction.col;
      }
    }

    return false;
  }

  isCheckmate(color) {
    // If the king is not in check, it's not checkmate
    if (!this.isKingInCheck(color)) {
      return false;
    }

    // Check if any piece of this color has valid moves
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.color === color) {
          const moves = this.getValidMoves(row, col, piece);
          if (moves.length > 0) {
            return false; // There's at least one legal move
          }
        }
      }
    }

    // No legal moves and king is in check = checkmate
    return true;
  }

  makeMove(move) {
    const { from, to } = move;
    const piece = this.board[from.row][from.col];
    const capturedPiece = this.board[to.row][to.col];

    // Move the piece
    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;

    // Switch turns
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

    // Check if the opponent's king is in check
    const opponentColor = this.currentTurn;
    const inCheck = this.isKingInCheck(opponentColor);
    this.inCheck[opponentColor] = inCheck;

    // Check for checkmate - fix the naming conflict
    let isCheckmateResult = false;
    if (inCheck) {
      isCheckmateResult = this.isCheckmateDetected(opponentColor);
    }

    // Update UI
    let turnText = `Current turn: <span>${this.currentTurn.charAt(0).toUpperCase() + this.currentTurn.slice(1)}</span>`;
    if (this.inCheck[this.currentTurn]) {
      turnText += isCheckmateResult ? ' - CHECKMATED!' : ' - CHECK!';
    }
    document.getElementById('current-turn').innerHTML = turnText;

    // If checkmate, update game status
    if (isCheckmateResult) {
      const winner = this.currentTurn === 'white' ? 'black' : 'white';
      document.getElementById('game-status').textContent = `Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`;

      // Disable the board
      this.gameElement.style.pointerEvents = 'none';
      this.gameElement.style.opacity = '0.7';

      // Show analyze button
      this.showAnalyzeButton();
    }

    // Emit the move event if a callback is provided
    if (this.onMove) {
      const moveData = {
        from,
        to,
        capturedPiece: capturedPiece ? { type: capturedPiece.type, color: capturedPiece.color } : null,
        inCheck: this.inCheck[opponentColor],
        isCheckmate: isCheckmateResult
      };
      this.onMove(moveData);
    }
  }

  isCheckmateDetected(color) {
    // If the king is not in check, it's not checkmate
    if (!this.isKingInCheck(color)) {
      return false;
    }

    // Check if any piece of this color has valid moves
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.color === color) {
          // Get raw moves without filtering for check to avoid infinite recursion
          const moves = [];

          switch (piece.type) {
            case 'pawn':
              this.getPawnMoves(row, col, piece.color, moves);
              break;
            case 'rook':
              this.getRookMoves(row, col, piece.color, moves);
              break;
            case 'knight':
              this.getKnightMoves(row, col, piece.color, moves);
              break;
            case 'bishop':
              this.getBishopMoves(row, col, piece.color, moves);
              break;
            case 'queen':
              this.getQueenMoves(row, col, piece.color, moves);
              break;
            case 'king':
              this.getKingMoves(row, col, piece.color, moves);
              break;
          }

          // Now filter these moves for check manually to avoid recursion
          for (const move of moves) {
            // Make a temporary move
            const originalPiece = { ...this.board[row][col] };
            const capturedPiece = this.board[move.row][move.col];
            this.board[move.row][move.col] = originalPiece;
            this.board[row][col] = null;

            // Check if the king would still be in check after this move
            const stillInCheck = this.isKingInCheck(color);

            // Undo the temporary move
            this.board[row][col] = originalPiece;
            this.board[move.row][move.col] = capturedPiece;

            // If this move gets the king out of check, it's not checkmate
            if (!stillInCheck) {
              return false;
            }
          }
        }
      }
    }

    // No legal moves found and king is in check = checkmate
    return true;
  }

  applyRemoteMove(move) {
    const { from, to, inCheck, isCheckmate } = move;

    // Apply the remote move
    this.board[to.row][to.col] = this.board[from.row][from.col];
    this.board[from.row][from.col] = null;

    // Switch turns
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

    // Update check status
    this.inCheck[this.currentTurn] = inCheck;
    this.isCheckmate = isCheckmate;

    // Update UI
    let turnText = `Current turn: <span>${this.currentTurn.charAt(0).toUpperCase() + this.currentTurn.slice(1)}</span>`;
    if (this.inCheck[this.currentTurn]) {
      turnText += this.isCheckmate ? ' - CHECKMATE!' : ' - CHECK!';
    }
    document.getElementById('current-turn').innerHTML = turnText;

    // If checkmate, update game status
    if (this.isCheckmate) {
      const winner = this.currentTurn === 'white' ? 'black' : 'white';
      document.getElementById('game-status').textContent = `Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`;

      // Disable the board
      this.gameElement.style.pointerEvents = 'none';
      this.gameElement.style.opacity = '0.7';
    }

    // Render the updated board
    this.renderBoard();
  }

  isValidPosition(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  getPawnMoves(row, col, color, moves) {
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    // Move forward one square
    if (this.isValidPosition(row + direction, col) && !this.board[row + direction][col]) {
      moves.push({ row: row + direction, col });

      // Move forward two squares from starting position
      if (row === startRow && !this.board[row + 2 * direction][col]) {
        moves.push({ row: row + 2 * direction, col });
      }
    }

    // Capture diagonally
    for (const colOffset of [-1, 1]) {
      const newCol = col + colOffset;
      const newRow = row + direction;

      if (this.isValidPosition(newRow, newCol) &&
          this.board[newRow][newCol] &&
          this.board[newRow][newCol].color !== color) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }

  getRookMoves(row, col, color, moves) {
    // Horizontal and vertical directions
    const directions = [
      { row: 0, col: 1 },  // right
      { row: 0, col: -1 }, // left
      { row: 1, col: 0 },  // down
      { row: -1, col: 0 }  // up
    ];

    this.getLinearMoves(row, col, color, moves, directions);
  }

  getBishopMoves(row, col, color, moves) {
    // Diagonal directions
    const directions = [
      { row: 1, col: 1 },   // down-right
      { row: 1, col: -1 },  // down-left
      { row: -1, col: 1 },  // up-right
      { row: -1, col: -1 }  // up-left
    ];

    this.getLinearMoves(row, col, color, moves, directions);
  }

  getQueenMoves(row, col, color, moves) {
    // Queen combines rook and bishop moves
    this.getRookMoves(row, col, color, moves);
    this.getBishopMoves(row, col, color, moves);
  }

  getKnightMoves(row, col, color, moves) {
    const offsets = [
      { row: -2, col: -1 }, { row: -2, col: 1 },
      { row: -1, col: -2 }, { row: -1, col: 2 },
      { row: 1, col: -2 }, { row: 1, col: 2 },
      { row: 2, col: -1 }, { row: 2, col: 1 }
    ];

    for (const offset of offsets) {
      const newRow = row + offset.row;
      const newCol = col + offset.col;

      if (this.isValidPosition(newRow, newCol) &&
          (!this.board[newRow][newCol] || this.board[newRow][newCol].color !== color)) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }

  getKingMoves(row, col, color, moves) {
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        if (rowOffset === 0 && colOffset === 0) continue;

        const newRow = row + rowOffset;
        const newCol = col + colOffset;

        if (this.isValidPosition(newRow, newCol) &&
            (!this.board[newRow][newCol] || this.board[newRow][newCol].color !== color)) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }

    // Note: Castling is not implemented in this simplified version
  }

  getLinearMoves(row, col, color, moves, directions) {
    for (const direction of directions) {
      let currentRow = row + direction.row;
      let currentCol = col + direction.col;

      while (this.isValidPosition(currentRow, currentCol)) {
        const piece = this.board[currentRow][currentCol];

        if (!piece) {
          // Empty square, can move here
          moves.push({ row: currentRow, col: currentCol });
        } else {
          // Square has a piece
          if (piece.color !== color) {
            // Can capture opponent's piece
            moves.push({ row: currentRow, col: currentCol });
          }
          // Stop in this direction since we can't move past a piece
          break;
        }

        currentRow += direction.row;
        currentCol += direction.col;
      }
    }
  }
}
