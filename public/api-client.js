/**
 * API Service for Chess Game
 * Handles communication with the API server
 */
const API_URL = 'http://localhost:3001/api';

const ChessAPI = {
  /**
   * Get all active games
   * @returns {Promise} Promise that resolves to games data
   */
  getActiveGames: async () => {
    try {
      const response = await fetch(`${API_URL}/games`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching active games:', error);
      return { count: 0, games: [] };
    }
  },

  /**
   * Get a specific game by ID
   * @param {string} gameId - ID of the game to retrieve
   * @returns {Promise} Promise that resolves to game data
   */
  getGameById: async (gameId) => {
    try {
      const response = await fetch(`${API_URL}/games/${gameId}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching game ${gameId}:`, error);
      return null;
    }
  },

  /**
   * Get chess server statistics
   * @returns {Promise} Promise that resolves to stats data
   */
  getStatistics: async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return {};
    }
  }
};

// Export for use in browser
window.ChessAPI = ChessAPI;
