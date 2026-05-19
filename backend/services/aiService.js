// services/aiService.js
// This file acts as a proxy for the separated AI concerns in the ai/ directory.

const marketing = require('./ai/marketing');
const chatbot = require('./ai/chatbot');

module.exports = {
  ...marketing,
  ...chatbot
};
