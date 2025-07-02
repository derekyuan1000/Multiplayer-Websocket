# Multiplayer Websocket Game Platform

## Overview
The Multiplayer Game Platform is a web-based application that allows users to play board games online with real-time multiplayer capabilities. Currently, it features a fully functional chess game, with plans to expand to other board games in the future.

## Features
- **Multiple Game Selection**: Choose from a variety of board games (with Chess currently available and more coming soon)
- **Online Multiplayer**: Join servers and play chess with other users in real-time
- **Player Roles**: Select whether to play as white or black pieces
- **Time Controls**: Choose from various preset time controls (Blitz, Rapid) or create custom time settings
- **Visual Board Notation**: Clear rank and file labels for easy move tracking
- **Player Status**: See who's online and their current game status
- **Real-time Chat**: Communicate with other players during games
- **Game Analysis**: Analyze completed games with Stockfish
- **Responsive Design**: Optimized for desktop and mobile devices

# Chess Game Rules and Capabilities
- **Complete Chess Rules**: Full implementation of chess rules including:
  - Castling (kingside and queenside)
  - En passant captures
  - Pawn promotion
  - Check and checkmate detection
- **Time Management**: Clock with increment support and timeout detection
- **Game Outcomes**: Win by checkmate, resignation, or timeout

## Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/chess-game-platform.git
   cd chess-game-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`.

## Development

For development mode with live reload:
```bash
npm run dev
```

## Technologies Used
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express, Socket.IO
- **Chess Engine**: Stockfish

## TODO
- Improve Stockfish integration.
- Enhance lobby features.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or features.
