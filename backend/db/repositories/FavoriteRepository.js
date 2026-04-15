// db/repositories/FavoriteRepository.js
const BaseRepository = require('./BaseRepository');

class FavoriteRepository extends BaseRepository {
    constructor(supabaseClient) {
        super(supabaseClient, 'favorites');
    }

    /**
     * Get user's favorites with product details
     * @param {string} userId - User ID
     * @returns {Promise<Array>}
     */
    async getUserFavoritesWithProducts(userId) {
        const { data, error } = await this.db
            .from(this.tableName)
            .select(`
        id,
        user_id,
        product_id,
        created_at,
        product:product_id!inner (
          id,
          title,
          price,
          description,
          category,
          store_id,
          is_active,
          deleted_at,
          product_images (
            image_url,
            is_primary
          ),
          store:store_id!inner (
            id,
            store_name,
            logo_url,
            is_active,
            is_verified
          )
        )
      `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        const favorites = data || [];
        return favorites.filter((fav) => {
            const product = fav?.product;
            const store = product?.store;
            return Boolean(
                product &&
                product.is_active === true &&
                product.deleted_at == null &&
                store &&
                store.is_active === true &&
                store.is_verified === true
            );
        });
    }

    /**
     * Check if product is favorited by user
     * @param {string} userId - User ID
     * @param {string} productId - Product ID
     * @returns {Promise<boolean>}
     */
    async isFavorited(userId, productId) {
        const favorite = await this.findOne({ user_id: userId, product_id: productId });
        return !!favorite;
    }

    /**
     * Remove favorite by user and product
     * @param {string} userId - User ID
     * @param {string} productId - Product ID
     * @returns {Promise<void>}
     */
    async removeByUserAndProduct(userId, productId) {
        const { error } = await this.db
            .from(this.tableName)
            .delete()
            .eq('user_id', userId)
            .eq('product_id', productId);

        if (error) throw error;
    }

    /**
     * Get favorite count for a product
     * @param {string} productId - Product ID
     * @returns {Promise<number>}
     */
    async getProductFavoriteCount(productId) {
        const { count, error } = await this.db
            .from(this.tableName)
            .select('*', { count: 'exact', head: true })
            .eq('product_id', productId);

        if (error) throw error;
        return count || 0;
    }
}

module.exports = FavoriteRepository;
