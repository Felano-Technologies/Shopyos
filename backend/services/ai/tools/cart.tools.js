// services/ai/tools/cart.tools.js
const { SchemaType } = require('@google/generative-ai');
const repositories = require('../../../db/repositories');

function formatCart(cart) {
  const items = cart?.cart_items || [];
  return {
    itemCount: items.length,
    items: items.map((item) => ({
      cartItemId: item.id,
      productId: item.product_id,
      name: item.products?.title,
      price: item.products?.price,
      quantity: item.quantity,
      storeName: item.products?.stores?.store_name || null
    }))
  };
}

const get_cart = {
  riskLevel: 'READ_ONLY',
  declaration: {
    name: 'get_cart',
    description: "Get the current user's shopping cart with its items.",
    parameters: { type: SchemaType.OBJECT, properties: {} }
  },
  async execute(args, ctx) {
    const cart = await repositories.carts.getCartWithItems(ctx.userId);
    return formatCart(cart);
  }
};

const add_to_cart = {
  riskLevel: 'LOW',
  declaration: {
    name: 'add_to_cart',
    description: "Add a product to the user's cart.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: { type: SchemaType.STRING, description: 'The product ID to add' },
        quantity: { type: SchemaType.INTEGER, description: 'Quantity to add (default 1)' },
        variantId: { type: SchemaType.STRING, description: 'Optional product variant ID (e.g. a specific size/color)' }
      },
      required: ['productId']
    }
  },
  async execute(args, ctx) {
    const { productId, quantity = 1, variantId = null } = args;
    if (!productId) return { error: 'productId is required' };
    if (quantity < 1) return { error: 'Quantity must be at least 1' };

    const product = await repositories.products.findById(productId);
    if (!product) return { error: 'Product not found' };

    let effectivePrice = product.price;
    let resolvedVariantId = variantId || null;
    if (variantId) {
      const variant = await repositories.productVariants.findWithProduct(variantId);
      if (!variant || variant.product_id_check !== productId) {
        return { error: 'Variant does not belong to this product' };
      }
      if (!variant.is_active || !variant.product_active) {
        return { error: 'This variant is not available' };
      }
      effectivePrice = variant.price ?? product.price;
    }

    const inventory = await repositories.products.getInventory(productId);
    if (inventory?.track_inventory) {
      const availableStock = inventory.stock_quantity - (inventory.reserved_quantity || 0);
      if (availableStock < quantity) {
        return { error: `Insufficient stock — only ${availableStock} available` };
      }
    }

    await repositories.carts.addItem(ctx.userId, productId, effectivePrice, quantity, resolvedVariantId);
    const cart = await repositories.carts.getCartWithItems(ctx.userId);

    setImmediate(() =>
      repositories.carts.touchLastActivity(ctx.userId).catch(() => {})
    );

    return { success: true, message: 'Item added to cart', cart: formatCart(cart) };
  }
};

const remove_from_cart = {
  riskLevel: 'LOW',
  declaration: {
    name: 'remove_from_cart',
    description: "Remove an item from the user's cart by its cart item ID (from get_cart).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        cartItemId: { type: SchemaType.STRING, description: 'The cart item ID to remove (not the product ID)' }
      },
      required: ['cartItemId']
    }
  },
  async execute(args, ctx) {
    const { cartItemId } = args;
    if (!cartItemId) return { error: 'cartItemId is required' };

    const owns = await repositories.carts.verifyCartItemOwnership(ctx.userId, cartItemId);
    if (!owns) return { error: 'Cart item not found' };

    await repositories.carts.removeItem(cartItemId);
    const cart = await repositories.carts.getCartWithItems(ctx.userId);
    return { success: true, message: 'Item removed from cart', cart: formatCart(cart) };
  }
};

const update_cart_quantity = {
  riskLevel: 'LOW',
  declaration: {
    name: 'update_cart_quantity',
    description: "Change the quantity of an item already in the user's cart.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        cartItemId: { type: SchemaType.STRING, description: 'The cart item ID to update (not the product ID)' },
        quantity: { type: SchemaType.INTEGER, description: 'New quantity (must be at least 1)' }
      },
      required: ['cartItemId', 'quantity']
    }
  },
  async execute(args, ctx) {
    const { cartItemId, quantity } = args;
    if (!cartItemId) return { error: 'cartItemId is required' };
    if (!quantity || quantity < 1) return { error: 'Quantity must be at least 1' };

    const owns = await repositories.carts.verifyCartItemOwnership(ctx.userId, cartItemId);
    if (!owns) return { error: 'Cart item not found' };

    await repositories.carts.updateItemQuantity(cartItemId, quantity);
    const cart = await repositories.carts.getCartWithItems(ctx.userId);
    return { success: true, message: 'Cart quantity updated', cart: formatCart(cart) };
  }
};

module.exports = { get_cart, add_to_cart, remove_from_cart, update_cart_quantity };
