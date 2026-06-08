// Barrel re-export — all existing imports from '@/services/api' continue to work unchanged.

export { api, baseURL, API_URL, extractErrorMessage, storage, secureStorage, CustomInAppToast } from './client';

export {
  registerUser, registerPushTokenInBackend, requestPasswordReset, confirmResetPassword,
  logoutUser, loginUser, getUserData, updateProfile, updateUserRole, updateOnboardingState,
  uploadAvatar, updateUserLocation, blockUser, unblockUser, getBlockedUsers, reportEntity,
} from './auth';

export {
  uploadStoreLogo, businessRegister, getMyBusinesses, switchBusiness, updateBusiness,
  verifyBusinessDetails, loginBusiness, getBusinessById, getAllStores, searchStores,
  getBusinessDashboard, getBusinessAnalytics, getBusinessReviews, replyToReview,
  followStore, unfollowStore, getDeliverySettings, updateDeliverySettings,
} from './business';

export {
  getStoreProducts, searchProducts, getAllCategories, createCategory, updateCategory,
  deleteCategory, getProductById, createProduct, deleteProduct, updateProduct,
  uploadProductImages, getPromotedProducts,
} from './products';

export {
  addToCart, clearBackendCart, createOrder, confirmDelivery, getMyOrders, getStoreOrders,
  getOrderDetails, updateOrderStatus, cancelOrder,
  addToFavorites, removeFromFavorites, getFavorites, checkIsFavorite,
} from './orders';

export {
  getDeliveryQuote, createDelivery, getAvailableDeliveries, assignDriver, getMyDeliveries,
  getDeliveryDetails, updateDeliveryStatus, verifyDeliveryPin, getActiveDeliveries,
  getDriverStats, updateDriverLocation, getDriverProfile, updateDriverAvailability,
  submitDriverVerification,
} from './delivery';

export {
  getConversations, getMessages, sendMessage, markConversationRead, startConversation,
  deleteMessage, deleteConversation, uploadChatMedia, getStickerPacks, createCustomSticker,
  getPresence,
} from './messaging';

export {
  getNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount,
  getNotificationPreferences, updateNotificationPreferences, markNotificationsReadByConversation,
} from './notifications';

export {
  getStoreReviews, getProductReviews, createProductReview, createStoreReview,
  createDriverReview, getReviewableProducts, likeReview, getReviewComments, createReviewComment,
} from './reviews';

export {
  initializePayment, verifyPayment, getPaymentMethods, addPaymentMethod, deletePaymentMethod,
  setDefaultPaymentMethod, getPayoutHistory, requestPayout, initializeListingFee,
  initializeBannerPayment, verifyBannerPayment,
} from './payments';

export {
  getAdminDashboard, getAdminUsers, getAdminUserStats, getAdminStores, adminVerifyStore,
  getAdminAuditLogs, getAdminOrders, getAdminRevenue, adminUpdateUserStatus,
  getAdminPayouts, updateAdminPayoutStatus, getPendingDriverVerifications,
  getDriverVerificationDetails, approveDriverVerification, rejectDriverVerification,
} from './admin';

export {
  createCampaign, getMyCampaigns, updateCampaignStatus, recordAdClick,
  createBannerCampaign, getMyBannerCampaigns, getAllBannerCampaigns, updateBannerCampaignStatus,
  getActiveBanners, uploadSnapImage, createSnap, getSnapFeed, viewSnap, deleteSnap,
} from './advertising';

export { getLoyaltyBalance, getLoyaltyTransactions, validatePromoCode } from './loyalty';
