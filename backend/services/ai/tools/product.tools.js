// services/ai/tools/product.tools.js
const { SchemaType } = require('@google/generative-ai');
const repositories = require('../../../db/repositories');

// Keep tool responses small and text-friendly — the model reads these as
// JSON, so we strip heavy nested objects (raw image arrays, etc.) that would
// burn tokens without helping the reply.
function formatProductSummary(p) {
  return {
    productId: p.id,
    name: p.title,
    price: p.price,
    compareAtPrice: p.compare_at_price ?? null,
    category: p.category,
    rating: p.average_rating || 0,
    reviewCount: p.total_reviews || 0,
    storeId: p.store_id,
    storeName: p.stores?.store_name || null
  };
}

const search_products = {
  riskLevel: 'READ_ONLY',
  declaration: {
    name: 'search_products',
    description: 'Search Shopyos products by keyword and/or filters. Use this whenever the user asks to find, browse, or look up products.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Free-text search keywords, e.g. "black sneakers"' },
        category: { type: SchemaType.STRING, description: 'Product category filter' },
        minPrice: { type: SchemaType.NUMBER, description: 'Minimum price in GHS' },
        maxPrice: { type: SchemaType.NUMBER, description: 'Maximum price in GHS' },
        sortBy: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: ['relevance', 'price_asc', 'price_desc', 'rating', 'popular'],
          description: 'How to sort results'
        },
        limit: { type: SchemaType.INTEGER, description: 'Max number of results to return (default 10, max 10)' }
      }
    }
  },
  async execute(args) {
    const { query, category, minPrice, maxPrice, sortBy = 'relevance', limit = 10 } = args;

    let sortColumn = 'created_at';
    let sortAscending = false;
    const discoveryShuffle = sortBy === 'relevance';
    if (sortBy === 'price_asc') {
      sortColumn = 'price';
      sortAscending = true;
    } else if (sortBy === 'price_desc') {
      sortColumn = 'price';
    } else if (sortBy === 'rating') {
      sortColumn = 'average_rating';
    } else if (sortBy === 'popular') {
      sortColumn = 'total_sales';
    }

    const cappedLimit = Math.min(Number(limit) || 10, 10);

    const { data, count } = await repositories.products.search({
      query: query || undefined,
      category: category || undefined,
      minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
      sortBy: sortColumn,
      ascending: sortAscending,
      discoveryShuffle,
      limit: cappedLimit,
      offset: 0
    });

    return {
      totalCount: count,
      products: (data || []).map(formatProductSummary)
    };
  }
};

const get_product = {
  riskLevel: 'READ_ONLY',
  declaration: {
    name: 'get_product',
    description: 'Get full details for a single product by its productId. Use this to confirm details (price, stock, description) before acting on a product.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: { type: SchemaType.STRING, description: 'The product ID' }
      },
      required: ['productId']
    }
  },
  async execute(args) {
    const { productId } = args;
    if (!productId) return { error: 'productId is required' };

    const product = await repositories.products.getProductDetails(productId);
    if (!product) return { error: 'Product not found' };

    const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;

    return {
      productId: product.id,
      name: product.title,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compare_at_price ?? null,
      category: product.category,
      rating: product.average_rating || 0,
      reviewCount: product.total_reviews || 0,
      inStock: !inventory?.track_inventory || (inventory.quantity - (inventory.reserved_quantity || 0)) > 0,
      storeId: product.store_id,
      storeName: product.stores?.store_name || null,
      storeVerified: !!product.stores?.is_verified
    };
  }
};

module.exports = { search_products, get_product };
