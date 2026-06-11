export const queryKeys = {
  products: {
    all: ['products'] as const,
    lists: () => ['products', 'list'] as const,
    list: (filters?: ProductFilters) => ['products', 'list', filters] as const,
    infinite: (filters?: ProductFilters) => ['products', 'infinite', filters] as const,
    details: () => ['products', 'detail'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    searchAll: () => ['products', 'search'] as const,
    search: (query: string, filters?: ProductFilters) =>
      ['products', 'search', query, filters] as const,
    featured: () => ['products', 'featured'] as const,
    byCategory: (categoryId: string) =>
      ['products', 'category', categoryId] as const,
  },

  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
    detail: (id: string) => ['categories', 'detail', id] as const,
  },

  orders: {
    all: ['orders'] as const,
    lists: () => ['orders', 'list'] as const,
    list: (status?: string) => ['orders', 'list', status] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },

  profile: {
    all: ['profile'] as const,
    current: () => ['profile', 'current'] as const,
    addresses: () => ['profile', 'addresses'] as const,
  },

  favorites: {
    all: ['favorites'] as const,
    list: () => ['favorites', 'list'] as const,
  },

  reviews: {
    all: ['reviews'] as const,
    byProduct: (productId: string) => ['reviews', 'product', productId] as const,
    byStore: (storeId: string) => ['reviews', 'store', storeId] as const,
    comments: (reviewId: string) => ['reviews', 'comments', reviewId] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },

  business: {
    all: ['business'] as const,
    list: () => ['business', 'list'] as const,
    detail: (businessId: string) => ['business', 'detail', businessId] as const,
    dashboard: (businessId: string) => ['business', 'dashboard', businessId] as const,
    analytics: (businessId: string, timeframe: string) =>
      ['business', 'analytics', businessId, timeframe] as const,
    orders: (storeId: string, status?: string) =>
      ['business', 'orders', storeId, status] as const,
    products: (storeId: string) => ['business', 'products', storeId] as const,
    campaigns: () => ['business', 'campaigns'] as const,
    reviews: (businessId: string) => ['business', 'reviews', businessId] as const,
  },

  stores: {
    all: ['stores'] as const,
    lists: () => ['stores', 'list'] as const,
    list: (filters?: StoreFilters) => ['stores', 'list', filters] as const,
    infinite: (filters?: StoreFilters) => ['stores', 'infinite', filters] as const,
    detail: (id: string) => ['stores', 'detail', id] as const,
    search: (query: string) => ['stores', 'search', query] as const,
  },

  banners: {
    all: ['banners'] as const,
    active: () => ['banners', 'active'] as const,
    promoted: () => ['banners', 'promoted'] as const,
  },

  admin: {
    all: ['admin'] as const,
    dashboard: () => ['admin', 'dashboard'] as const,
    auditLogs: (filters?: object) => ['admin', 'audit-logs', filters] as const,
    orders: (filters?: object) => ['admin', 'orders', filters] as const,
    users: (filters?: object) => ['admin', 'users', filters] as const,
    userStats: () => ['admin', 'user-stats'] as const,
    driverVerifications: () => ['admin', 'driver-verifications'] as const,
  },

  driver: {
    all: ['driver'] as const,
    profile: () => ['driver', 'profile'] as const,
  },

  auth: {
    all: ['auth'] as const,
    me: () => ['auth', 'me'] as const,
  },

  delivery: {
    all: ['delivery'] as const,
    available: () => ['delivery', 'available'] as const,
    active: () => ['delivery', 'active'] as const,
    detail: (deliveryId: string) => ['delivery', 'detail', deliveryId] as const,
    stats: (timeframe: string) => ['delivery', 'stats', timeframe] as const,
  },

  payment: {
    all: ['payment'] as const,
    methods: () => ['payment', 'methods'] as const,
  },

  chat: {
    all: ['chat'] as const,
    conversations: () => ['chat', 'conversations'] as const,
    messages: (conversationId: string) => ['chat', 'messages', conversationId] as const,
    presence: (userId: string) => ['chat', 'presence', userId] as const,
  },

  recommendations: {
    all: ['recommendations'] as const,
    similar: (productId: string) => ['recommendations', 'similar', productId] as const,
    personalized: () => ['recommendations', 'personalized'] as const,
    trending: (category?: string) => ['recommendations', 'trending', category] as const,
  },
};

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
}

export interface StoreFilters {
  search?: string;
  category?: string;
  sortBy?: 'rating' | 'newest' | 'name';
  verified?: string;
}
