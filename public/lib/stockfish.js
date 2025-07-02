/*
 * Stockfish.js - A JavaScript port of Stockfish chess engine
 * This file serves as a wrapper for the WebAssembly version of Stockfish
 */

class StockfishWrapper {
    constructor() {
        this.engine = null;
        this.isReady = false;
        this.onMessage = null;
        this.loadEngine();
    }

    async loadEngine() {
        try {
            // Load Stockfish WASM module
            const wasmSupported = typeof WebAssembly === 'object';
            if (!wasmSupported) {
                throw new Error('WebAssembly not supported in this browser');
            }

            // Load the appropriate version of Stockfish
            const workerUrl = 'https://cdn.jsdelivr.net/gh/niklasf/stockfish.js@latest/stockfish.js';
            this.engine = new Worker(workerUrl);

            // Set up message handling
            this.engine.onmessage = (e) => {
                if (this.onMessage) {
                    this.onMessage(e.data);
                }
                if (e.data === 'uciok') {
                    this.isReady = true;
                }
            };

            // Initialize UCI mode
            this.sendCommand('uci');
        } catch (error) {
            console.error('Error loading Stockfish:', error);
        }
    }

    sendCommand(cmd) {
        if (this.engine) {
            this.engine.postMessage(cmd);
        }
    }

    evaluatePosition(fen, depth = 15) {
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
        if (!this.engine) return;

        // Stockfish skill levels range from 0 to 20
        level = Math.max(0, Math.min(20, level));
        this.sendCommand('setoption name Skill Level value ' + level);
    }

    stop() {
        if (this.engine) {
            this.sendCommand('stop');
        }
    }

    quit() {
        if (this.engine) {
            this.sendCommand('quit');
            this.engine.terminate();
            this.engine = null;
            this.isReady = false;
        }
    }
}
