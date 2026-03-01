export const queryKeys = {
  products: {
    all: ['products'] as const,
    lists: () => ['products', 'list'] as const,
    list: (filters?: ProductFilters) => ['products', 'list', filters] as const,
    infinite: (filters?: ProductFilters) => ['products', 'infinite', filters] as const,
    details: () => ['products', 'detail'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
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
};

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
}
