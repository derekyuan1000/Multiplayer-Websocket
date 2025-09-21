/**
 * Chess.js - A JavaScript chess library for chess move generation/validation,
 * piece placement/movement, and check/checkmate/draw detection
 */
class Chess {
  constructor() {
    this.SQUARES = [
      'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8',
      'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
      'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
      'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
      'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
      'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
      'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
      'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'
    ];

    this.PIECES = {
      PAWN: 'p',
      KNIGHT: 'n',
      BISHOP: 'b',
      ROOK: 'r',
      QUEEN: 'q',
      KING: 'k'
    };

    this.COLORS = {
      WHITE: 'w',
      BLACK: 'b'
    };

    this.reset();
  }

  reset() {
    this.board = new Array(128);
    this.kings = { w: -1, b: -1 }; // Track king positions
    this.turn = this.COLORS.WHITE;
    this.castling = { w: 0, b: 0 }; // kingside: 1, queenside: 2
    this.epSquare = -1; // en passant square
    this.halfMoves = 0;
    this.moveNumber = 1;
    this.history = [];

    // Initialize the board with pieces
    this.clear();
    this.setupStandardPosition();
  }

  clear() {
    for (let i = 0; i < 128; i++) {
      this.board[i] = null;
    }
  }

  setupStandardPosition() {
    // Initial position
    const position = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];

