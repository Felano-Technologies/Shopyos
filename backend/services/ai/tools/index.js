// services/ai/tools/index.js
// Aggregates all AI tool modules into a single Gemini-ready declaration list
// plus a name -> tool lookup used to dispatch executed function calls.
const cart = require('./cart.tools');
const product = require('./product.tools');
const order = require('./order.tools');
const store = require('./store.tools');
const favorite = require('./favorite.tools');

const allTools = { ...cart, ...product, ...order, ...store, ...favorite };

module.exports = {
  functionDeclarations: Object.values(allTools).map((tool) => tool.declaration),
  registry: Object.fromEntries(Object.values(allTools).map((tool) => [tool.declaration.name, tool]))
};
