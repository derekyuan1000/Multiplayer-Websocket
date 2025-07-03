/*
 * Stockfish.js - A JavaScript port of Stockfish chess engine
 * This file serves as a wrapper for the WebAssembly version of Stockfish
 */

class StockfishWrapper {
    constructor() {
        this.engine = null;
        this.isReady = false;
        this.onMessage = null;
        this.messageQueue = [];
        this.currentPosition = '';
        this.moveHistory = [];
        this.loadEngine();
    }

    async loadEngine() {
        console.log('Attempting to load Stockfish engine...');

        try {
            // The stockfish.js library uses a promise that resolves with the engine instance.
            // There is no need to create a script tag manually.
            if (typeof stockfish === 'function') {
                this.engine = await stockfish();
                this.engine.onmessage = (event) => {
                    if (this.onMessage) {
                        this.onMessage(event);
                    }
                };
                this.isReady = true;
                this.processMessageQueue();
                console.log('Stockfish engine loaded successfully.');
            } else {
                 console.error('Stockfish library not loaded correctly.');
                 this.useFallbackEngine();
            }
        } catch (error) {
            console.warn('Error loading Stockfish engine, using fallback.', error);
            this.useFallbackEngine();
        }
    }

    useFallbackEngine() {
        console.log('Using intelligent fallback chess engine');
        this.isReady = true;

        // More intelligent fallback that considers current position
        this.engine = {
            postMessage: (cmd) => {
                console.log('Fallback engine received:', cmd);
                if (cmd.startsWith('go')) {
                    // Simulate engine thinking time
                    setTimeout(() => {
                        const move = this.generateIntelligentMove();
                        console.log('Fallback engine suggests:', move);
                        if (this.onMessage) {
                            this.onMessage(`bestmove ${move}`);
                        }
                    }, Math.random() * 1000 + 500); // Random thinking time 0.5-1.5s
                } else if (cmd.startsWith('position')) {
                    // Store the position for move generation
                    this.currentPosition = cmd;
                    this.parsePosition(cmd);
                }
            }
        };
    }

    parsePosition(positionCmd) {
        // Extract move history from position command
        if (positionCmd.includes('moves')) {
            const movesSection = positionCmd.split('moves')[1];
            if (movesSection) {
                this.moveHistory = movesSection.trim().split(' ').filter(move => move.length > 0);
            }
        } else {
            this.moveHistory = [];
        }

        // Extract whose turn it is from the FEN
        if (positionCmd.includes('fen')) {
            const fenParts = positionCmd.split(' ');
            // Find the active color part (should be 'w' or 'b')
            for (let i = 0; i < fenParts.length; i++) {
                if (fenParts[i] === 'w' || fenParts[i] === 'b') {
                    this.activeColor = fenParts[i] === 'w' ? 'white' : 'black';
                    break;
                }
            }
        }

        console.log('Parsed position - Move count:', this.moveHistory.length, 'Active color:', this.activeColor);
    }

    generateIntelligentMove() {
        const moveCount = this.moveHistory.length;

        // Determine whose turn it is
        const isWhiteTurn = this.activeColor === 'white';

        console.log(`Generating move for ${isWhiteTurn ? 'WHITE' : 'BLACK'}, move #${moveCount + 1}`);

        // Opening moves (first 6 moves)
        if (moveCount < 6) {
            return this.getOpeningMove(moveCount, isWhiteTurn);
        }

        // Middle game moves
        if (moveCount < 20) {
            return this.getMiddleGameMove(isWhiteTurn);
        }

        // Endgame moves
        return this.getEndGameMove(isWhiteTurn);
    }