    // Place the pieces
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = position[i][j];
        if (piece) {
          this.put({
            type: piece.toLowerCase(),
            color: (piece === piece.toUpperCase()) ? this.COLORS.WHITE : this.COLORS.BLACK
          }, this.algebraic(i * 16 + j));
        }
      }
    }

    this.castling = { w: 3, b: 3 }; // Both sides can castle
    this.turn = this.COLORS.WHITE;
    this.epSquare = -1;
    this.halfMoves = 0;
    this.moveNumber = 1;
  }

  // Convert from 0x88 coordinates to algebraic notation
  algebraic(square) {
    const f = square & 0xf;
    const r = square >> 4;
    return 'abcdefgh'.charAt(f) + '87654321'.charAt(r);
  }

  // Convert from algebraic notation to 0x88 coordinates
  algebraicToIdx(square) {
    const f = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const r = '8'.charCodeAt(0) - square.charCodeAt(1);
    return r * 16 + f;
  }

  // Add a piece to the board
  put(piece, square) {
    const idx = this.algebraicToIdx(square);
    this.board[idx] = piece;

    // Track king position
    if (piece.type === this.PIECES.KING) {
      this.kings[piece.color] = idx;
    }

    return true;
  }

  // Get piece at square
  get(square) {
    return this.board[this.algebraicToIdx(square)];
  }

  // Remove piece at square
  remove(square) {
    const piece = this.get(square);
    this.board[this.algebraicToIdx(square)] = null;

    // Update king position
    if (piece && piece.type === this.PIECES.KING) {
      this.kings[piece.color] = -1;
    }

    return piece;
  }

  // Generate all legal moves
  generateMoves(options = {}) {
    const moves = [];
    const us = this.turn;
    const them = us === this.COLORS.WHITE ? this.COLORS.BLACK : this.COLORS.WHITE;

    // Loop through all squares
    for (let i = 0; i < 128; i++) {
      // Check if square is off the board
      if (i & 0x88) {
        i += 7;
        continue;
      }

      const piece = this.board[i];
      if (!piece || piece.color !== us) continue;

      // Handle different piece types
      switch (piece.type) {
        case this.PIECES.PAWN:
          this.generatePawnMoves(i, moves);
          break;
        case this.PIECES.KNIGHT:
          this.generateKnightMoves(i, moves);
          break;
        case this.PIECES.BISHOP:
          this.generateBishopMoves(i, moves);
          break;
        case this.PIECES.ROOK:
          this.generateRookMoves(i, moves);
          break;
        case this.PIECES.QUEEN:
          this.generateQueenMoves(i, moves);
          break;
        case this.PIECES.KING:
          this.generateKingMoves(i, moves);
          break;
      }
    }

    // Filter out moves that would leave the king in check
    if (!options.legal) return moves;

    return moves.filter(move => {
      this.makeMove(move);
      const isLegal = !this.isKingAttacked(us);
      this.undoMove();
      return isLegal;
    });
  }

  // Basic moves for pawns
  generatePawnMoves(square, moves) {
    const us = this.turn;
    const direction = us === this.COLORS.WHITE ? -16 : 16;

    // Forward one square
    let to = square + direction;
    if (!(to & 0x88) && !this.board[to]) {
      this.addPawnMoves(square, to, moves);

      // Forward two squares (if on starting rank)
      if ((us === this.COLORS.WHITE && (square >= 0x60 && square <= 0x67)) ||
          (us === this.COLORS.BLACK && (square >= 0x10 && square <= 0x17))) {
        to = square + direction * 2;
        if (!this.board[to]) {
          moves.push({
            from: this.algebraic(square),
            to: this.algebraic(to),
            piece: this.board[square].type,
            color: us
          });
        }
      }
    }

    // Captures (including en passant)
    for (let offset of [direction - 1, direction + 1]) {
      to = square + offset;
      if (to & 0x88) continue; // Off board

      // Regular capture
      if (this.board[to] && this.board[to].color !== us) {
        this.addPawnMoves(square, to, moves);
      }
      // En passant capture
      else if (to === this.epSquare) {
        moves.push({
          from: this.algebraic(square),
          to: this.algebraic(to),
          piece: this.board[square].type,
          color: us,
          flags: 'e' // en passant
        });
      }
    }
  }

  // Handle pawn promotion
  addPawnMoves(from, to, moves) {
    const us = this.turn;
    const toRank = to >> 4;

    // Check if pawn reaches the back rank (promotion)
    if (toRank === 0 || toRank === 7) {
      for (let piece of [this.PIECES.QUEEN, this.PIECES.ROOK, this.PIECES.BISHOP, this.PIECES.KNIGHT]) {
        moves.push({
          from: this.algebraic(from),
          to: this.algebraic(to),
          piece: this.board[from].type,
          color: us,
          promotion: piece
        });
      }
    } else {
      moves.push({
        from: this.algebraic(from),
        to: this.algebraic(to),
        piece: this.board[from].type,
        color: us
      });
    }
  }

  // Knight moves
  generateKnightMoves(square, moves) {
    const us = this.turn;
    const offsets = [18, 33, 31, 14, -18, -33, -31, -14];

    for (let offset of offsets) {
      const to = square + offset;
      if (to & 0x88) continue; // Off board

      const pieceAtDest = this.board[to];
      if (!pieceAtDest || pieceAtDest.color !== us) {
        moves.push({
          from: this.algebraic(square),
          to: this.algebraic(to),
          piece: this.board[square].type,
          color: us,
          captured: pieceAtDest ? pieceAtDest.type : null
        });
      }
    }
  }

  // Bishop moves
  generateBishopMoves(square, moves) {
    const us = this.turn;
    const directions = [15, 17, -15, -17]; // Diagonal directions

    for (let direction of directions) {
      let to = square;

      while (true) {
        to += direction;
        if (to & 0x88) break; // Off board

        const pieceAtDest = this.board[to];
        if (!pieceAtDest) {
          moves.push({
            from: this.algebraic(square),
            to: this.algebraic(to),
            piece: this.board[square].type,
            color: us
          });
        } else {
          if (pieceAtDest.color !== us) {
            moves.push({
              from: this.algebraic(square),
              to: this.algebraic(to),
              piece: this.board[square].type,
              color: us,
              captured: pieceAtDest.type
            });
          }
          break;
        }
      }
    }
  }

  // Rook moves
  generateRookMoves(square, moves) {
    const us = this.turn;
    const directions = [16, 1, -16, -1]; // Horizontal and vertical

    for (let direction of directions) {
      let to = square;

      while (true) {
        to += direction;
        if (to & 0x88) break; // Off board

        const pieceAtDest = this.board[to];
        if (!pieceAtDest) {
          moves.push({
            from: this.algebraic(square),
            to: this.algebraic(to),
            piece: this.board[square].type,
            color: us
          });
        } else {
          if (pieceAtDest.color !== us) {
            moves.push({
              from: this.algebraic(square),
              to: this.algebraic(to),
              piece: this.board[square].type,
              color: us,
              captured: pieceAtDest.type
            });
          }
          break;
        }
      }
    }
  }

  // Queen moves (combination of rook and bishop)
  generateQueenMoves(square, moves) {
    this.generateBishopMoves(square, moves);
    this.generateRookMoves(square, moves);
  }

  // King moves including castling
  generateKingMoves(square, moves) {
    const us = this.turn;
    const offsets = [1, 17, 16, 15, -1, -17, -16, -15];

    // Regular king moves
    for (let offset of offsets) {
      const to = square + offset;
      if (to & 0x88) continue; // Off board

      const pieceAtDest = this.board[to];
      if (!pieceAtDest || pieceAtDest.color !== us) {
        moves.push({
          from: this.algebraic(square),
          to: this.algebraic(to),
          piece: this.board[square].type,
          color: us,
          captured: pieceAtDest ? pieceAtDest.type : null
        });
      }
    }

    // Castling moves
    if (us === this.COLORS.WHITE && this.castling.w > 0) {
      // Kingside
      if ((this.castling.w & 1) &&
          !this.board[square + 1] &&
          !this.board[square + 2]) {
        if (!this.isSquareAttacked(square, this.COLORS.BLACK) &&
            !this.isSquareAttacked(square + 1, this.COLORS.BLACK)) {
          moves.push({
            from: this.algebraic(square),
            to: 'g1',
            piece: this.board[square].type,
            color: us,
            flags: 'k' // kingside castling
          });
        }
      }

      // Queenside
      if ((this.castling.w & 2) &&
          !this.board[square - 1] &&
          !this.board[square - 2] &&
          !this.board[square - 3]) {
        if (!this.isSquareAttacked(square, this.COLORS.BLACK) &&
            !this.isSquareAttacked(square - 1, this.COLORS.BLACK)) {
          moves.push({
            from: this.algebraic(square),
            to: 'c1',
            piece: this.board[square].type,
            color: us,
            flags: 'q' // queenside castling
          });
        }
      }
    } else if (us === this.COLORS.BLACK && this.castling.b > 0) {
      // Kingside
      if ((this.castling.b & 1) &&
          !this.board[square + 1] &&
          !this.board[square + 2]) {
        if (!this.isSquareAttacked(square, this.COLORS.WHITE) &&
            !this.isSquareAttacked(square + 1, this.COLORS.WHITE)) {
          moves.push({
            from: this.algebraic(square),
            to: 'g8',
            piece: this.board[square].type,
            color: us,
            flags: 'k' // kingside castling
          });
        }
      }

      // Queenside
      if ((this.castling.b & 2) &&
          !this.board[square - 1] &&
          !this.board[square - 2] &&
          !this.board[square - 3]) {
        if (!this.isSquareAttacked(square, this.COLORS.WHITE) &&
            !this.isSquareAttacked(square - 1, this.COLORS.WHITE)) {
          moves.push({
            from: this.algebraic(square),
            to: 'c8',
            piece: this.board[square].type,
            color: us,
            flags: 'q' // queenside castling
          });
        }
      }
    }
  }

  // Check if a square is under attack
  isSquareAttacked(square, byColor) {
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; } // Off board, skip

      const piece = this.board[i];
      if (!piece || piece.color !== byColor) continue;

      // Simple attack detection for each piece type
      if (piece.type === this.PIECES.PAWN) {
        const direction = byColor === this.COLORS.WHITE ? -16 : 16;
        if ((square === i + direction - 1 || square === i + direction + 1) &&
            !(square & 0x88)) {
          return true;
        }
      } else if (piece.type === this.PIECES.KNIGHT) {
        const offsets = [18, 33, 31, 14, -18, -33, -31, -14];
        for (let offset of offsets) {
          if (square === i + offset) return true;
        }
      } else if (piece.type === this.PIECES.KING) {
        const offsets = [1, 17, 16, 15, -1, -17, -16, -15];
        for (let offset of offsets) {
          if (square === i + offset) return true;
        }
      } else {
        // For sliding pieces (bishop, rook, queen)
        let directions = [];
        if (piece.type === this.PIECES.BISHOP || piece.type === this.PIECES.QUEEN) {
          directions = directions.concat([15, 17, -15, -17]);
        }
        if (piece.type === this.PIECES.ROOK || piece.type === this.PIECES.QUEEN) {
          directions = directions.concat([16, 1, -16, -1]);
        }

        for (let direction of directions) {
          let to = i;
          while (true) {
            to += direction;
            if (to & 0x88) break; // Off board
            if (to === square) return true;
            if (this.board[to]) break; // Piece blocks the attack
          }
        }
      }
    }

    return false;
  }

  // Check if the king is in check
  isKingAttacked(color) {
    return this.isSquareAttacked(this.kings[color], color === this.COLORS.WHITE ? this.COLORS.BLACK : this.COLORS.WHITE);
  }

  // Make a move on the board
  makeMove(move) {
    const from = this.algebraicToIdx(move.from);
    const to = this.algebraicToIdx(move.to);

    // Save state for undoing
    const oldState = {
      board: [...this.board],
      kings: { ...this.kings },
      turn: this.turn,
      castling: { ...this.castling },
      epSquare: this.epSquare,
      halfMoves: this.halfMoves,
      moveNumber: this.moveNumber
    };

    this.history.push(oldState);

    const piece = this.board[from];
    let capturedPiece = this.board[to];

    // Move the piece
    this.board[to] = piece;
    this.board[from] = null;

    // Handle king position
    if (piece.type === this.PIECES.KING) {
      this.kings[piece.color] = to;

      // Handle castling
      if (move.flags === 'k') { // Kingside
        const rookFrom = piece.color === this.COLORS.WHITE ? 0x77 : 0x07;
        const rookTo = piece.color === this.COLORS.WHITE ? 0x75 : 0x05;
        this.board[rookTo] = this.board[rookFrom];
        this.board[rookFrom] = null;
      } else if (move.flags === 'q') { // Queenside
        const rookFrom = piece.color === this.COLORS.WHITE ? 0x70 : 0x00;
        const rookTo = piece.color === this.COLORS.WHITE ? 0x73 : 0x03;
        this.board[rookTo] = this.board[rookFrom];
        this.board[rookFrom] = null;
      }

      // Disable castling for this king
      this.castling[piece.color] = 0;
    }

    // Handle rook move (disable castling)
    if (piece.type === this.PIECES.ROOK) {
      if (piece.color === this.COLORS.WHITE) {
        if (from === 0x70) this.castling.w &= ~2; // Queenside
        if (from === 0x77) this.castling.w &= ~1; // Kingside
      } else {
        if (from === 0x00) this.castling.b &= ~2; // Queenside
        if (from === 0x07) this.castling.b &= ~1; // Kingside
      }
    }

    // Handle pawn promotion
    if (move.promotion) {
      this.board[to] = { type: move.promotion, color: piece.color };
    }

    // Handle en passant capture
    if (move.flags === 'e') {
      const captureSquare = to + (piece.color === this.COLORS.WHITE ? 16 : -16);
      capturedPiece = this.board[captureSquare];
      this.board[captureSquare] = null;
    }

    // Set en passant square
    this.epSquare = -1;
    if (piece.type === this.PIECES.PAWN &&
        Math.abs(to - from) === 32) {
      this.epSquare = (from + to) >> 1;
    }

    // Update half moves
    if (piece.type === this.PIECES.PAWN || capturedPiece) {
      this.halfMoves = 0;
    } else {
      this.halfMoves++;
    }

    // Update full moves
    if (this.turn === this.COLORS.BLACK) {
      this.moveNumber++;
    }

    // Switch turn
    this.turn = this.turn === this.COLORS.WHITE ? this.COLORS.BLACK : this.COLORS.WHITE;

    return oldState;
  }

  // Undo the last move
  undoMove() {
    if (this.history.length === 0) return null;

    const oldState = this.history.pop();

    this.board = oldState.board;
    this.kings = oldState.kings;
    this.turn = oldState.turn;
    this.castling = oldState.castling;
    this.epSquare = oldState.epSquare;
    this.halfMoves = oldState.halfMoves;
    this.moveNumber = oldState.moveNumber;

    return true;
  }

  // Check if a move is legal
  isMoveLegal(move) {
    const legalMoves = this.generateMoves({ legal: true });
    return legalMoves.some(m => m.from === move.from && m.to === move.to);
  }

  // Check if the game is over
  isGameOver() {
    // No legal moves
    const legalMoves = this.generateMoves({ legal: true });
    if (legalMoves.length === 0) {
      return this.isKingAttacked(this.turn) ? 'checkmate' : 'stalemate';
    }

    // Insufficient material
    if (this.isInsufficientMaterial()) {
      return 'draw-insufficient';
    }

    // 50 move rule
    if (this.halfMoves >= 100) {
      return 'draw-fifty';
    }

    // Threefold repetition - simplified implementation
    // Would require tracking full positions for proper implementation

    return false;
  }

  // Check if there's insufficient material for checkmate
  isInsufficientMaterial() {
    const pieces = { w: {}, b: {} };
    let bishopColors = { w: -1, b: -1 };

    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; }

      const piece = this.board[i];
      if (!piece) continue;

      pieces[piece.color] = pieces[piece.color] || {};
      pieces[piece.color][piece.type] = (pieces[piece.color][piece.type] || 0) + 1;

      if (piece.type === this.PIECES.BISHOP) {
        // Store the color of the square (light/dark)
        const squareColor = ((i >> 4) + (i & 7)) % 2;
        if (bishopColors[piece.color] === -1) {
          bishopColors[piece.color] = squareColor;
        } else if (bishopColors[piece.color] !== squareColor) {
          // Bishops on different colors
          bishopColors[piece.color] = -2;
        }
      }
    }

    // K vs K
    if (Object.keys(pieces.w).length === 1 && Object.keys(pieces.b).length === 1) {
      return true;
    }

    // K vs K+N or K vs K+B
    if ((Object.keys(pieces.w).length === 1 &&
         Object.keys(pieces.b).length === 2 &&
         (pieces.b[this.PIECES.KNIGHT] === 1 || pieces.b[this.PIECES.BISHOP] === 1)) ||
        (Object.keys(pieces.b).length === 1 &&
         Object.keys(pieces.w).length === 2 &&
         (pieces.w[this.PIECES.KNIGHT] === 1 || pieces.w[this.PIECES.BISHOP] === 1))) {
      return true;
    }

    // K+B vs K+B with bishops on the same color
    if (Object.keys(pieces.w).length === 2 && pieces.w[this.PIECES.BISHOP] === 1 &&
        Object.keys(pieces.b).length === 2 && pieces.b[this.PIECES.BISHOP] === 1 &&
        bishopColors.w !== -2 && bishopColors.b !== -2 &&
        bishopColors.w === bishopColors.b) {
      return true;
    }

    return false;
  }

  // Get the FEN (Forsyth-Edwards Notation) for the current position
  fen() {
    let empty = 0;
    let fen = '';

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const square = i * 16 + j;
        const piece = this.board[square];

        if (!piece) {
          empty++;
        } else {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }

          const pieceChar = piece.type;
          fen += (piece.color === this.COLORS.WHITE) ? pieceChar.toUpperCase() : pieceChar;
        }

        if (j === 7) {
          if (empty > 0) {
            fen += empty;
          }

          if (i !== 7) {
            fen += '/';
          }

          empty = 0;
        }
      }
    }

    // Active color
    fen += ' ' + (this.turn === this.COLORS.WHITE ? 'w' : 'b');

    // Castling availability
    let castling = '';
    if (this.castling.w & 1) castling += 'K';
    if (this.castling.w & 2) castling += 'Q';
    if (this.castling.b & 1) castling += 'k';
    if (this.castling.b & 2) castling += 'q';
    fen += ' ' + (castling || '-');

    // En passant square
    fen += ' ';
    if (this.epSquare === -1) {
      fen += '-';
    } else {
      fen += this.algebraic(this.epSquare);
    }

    // Halfmoves and fullmoves
    fen += ' ' + this.halfMoves;
    fen += ' ' + this.moveNumber;

    return fen;
  }

  // Load a position from FEN
  load(fen) {
    // Default FEN for the starting position
    if (!fen) fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    this.reset();

    // Parse FEN
    const fields = fen.split(' ');
    const position = fields[0];
    const activeColor = fields[1];
    const castling = fields[2];
    const epSquare = fields[3];
    const halfMoves = parseInt(fields[4]) || 0;
    const fullMoves = parseInt(fields[5]) || 1;

    // Parse piece placement
    let square = 0;
    for (let i = 0; i < position.length; i++) {
      const c = position.charAt(i);

      if (c === '/') {
        square = square + 8 - (square % 8) + 8;
      } else if ('12345678'.indexOf(c) !== -1) {
        square += parseInt(c);
      } else {
        const color = (c === c.toUpperCase()) ? this.COLORS.WHITE : this.COLORS.BLACK;
        const piece = { type: c.toLowerCase(), color };
        this.put(piece, this.algebraic(square));
        square++;
      }
    }

    // Set active color
    this.turn = activeColor === 'w' ? this.COLORS.WHITE : this.COLORS.BLACK;

    // Set castling availability
    this.castling = { w: 0, b: 0 };
    if (castling.indexOf('K') !== -1) this.castling.w |= 1;
    if (castling.indexOf('Q') !== -1) this.castling.w |= 2;
    if (castling.indexOf('k') !== -1) this.castling.b |= 1;
    if (castling.indexOf('q') !== -1) this.castling.b |= 2;

    // Set en passant square
    this.epSquare = epSquare === '-' ? -1 : this.algebraicToIdx(epSquare);

    // Set move counters
    this.halfMoves = halfMoves;
    this.moveNumber = fullMoves;

    return true;
  }

  // Get ASCII representation of the board
  ascii() {
    let s = '   +------------------------+\n';

    for (let i = 0; i < 8; i++) {
      s += ' ' + (8 - i) + ' |';

      for (let j = 0; j < 8; j++) {
        const square = i * 16 + j;
        const piece = this.board[square];

        if (!piece) {
          s += ' . ';
        } else {
          const pieceChar = piece.type;
          s += ' ' + (piece.color === this.COLORS.WHITE ? pieceChar.toUpperCase() : pieceChar.toLowerCase()) + ' ';
        }
      }

      s += '|\n';
    }

    s += '   +------------------------+\n';
    s += '     a  b  c  d  e  f  g  h\n';

    return s;
  }

  // Convert a move to SAN (Standard Algebraic Notation)
  moveToSan(move) {
    let san = '';

    // Make the move temporarily
    const oldState = this.makeMove(move);

    // Check if it's check or checkmate
    const isCheck = this.isKingAttacked(this.turn);
    const isGameOver = this.isGameOver();
    const isCheckmate = isGameOver === 'checkmate';

    // Undo the move
    this.undoMove();

    // Piece letter
    if (move.piece !== this.PIECES.PAWN) {
      san += move.piece.toUpperCase();

      // Check for ambiguity (when two pieces of same type can move to same square)
      const allMoves = this.generateMoves({ legal: true });
      const ambiguousMoves = allMoves.filter(m =>
        m.piece === move.piece &&
        m.to === move.to &&
        m.from !== move.from
      );

      if (ambiguousMoves.length > 0) {
        // Try to disambiguate by file first
        const fromFile = move.from.charAt(0);
        let fileAmbiguity = false;

        for (const ambiguousMove of ambiguousMoves) {
          if (ambiguousMove.from.charAt(0) === fromFile) {
            fileAmbiguity = true;
            break;
          }
        }

        if (!fileAmbiguity) {
          san += fromFile;
        } else {
          // If file is ambiguous, try rank
          const fromRank = move.from.charAt(1);
          let rankAmbiguity = false;

          for (const ambiguousMove of ambiguousMoves) {
            if (ambiguousMove.from.charAt(1) === fromRank) {
              rankAmbiguity = true;
              break;
            }
          }

          if (!rankAmbiguity) {
            san += fromRank;
          } else {
            // If both are ambiguous, use the full from square
            san += move.from;
          }
        }
      }
    }

    // If it's a capture
    if (move.captured || move.flags === 'e') {
      if (move.piece === this.PIECES.PAWN) {
        san += move.from.charAt(0);
      }
      san += 'x';
    }

    // Destination square
    san += move.to;

    // Promotion
    if (move.promotion) {
      san += '=' + move.promotion.toUpperCase();
    }

    // Castling
    if (move.flags === 'k') {
      san = 'O-O';
    } else if (move.flags === 'q') {
      san = 'O-O-O';
    }

    // Check/Checkmate
    if (isCheckmate) {
      san += '#';
    } else if (isCheck) {
      san += '+';
    }

    return san;
  }

  // Parse a SAN move and convert it to a move object
  sanToMove(san) {
    // TODO: Implement full SAN parsing
    // This would require parsing algebraic notation and finding the matching move

    // For now, we implement a simple matcher that supports standard moves
    const moves = this.generateMoves({ legal: true });

    // Special case for castling
    if (san === 'O-O') {
      return moves.find(m => m.flags === 'k');
    } else if (san === 'O-O-O') {
      return moves.find(m => m.flags === 'q');
    }

    // Handle promotion
    let promotion = null;
    if (san.indexOf('=') !== -1) {
      const promotionChar = san.charAt(san.indexOf('=') + 1).toLowerCase();
      promotion = promotionChar;
      san = san.substring(0, san.indexOf('='));
    }

    // Remove check/checkmate indicators
    san = san.replace(/[+#]$/, '');

    // Destination square is always the last two characters (after removing check/checkmate/promotion)
    const to = san.substring(san.length - 2);

    // Handle captures and pawn moves
    let piece = this.PIECES.PAWN;
    let from = '';

    if (san.length > 2) {
      if ('NBRQK'.indexOf(san.charAt(0)) !== -1) {
        piece = san.charAt(0).toLowerCase();

        // Extract disambiguation info
        from = san.substring(1, san.indexOf('x') !== -1 ? san.indexOf('x') : san.length - 2);
      } else if (san.indexOf('x') !== -1) {
        // Pawn capture
        from = san.substring(0, san.indexOf('x'));
      }
    }

    // Find matching move
    for (const move of moves) {
      if (move.to === to && move.piece === piece) {
        // Check disambiguation
        if (from) {
          if (from.length === 1) {
            // Could be file or rank
            if ('abcdefgh'.indexOf(from) !== -1) {
              // File
              if (move.from.charAt(0) !== from) continue;
            } else {
              // Rank
              if (move.from.charAt(1) !== from) continue;
            }
          } else if (move.from !== from) {
            continue;
          }
        }

        // Check promotion
        if (promotion && (!move.promotion || move.promotion !== promotion)) continue;
        if (!promotion && move.promotion) continue;

        return move;
      }
    }

    return null;
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.Chess = Chess;
}

// Export for Node.js
if (typeof module !== 'undefined') {
  module.exports = Chess;
}
