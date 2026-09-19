// services/ai/tools/order.tools.js
const { SchemaType } = require('@google/generative-ai');
const repositories = require('../../../db/repositories');

function formatOrderSummary(order) {
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    total: order.total,
    createdAt: order.created_at,
    storeName: order.store?.store_name || null,
    items: (order.order_items || []).map((i) => ({
      productTitle: i.product_title,
      quantity: i.quantity,
      price: i.price
    }))
  };
}

const get_orders = {
  riskLevel: 'READ_ONLY',
  declaration: {
    name: 'get_orders',
    description: "List the user's own orders, optionally filtered by status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: 'Filter by order status (e.g. pending, shipped, delivered, cancelled)' },
        limit: { type: SchemaType.INTEGER, description: 'Max number of orders to return (default 10)' }
      }
    }
  },
  async execute(args, ctx) {
    const { status, limit = 10 } = args;
    const orders = await repositories.orders.getBuyerOrders(ctx.userId, {
      status: status || undefined,
      limit: Math.min(Number(limit) || 10, 20)
    });
    return { orders: (orders || []).map(formatOrderSummary) };
  }
};

const get_order = {
  riskLevel: 'READ_ONLY',
  declaration: {
    name: 'get_order',
    description: "Get full details of one of the user's own orders by orderId.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderId: { type: SchemaType.STRING, description: 'The order ID' }
      },
      required: ['orderId']
    }
  },
  async execute(args, ctx) {
    const { orderId } = args;
    if (!orderId) return { error: 'orderId is required' };

    const order = await repositories.orders.getOrderDetails(orderId);
    if (!order || order.buyer_id !== ctx.userId) return { error: 'Order not found' };

    return formatOrderSummary(order);
  }
};

const track_order = {
  riskLevel: 'READ_ONLY',
  declaration: {
    name: 'track_order',
    description: "Look up one of the user's own orders by its human-readable order number (e.g. SHY1023) and return its status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: 'The order number, e.g. "SHY1023"' }
      },
      required: ['orderNumber']
    }
  },
  async execute(args, ctx) {
    const { orderNumber } = args;
    if (!orderNumber) return { error: 'orderNumber is required' };

    const order = await repositories.orders.findByOrderNumber(orderNumber);
    if (!order || order.buyer_id !== ctx.userId) return { error: 'Order not found' };

    const details = await repositories.orders.getOrderDetails(order.id);
    return formatOrderSummary(details || order);
  }
};

module.exports = { get_orders, get_order, track_order };
