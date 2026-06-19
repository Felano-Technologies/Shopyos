type Route = {
  pathname: string;
  params?: Record<string, string>;
};

/**
 * Maps an in-app notification (from DB/socket) to a navigation route based on user role.
 * Returns null when no specific destination applies.
 */
export function getRouteFromNotification(notification: any, role: string): Route | null {
  const type = (notification?.type || '').toLowerCase();
  const data = notification?.data || {};
  const relatedId: string = notification?.related_id || '';
  const r = (role || '').toLowerCase();

  if (r === 'seller') {
    if (type === 'new_order' || type.startsWith('order_')) {
      const id = data.orderId || relatedId;
      if (id) return { pathname: '/business/orderDetails', params: { id } };
      return { pathname: '/business/orders' };
    }
    if (type === 'new_message' || type.startsWith('message') || type.includes('chat')) {
      return { pathname: '/business/community/messages' };
    }
    if (type === 'new_review') {
      return { pathname: '/business/community/reviews' };
    }
    if (type.startsWith('payment') || type === 'payout_released') {
      return { pathname: '/business/earnings' };
    }
    if (type.includes('low_stock') || type === 'back_in_stock') {
      return { pathname: '/business/inventory' };
    }
    if (type === 'business_verification' || type === 'driver_verification') {
      return { pathname: '/business/verification-status' };
    }
    if (type.startsWith('return')) {
      return { pathname: '/business/orders' };
    }
    return null;
  }

  if (r === 'driver') {
    if (
      type.startsWith('delivery_') ||
      type === 'new_delivery_available' ||
      type === 'delivery_cancelled'
    ) {
      const deliveryId = data.deliveryId || relatedId;
      if (deliveryId) return { pathname: '/driver/activeOrder', params: { deliveryId } };
      return { pathname: '/driver/dashboard' };
    }
    if (type === 'new_message' || type === 'message_received' || type.includes('chat')) {
      const conversationId = data.conversationId || '';
      if (conversationId) {
        return {
          pathname: '/chat/conversation',
          params: { conversationId, chatType: 'driver', name: data.senderName || '' },
        };
      }
      return { pathname: '/chat' };
    }
    if (type === 'payment_received' || type.startsWith('payment')) {
      return { pathname: '/driver/earnings' };
    }
    if (type === 'driver_verification') {
      return { pathname: '/driver/verification' };
    }
    return null;
  }

  if (r === 'admin') {
    const entityId = relatedId || data.storeId || data.driverId || data.sourceId;
    if (type === 'business_verification' && entityId) {
      return { pathname: `/admin/store-details/${entityId}` as any };
    }
    if (type === 'driver_verification' && entityId) {
      return { pathname: `/admin/driver-verifications/${entityId}` as any };
    }
    return null;
  }

  // Buyer / customer (default)
  if (type.startsWith('order_') || type.startsWith('delivery_')) {
    const id = data.orderId || relatedId;
    if (id) return { pathname: `/order/${id}` as any };
    return null;
  }
  if (type === 'new_message' || type.startsWith('message') || type.includes('chat')) {
    const conversationId = data.conversationId || '';
    if (conversationId) {
      return {
        pathname: '/chat/conversation',
        params: { conversationId, chatType: data.chatType || 'buyer', name: data.senderName || '' },
      };
    }
    return { pathname: '/chat' };
  }
  if (type.startsWith('return') || type.startsWith('refund')) {
    return { pathname: '/returns' };
  }
  if (type === 'price_drop' || type === 'back_in_stock') {
    const productId = data.productId;
    if (productId) return { pathname: '/product/details', params: { id: productId } };
    return null;
  }
  if (type === 'loyalty_earned' || type === 'badge_awarded') {
    return { pathname: '/settings/loyaltyPoints' };
  }
  if (type.startsWith('payment')) {
    return { pathname: '/settings/Transactions' };
  }
  if (type === 'cart_abandonment') {
    return { pathname: '/cart' };
  }
  return null;
}

