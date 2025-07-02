// Chess piece image mappings
const chessPieces = {
  white: {
    king: 'pieces/white-king.png',
    queen: 'pieces/white-queen.png',
    rook: 'pieces/white-rook.png',
    bishop: 'pieces/white-bishop.png',
    knight: 'pieces/white-knight.png',
    pawn: 'pieces/white-pawn.png'
  },
  black: {
    king: 'pieces/black-king.png',
    queen: 'pieces/black-queen.png',
    rook: 'pieces/black-rook.png',
    bishop: 'pieces/black-bishop.png',
    knight: 'pieces/black-knight.png',
    pawn: 'pieces/black-pawn.png'
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
    this.enPassantTargetSquare = null; // Format: { row: r, col: c } the square *behind* the pawn that moved two steps

    // Castling flags
    this.hasMoved = {
      white: { king: false, rookA: false, rookH: false }, // Corresponds to a1, h1
      black: { king: false, rookA: false, rookH: false }  // Corresponds to a8, h8
    };

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

    // Castling availability
    let castlingFen = '';
    if (!this.hasMoved.white.king) {
      if (!this.hasMoved.white.rookH && this.board[7][7] && this.board[7][7].type === 'rook') castlingFen += 'K';
      if (!this.hasMoved.white.rookA && this.board[7][0] && this.board[7][0].type === 'rook') castlingFen += 'Q';
    }
    if (!this.hasMoved.black.king) {
      if (!this.hasMoved.black.rookH && this.board[0][7] && this.board[0][7].type === 'rook') castlingFen += 'k';
      if (!this.hasMoved.black.rookA && this.board[0][0] && this.board[0][0].type === 'rook') castlingFen += 'q';
    }
    fen += ' ' + (castlingFen || '-');

    // En passant target square
    if (this.enPassantTargetSquare) {
      const colChar = String.fromCharCode('a'.charCodeAt(0) + this.enPassantTargetSquare.col);
      const rowChar = 8 - this.enPassantTargetSquare.row;
      fen += ' ' + colChar + rowChar;
    } else {
      fen += ' -';
    }

    // Halfmove clock and fullmove number (simplified - actual implementation requires tracking these)
    // For now, we'll keep them simplified as the core request is about special moves.
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
          // Use image instead of text for pieces
          const img = document.createElement('img');
          img.src = chessPieces[piece.color][piece.type];
          img.alt = `${piece.color} ${piece.type}`;
          img.classList.add('chess-piece');
          square.appendChild(img);
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
    const validMoves = [];
    // Create a deep copy of the piece to avoid modifying the original object
    // The piece parameter already contains all necessary info (type, color).
    // The originalPiece on the board is this.board[row][col].

    for (const move of moves) {
      // Simulate the move
      const originalBoardPiece = this.board[row][col]; // The piece being moved
      const capturedPiece = this.board[move.row][move.col]; // Piece at the destination, if any

      this.board[move.row][move.col] = originalBoardPiece; // Move the piece
      this.board[row][col] = null; // Empty the original square

      // Check if the current player's king is in check
      const kingInCheck = this.isKingInCheck(piece.color);

      // Undo the move
      this.board[row][col] = originalBoardPiece; // Restore the piece
      this.board[move.row][move.col] = capturedPiece; // Restore any captured piece

      if (!kingInCheck) {
        validMoves.push(move);
      }
    }
    return validMoves;
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

  isSquareAttacked(targetRow, targetCol, attackingColor) {
    // Check for attacks from pawns
    const pawnDirection = attackingColor === 'white' ? -1 : 1;
    // Pawns attack diagonally forward FROM THEIR PERSPECTIVE
    // So, if black is attacking, their pawns are on attackingColor's row + pawnDirection
    // and they attack targetRow, targetCol.
    // The squares pawns would attack *from* are targetRow - pawnDirection, targetCol +/- 1
    const pawnAttackSources = [
      { row: targetRow - pawnDirection, col: targetCol - 1 },
      { row: targetRow - pawnDirection, col: targetCol + 1 }
    ];

    for (const src of pawnAttackSources) {
      if (this.isValidPosition(src.row, src.col)) {
        const piece = this.board[src.row][src.col];
        if (piece && piece.type === 'pawn' && piece.color === attackingColor) {
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
      const checkRow = targetRow + offset.row;
      const checkCol = targetCol + offset.col;

      if (this.isValidPosition(checkRow, checkCol)) {
        const piece = this.board[checkRow][checkCol];
        if (piece && piece.type === 'knight' && piece.color === attackingColor) {
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
      let currentRow = targetRow + direction.row;
      let currentCol = targetCol + direction.col;

      while (this.isValidPosition(currentRow, currentCol)) {
        const piece = this.board[currentRow][currentCol];

        if (piece) {
          if (piece.color === attackingColor) {
            const isDiagonal = direction.row !== 0 && direction.col !== 0;
            const isOrthogonal = direction.row === 0 || direction.col === 0;

            if ((isDiagonal && (piece.type === 'bishop' || piece.type === 'queen')) ||
                (isOrthogonal && (piece.type === 'rook' || piece.type === 'queen'))) {
              return true;
            }
            // Check for king (only one square away)
            if (piece.type === 'king' &&
                Math.abs(currentRow - targetRow) <= 1 &&
                Math.abs(currentCol - targetCol) <= 1) {
              return true;
            }
          }
          // Stop checking in this direction if we hit any piece (friend or foe, for linear attacks)
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
    let capturedPiece = this.board[to.row][to.col]; // Standard capture

    // Handle en passant capture
    if (piece.type === 'pawn' && this.enPassantTargetSquare && to.row === this.enPassantTargetSquare.row && to.col === this.enPassantTargetSquare.col) {
      const capturedPawnRow = from.row; // The pawn being captured is on the same row as the attacking pawn
      const capturedPawnCol = to.col;   // And on the same column as the target square
      capturedPiece = this.board[capturedPawnRow][capturedPawnCol]; // Store for event
      this.board[capturedPawnRow][capturedPawnCol] = null; // Remove the captured pawn
    }

    // Clear enPassantTargetSquare *before* potentially setting it again for a new two-square pawn move
    this.enPassantTargetSquare = null;

    // Set enPassantTargetSquare if a pawn made a two-square move
    if (piece.type === 'pawn' && Math.abs(from.row - to.row) === 2) {
      this.enPassantTargetSquare = { row: (from.row + to.row) / 2, col: from.col };
    }

    // Handle castling: move the rook as well
    if (piece.type === 'king') {
      // Kingside castling
      if (to.col - from.col === 2) {
        const rook = this.board[from.row][7]; // Rook on h-file
        this.board[from.row][5] = rook;      // Move rook to f-file
        this.board[from.row][7] = null;      // Empty h-file
      }
      // Queenside castling
      else if (to.col - from.col === -2) {
        const rook = this.board[from.row][0]; // Rook on a-file
        this.board[from.row][3] = rook;      // Move rook to d-file
        this.board[from.row][0] = null;      // Empty a-file
      }
    }

    // Move the piece
    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;

    // Update hasMoved flags
    const pieceColor = piece.color;
    if (piece.type === 'king') {
      this.hasMoved[pieceColor].king = true;
    } else if (piece.type === 'rook') {
      if (from.col === 0) { // a-file rook
        this.hasMoved[pieceColor].rookA = true;
      } else if (from.col === 7) { // h-file rook
        this.hasMoved[pieceColor].rookH = true;
      }
    }

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
        isCheckmate: isCheckmateResult,
        // Add castling information if it occurred
        castlingType: null
      };

      if (piece.type === 'king') {
        if (to.col - from.col === 2) {
          moveData.castlingType = 'kingside';
        } else if (to.col - from.col === -2) {
          moveData.castlingType = 'queenside';
        }
      }
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
    // The 'move' object here is the 'moveData' sent from the other client,
    // which is wrapped inside game.moves[...].move by the server.
    const { from, to, inCheck, isCheckmate, castlingType } = move;
    const pieceToMove = this.board[from.row][from.col]; // Get the piece before nullifying its original square

    // Standard piece move
    this.board[to.row][to.col] = pieceToMove;
    this.board[from.row][from.col] = null;

    // Handle castling: move the rook as well for the remote player
    if (castlingType && pieceToMove && pieceToMove.type === 'king') {
      const kingRow = to.row; // King's row is the same as 'to.row'
      if (castlingType === 'kingside') {
        const rook = this.board[kingRow][7]; // Rook on h-file
        this.board[kingRow][5] = rook;      // Move rook to f-file
        this.board[kingRow][7] = null;      // Empty h-file
      } else if (castlingType === 'queenside') {
        const rook = this.board[kingRow][0]; // Rook on a-file
        this.board[kingRow][3] = rook;      // Move rook to d-file
        this.board[kingRow][0] = null;      // Empty a-file
      }
    }

    // Update hasMoved flags based on the moved piece (king or rook)
    // This is important for the remote client to maintain correct castling rights state
    if (pieceToMove) {
        const pieceColor = pieceToMove.color;
        if (pieceToMove.type === 'king') {
            this.hasMoved[pieceColor].king = true;
        } else if (pieceToMove.type === 'rook') {
            if (from.col === 0 && from.row === (pieceColor === 'white' ? 7 : 0)) { // a-file rook original position
                this.hasMoved[pieceColor].rookA = true;
            } else if (from.col === 7 && from.row === (pieceColor === 'white' ? 7 : 0)) { // h-file rook original position
                this.hasMoved[pieceColor].rookH = true;
            }
        }
    }


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

      if (this.isValidPosition(newRow, newCol)) {
        // Standard capture
        if (this.board[newRow][newCol] && this.board[newRow][newCol].color !== color) {
          moves.push({ row: newRow, col: newCol });
        }
        // En passant capture
        else if (
          this.enPassantTargetSquare &&
          newRow === this.enPassantTargetSquare.row &&
          newCol === this.enPassantTargetSquare.col &&
          this.board[row][newCol] && // Check if the pawn to be captured exists
          this.board[row][newCol].type === 'pawn' &&
          this.board[row][newCol].color !== color
        ) {
          moves.push({ row: newRow, col: newCol, enPassant: true });
        }
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

    // Castling logic
    const opponentColor = color === 'white' ? 'black' : 'white';
    const kingRow = (color === 'white') ? 7 : 0;

    // Kingside Castling (O-O)
    // Conditions: King and H-rook haven't moved, king not in check, path clear, king doesn't pass through check.
    if (!this.hasMoved[color].king && !this.hasMoved[color].rookH &&
        !this.isKingInCheck(color) && // King not currently in check
        this.board[kingRow][5] === null && this.board[kingRow][6] === null && // Path is clear
        !this.isSquareAttacked(kingRow, 4, opponentColor) && // King's current square (redundant with isKingInCheck but good for clarity)
        !this.isSquareAttacked(kingRow, 5, opponentColor) && // Square king passes through (F-file)
        !this.isSquareAttacked(kingRow, 6, opponentColor)) { // Square king lands on (G-file)
      // Check if H-rook is present
      if (this.board[kingRow][7] && this.board[kingRow][7].type === 'rook' && this.board[kingRow][7].color === color) {
        moves.push({ row: kingRow, col: 6, castling: 'kingside' });
      }
    }

    // Queenside Castling (O-O-O)
    // Conditions: King and A-rook haven't moved, king not in check, path clear, king doesn't pass through check.
    if (!this.hasMoved[color].king && !this.hasMoved[color].rookA &&
        !this.isKingInCheck(color) && // King not currently in check
        this.board[kingRow][1] === null && this.board[kingRow][2] === null && this.board[kingRow][3] === null && // Path is clear
        !this.isSquareAttacked(kingRow, 4, opponentColor) && // King's current square
        !this.isSquareAttacked(kingRow, 3, opponentColor) && // Square king passes through (D-file)
        !this.isSquareAttacked(kingRow, 2, opponentColor)) { // Square king lands on (C-file)
      // Check if A-rook is present
      if (this.board[kingRow][0] && this.board[kingRow][0].type === 'rook' && this.board[kingRow][0].color === color) {
        moves.push({ row: kingRow, col: 2, castling: 'queenside' });
      }
    }
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
