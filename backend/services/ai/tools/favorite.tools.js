// services/ai/tools/favorite.tools.js
const { SchemaType } = require('@google/generative-ai');
const repositories = require('../../../db/repositories');

const favorite_product = {
  riskLevel: 'LOW',
  declaration: {
    name: 'favorite_product',
    description: 'Save a product to the user\'s favorites.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: { type: SchemaType.STRING, description: 'The product ID to favorite' }
      },
      required: ['productId']
    }
  },
  async execute(args, ctx) {
    const { productId } = args;
    if (!productId) return { error: 'productId is required' };

    const alreadyFavorited = await repositories.favorites.isFavorited(ctx.userId, productId);
    if (!alreadyFavorited) {
      await repositories.favorites.create({ user_id: ctx.userId, product_id: productId });
    }
    return { success: true, message: 'Product saved to favorites' };
  }
};

const unfavorite_product = {
  riskLevel: 'LOW',
  declaration: {
    name: 'unfavorite_product',
    description: "Remove a product from the user's favorites.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: { type: SchemaType.STRING, description: 'The product ID to unfavorite' }
      },
      required: ['productId']
    }
  },
  async execute(args, ctx) {
    const { productId } = args;
    if (!productId) return { error: 'productId is required' };

    await repositories.favorites.removeByUserAndProduct(ctx.userId, productId);
    return { success: true, message: 'Product removed from favorites' };
  }
};

module.exports = { favorite_product, unfavorite_product };