/**
 * Maps a push notification data payload to a navigation route based on user role.
 * Used in usePushNotifications when the user taps a push notification.
 */
export function getRouteFromPushData(data: Record<string, any>, role: string): Route | null {
  const screen: string = data?.screen || '';
  const r = (role || '').toLowerCase();

  if (r === 'seller') {
    if (screen === 'order' || screen.startsWith('order/')) {
      const id = data.orderId || screen.replace('order/', '');
      if (id && id !== 'order') return { pathname: '/business/orderDetails', params: { id } };
      return { pathname: '/business/orders' };
    }
    if (screen === 'messages') return { pathname: '/business/community/messages' };
    if (screen === 'review') return { pathname: '/business/community/reviews' };
    if (screen === 'earnings' || screen === 'payment') return { pathname: '/business/earnings' };
    if (screen === 'inventory') return { pathname: '/business/inventory' };
    if (screen === 'verification') return { pathname: '/business/verification-status' };
    if (screen === 'returns') return { pathname: '/business/orders' };
    return null;
  }

  if (r === 'driver') {
    if (screen === 'delivery' || screen === 'activeOrder') {
      const deliveryId = data.deliveryId || data.relatedId || '';
      if (deliveryId) return { pathname: '/driver/activeOrder', params: { deliveryId } };
      return { pathname: '/driver/dashboard' };
    }
    if (screen === 'order') {
      const deliveryId = data.deliveryId || '';
      if (deliveryId) return { pathname: '/driver/activeOrder', params: { deliveryId } };
      return { pathname: '/driver/dashboard' };
    }
    if (screen === 'messages') {
      const conversationId = data.conversationId || '';
      if (conversationId) {
        return {
          pathname: '/chat/conversation',
          params: { conversationId, chatType: 'driver', name: data.senderName || '' },
        };
      }
      return { pathname: '/chat' };
    }
    if (screen === 'earnings' || screen === 'payment') return { pathname: '/driver/earnings' };
    if (screen === 'verification') return { pathname: '/driver/verification' };
    return null;
  }

  if (r === 'admin') {
    const relatedId: string = data.relatedId || data.storeId || data.driverId || '';
    if (screen === 'store' && data.storeId) {
      return { pathname: `/admin/store-details/${data.storeId}` as any };
    }
    if (screen === 'verification' && data.relatedType === 'store' && relatedId) {
      return { pathname: `/admin/store-details/${relatedId}` as any };
    }
    if (screen === 'verification' && data.relatedType === 'driver' && relatedId) {
      return { pathname: `/admin/driver-verifications/${relatedId}` as any };
    }
    if (screen === 'driver' && data.driverId) {
      return { pathname: `/admin/driver-verifications/${data.driverId}` as any };
    }
    return null;
  }

  // Buyer / customer (default) — mirrors the original handler
  if (screen === 'messages') {
    if (data.conversationId) {
      return {
        pathname: '/chat/conversation',
        params: {
          conversationId: data.conversationId,
          chatType: data.chatType || 'buyer',
          name: data.senderName || '',
        },
      };
    }
    return { pathname: '/chat' };
  }
  if (screen === 'cart') return { pathname: '/cart' };
  if (screen === 'order' && data.orderId) return { pathname: `/order/${data.orderId}` as any };
  if (screen?.startsWith('order/')) {
    const id = screen.replace('order/', '');
    return { pathname: `/order/${id}` as any };
  }
  if (screen === 'product/details' && data.productId) {
    return { pathname: '/product/details', params: { id: data.productId } };
  }
  if (screen === 'returns' || screen === 'return_request') return { pathname: '/returns' };
  if (screen === 'store' && data.storeId) {
    return { pathname: '/stores/details', params: { id: String(data.storeId) } };
  }
  if (screen === 'loyalty') return { pathname: '/settings/loyaltyPoints' };
  if (screen === 'payment') return { pathname: '/settings/Transactions' };
  return null;
}
