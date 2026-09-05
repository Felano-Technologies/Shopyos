// Barrel re-export — all existing imports from '@/services/api' continue to work unchanged.

export { api, baseURL, API_URL, extractErrorMessage, storage, secureStorage, CustomInAppToast } from './client';

export {
  registerUser, registerPushTokenInBackend,
  requestPasswordResetOTP, verifyPasswordResetOTP, resetPasswordWithToken, forceResetPassword,
  logoutUser, loginUser, getUserData, updateProfile, updateUserRole, updateOnboardingState,
  uploadAvatar, updateUserLocation, blockUser, unblockUser, getBlockedUsers, reportEntity,
  verifyTwoFactorLogin, getSecuritySettings, updateSecuritySettings,
  getThemePreference, updateThemePreference,
  getActiveSessions, revokeSession, logoutAllSessions, requestDataExport, requestAccountDeletion,
} from './auth';
export type { ThemePreference } from './auth';

export {
  uploadStoreLogo, businessRegister, getMyBusinesses, updateBusiness,
  verifyBusinessDetails, getBusinessById, getAllStores, searchStores,
  getBusinessDashboard, getBusinessAnalytics, getBusinessReviews, replyToReview,
  followStore, unfollowStore, getDeliverySettings, updateDeliverySettings,
} from './business';

export {
  getStoreProducts, searchProducts, getProductFilterOptions, getAllCategories, createCategory, updateCategory,
  deleteCategory, getProductById, createProduct, deleteProduct, updateProduct,
  uploadProductImages, deleteProductImage, setPrimaryProductImage, getPromotedProducts,
} from './products';

export {
  addToCart, clearBackendCart, createOrder, confirmDelivery, getMyOrders, deleteOrders, getStoreOrders,
  getOrderDetails, updateOrderStatus, cancelOrder,
  addToFavorites, removeFromFavorites, getFavorites, checkIsFavorite,
} from './orders';

export {
  getDeliveryQuote, getPublicFeeConfigs, createDelivery, getAvailableDeliveries, assignDriver, getMyDeliveries,
  getDeliveryDetails, updateDeliveryStatus, verifyDeliveryPin, verifyHubDropoff, getActiveDeliveries,
  getDriverStats, getDriverEarningsAnalytics, updateDriverLocation, getDriverProfile, updateDriverAvailability,
  submitDriverVerification,
} from './delivery';

export {
  getConversations, getMessages, sendMessage, markConversationRead, startConversation,
  deleteMessage, deleteConversation, uploadChatMedia, getStickerPacks, createCustomSticker,
  getPresence, getChatContacts, getConversationDetails,
} from './messaging';

export {
  getNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount,
  getNotificationPreferences, updateNotificationPreferences, markNotificationsReadByConversation,
} from './notifications';

export {
  getStoreReviews, getProductReviews, createProductReview, createStoreReview,
  createDriverReview, getReviewableProducts, likeReview, getReviewComments, createReviewComment,
  getMyReviews, updateProductReview, deleteReview,
} from './reviews';

export {
  initializePayment, verifyPayment, getPaymentMethods, addPaymentMethod, deletePaymentMethod,
  setDefaultPaymentMethod, getPayoutHistory, requestPayout, getSellerTransactions, initializeListingFee,
  initializeBannerPayment, verifyBannerPayment,
} from './payments';

export {
  getAdminDashboard, getAdminUsers, getAdminUserStats, getAdminStores, adminVerifyStore,
  getAdminAuditLogs, getAdminOrders, getAdminRevenue, getAdminRevenueBreakdown, adminUpdateUserStatus,
  getAdminPayouts, updateAdminPayoutStatus, getPendingDriverVerifications,
  getDriverVerificationDetails, approveDriverVerification, rejectDriverVerification,
  getAdminListingFees,
} from './admin';

export {
  createCampaign, getMyCampaigns, updateCampaignStatus, recordAdClick,
  createBannerCampaign, getMyBannerCampaigns, getAllBannerCampaigns, updateBannerCampaignStatus,
  getActiveBanners, uploadSnapImage, createSnap, getSnapFeed, viewSnap, deleteSnap,
  getMySnaps, repostSnap,
} from './advertising';

export { getLoyaltyBalance, getLoyaltyTransactions, validatePromoCode, dailyCheckin } from './loyalty';

export {
  createPromoCode, getMyPromoCodes, deactivatePromoCode, adminCreatePromoCode, getAdminPromoCodes,
} from './promoCodes';
export type { PromoCodePayload } from './promoCodes';

export { getDisclaimerByType, acknowledgeDisclaimer } from './disclaimers';

export {
  createBargainOffer, getBuyerOffers, getSellerOffers, respondToBargain,
  buyerRespondToBargain, withdrawBargainOffer, getBargainHistory, addBargainToCart
} from './bargain';

export {
  getBuyerAnalytics,
} from './analytics';

export {
  getHubs, getDashboardStats, getHubParcels, checkInParcel,
  dispatchParcel, arriveParcel, requestLastMile, getTransitInfo
} from './parcelPartner';

export {
  getActiveFlashSale, getSlotsList, submitFlashSale, getSellerSales,
  cancelFlashSale, createSlot, updateSlot, deleteSlot, getAdminSales, reviewFlashSale
} from './flashSales';


