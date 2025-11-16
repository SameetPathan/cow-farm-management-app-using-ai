// API Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000/api'  // Development
  : 'https://your-production-api.com/api';  // Production - Update this

export const API_ENDPOINTS = {
  // AI Endpoints
  AI_COW_REGISTRATION: `${API_BASE_URL}/ai/cow-registration`,
  AI_COW_INFO_ANALYSIS: `${API_BASE_URL}/ai/cow-info-analysis`,
  AI_DAILY_REPORTS: `${API_BASE_URL}/ai/daily-reports-analysis`,
  AI_MILK_PRODUCTION: `${API_BASE_URL}/ai/milk-production-analysis`,
  AI_EXPENSES: `${API_BASE_URL}/ai/expenses-analysis`,
  AI_REPORTS: `${API_BASE_URL}/ai/reports-analysis`,
  
  // Chatbot Endpoints
  CHATBOT_CHAT: `${API_BASE_URL}/chatbot/chat`,
  CHATBOT_HISTORY: `${API_BASE_URL}/chatbot/history`,
  CHATBOT_CLEAR: `${API_BASE_URL}/chatbot/history`,
};

export default API_BASE_URL;

