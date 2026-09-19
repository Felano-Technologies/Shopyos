// services/ai/tools/store.tools.js
const { SchemaType } = require('@google/generative-ai');
const repositories = require('../../../db/repositories');

const follow_store = {
  riskLevel: 'LOW',
  declaration: {
    name: 'follow_store',
    description: 'Follow a store on behalf of the user.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        storeId: { type: SchemaType.STRING, description: 'The store ID to follow' }
      },
      required: ['storeId']
    }
  },
  async execute(args, ctx) {
    const { storeId } = args;
    if (!storeId) return { error: 'storeId is required' };

    const alreadyFollowing = await repositories.stores.isFollowing(ctx.userId, storeId);
    if (!alreadyFollowing) {
      await repositories.stores.followStore(ctx.userId, storeId);
    }
    return { success: true, message: 'Now following the store' };
  }
};

const unfollow_store = {
  riskLevel: 'LOW',
  declaration: {
    name: 'unfollow_store',
    description: 'Unfollow a store on behalf of the user.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        storeId: { type: SchemaType.STRING, description: 'The store ID to unfollow' }
      },
      required: ['storeId']
    }
  },
  async execute(args, ctx) {
    const { storeId } = args;
    if (!storeId) return { error: 'storeId is required' };

    await repositories.stores.unfollowStore(ctx.userId, storeId);
    return { success: true, message: 'Unfollowed the store' };
  }
};

module.exports = { follow_store, unfollow_store };