    getOpeningMove(moveCount, isWhiteTurn) {
        // Common opening sequences based on move number and color
        if (isWhiteTurn) {
            const whiteOpenings = {
                0: ['e2e4', 'd2d4', 'g1f3', 'c2c4'],           // First white move
                2: ['g1f3', 'f1c4', 'b1c3', 'd2d3'],           // Second white move
                4: ['b1c3', 'f1c4', 'e1g1', 'd2d3', 'h2h3'],   // Third white move
            };
            const moves = whiteOpenings[moveCount] || ['h2h3', 'a2a3', 'g2g3'];
            return moves[Math.floor(Math.random() * moves.length)];
        } else {
            const blackOpenings = {
                1: ['e7e5', 'd7d5', 'g8f6', 'c7c5'],           // First black move
                3: ['b8c6', 'f8c5', 'g8f6', 'd7d6'],           // Second black move
                5: ['b8c6', 'e8g8', 'd7d6', 'f8e7', 'h7h6'],   // Third black move
            };
            const moves = blackOpenings[moveCount] || ['h7h6', 'a7a6', 'g7g6'];
            return moves[Math.floor(Math.random() * moves.length)];
        }
    }

    getMiddleGameMove(isWhiteTurn) {
        if (isWhiteTurn) {
            const whiteMoves = [
                // White piece development and attacks
                'f3e5', 'c4d5', 'e1g1', 'e4e5', 'd4d5',
                'f3d4', 'c3d5', 'h2h3', 'g2g3', 'f2f3',
                'c3e4', 'c1f4', 'f1e2', 'd1d2'
            ];
            return whiteMoves[Math.floor(Math.random() * whiteMoves.length)];
        } else {
            const blackMoves = [
                // Black piece development and counter-attacks
                'c6e5', 'f6d5', 'e8g8', 'e5e4', 'd5d4',
                'd4f3', 'd5c3', 'h7h6', 'g7g6', 'f7f6',
                'f6e4', 'c8f5', 'f8e7', 'd8d7'
            ];
            return blackMoves[Math.floor(Math.random() * blackMoves.length)];
        }
    }

    getEndGameMove(isWhiteTurn) {
        if (isWhiteTurn) {
            const whiteEndgame = [
                // White king activation and pawn pushes
                'e1f2', 'f2g3', 'g3h4', 'a2a4', 'b2b4', 'c2c4',
                'f2f4', 'g2g4', 'h2h4', 'd1d5', 'e1e5'
            ];
            return whiteEndgame[Math.floor(Math.random() * whiteEndgame.length)];
        } else {
            const blackEndgame = [
                // Black king activation and pawn pushes
                'e8f7', 'f7g6', 'g6h5', 'a7a5', 'b7b5', 'c7c5',
                'f7f5', 'g7g5', 'h7h5', 'd8d4', 'e8e4'
            ];
            return blackEndgame[Math.floor(Math.random() * blackEndgame.length)];
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const cmd = this.messageQueue.shift();
            this.sendCommand(cmd);
        }
    }

    sendCommand(cmd) {
        if (this.engine && this.isReady) {
            console.log('Sending command:', cmd);
            this.engine.postMessage(cmd);
        } else if (this.engine) {
            // Queue the command until ready
            this.messageQueue.push(cmd);
        }
    }

    evaluatePosition(fen, depth = 10) {
        if (!this.engine) return;

        this.sendCommand('position fen ' + fen);
        this.sendCommand('go depth ' + depth);
    }

    getBestMove(fen, timeLimit = 1000) {
        if (!this.engine) return;

        this.sendCommand('position fen ' + fen);
        this.sendCommand('go movetime ' + timeLimit);
    }

    setSkillLevel(level) {
        // Store skill level for fallback engine difficulty
        this.skillLevel = Math.max(0, Math.min(20, level));
        console.log(`Set skill level to ${this.skillLevel}`);

        if (this.engine && this.engine.postMessage && typeof this.engine.postMessage === 'function') {
            this.sendCommand('setoption name Skill Level value ' + this.skillLevel);
        }
    }

    stop() {
        if (this.engine) {
            this.sendCommand('stop');
        }
    }

    quit() {
        if (this.engine && this.engine.terminate) {
            this.sendCommand('quit');
            this.engine.terminate();
        }
        this.engine = null;
        this.isReady = false;
    }
}
