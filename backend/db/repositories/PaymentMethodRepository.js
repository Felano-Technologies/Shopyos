// db/repositories/PaymentMethodRepository.js
const BaseRepository = require('./BaseRepository');

class PaymentMethodRepository extends BaseRepository {
    constructor(supabaseClient) {
        super(supabaseClient, 'user_payment_methods');
    }

    async findByUserId(userId) {
        const { data, error } = await this.db
            .from(this.tableName)
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async setDefault(userId, methodId) {
        // Trigger in DB handles unsetting others
        const { data, error } = await this.db
            .from(this.tableName)
            .update({ is_default: true, updated_at: new Date().toISOString() })
            .eq('id', methodId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = PaymentMethodRepository;
