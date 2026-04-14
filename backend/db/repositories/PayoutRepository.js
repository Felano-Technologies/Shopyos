// db/repositories/PayoutRepository.js
const BaseRepository = require('./BaseRepository');

class PayoutRepository extends BaseRepository {
    constructor(supabase) {
        super(supabase, 'payouts');
    }

    /**
     * Request a payout
     * @param {Object} payoutData - { storeId, amount, method, details }
     * @returns {Promise<Object>} Created payout record
     */
    async requestPayout(payoutData) {
        const { data, error } = await this.db
            .from(this.tableName)
            .insert({
                store_id: payoutData.storeId,
                amount: payoutData.amount,
                payout_method: payoutData.method,
                payout_details: payoutData.details,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get store payout history
     * @param {string} storeId
     * @param {Object} options - { status, limit, offset }
     * @returns {Promise<Array>} Payout records
     */
    async getStorePayouts(storeId, options = {}) {
        const { status, limit = 20, offset = 0 } = options;

        let query = this.db
            .from(this.tableName)
            .select('*')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Update payout status (Admin only usually)
     * @param {string} payoutId
     * @param {string} status - pending, processing, completed, failed
     * @param {Object} updateData - { transactionReference, notes }
     * @returns {Promise<Object>} Updated record
     */
    async updatePayoutStatus(payoutId, status, updateData = {}) {
        const { data, error } = await this.db
            .from(this.tableName)
            .update({
                status,
                transaction_reference: updateData.transactionReference,
                admin_notes: updateData.notes,
                updated_at: new Date().toISOString(),
                processed_at: status === 'completed' ? new Date().toISOString() : null
            })
            .eq('id', payoutId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = PayoutRepository;
