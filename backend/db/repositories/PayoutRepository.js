// db/repositories/PayoutRepository.js
const BaseRepository = require('./BaseRepository');

class PayoutRepository extends BaseRepository {
    constructor(supabase) {
        super(supabase, 'payouts');
    }

    async requestPayout(payoutData) {
        const { data, error } = await this.db
            .from(this.tableName)
            .insert({
                store_id: payoutData.storeId || null,
                driver_id: payoutData.driverId || null,
                payout_type: payoutData.driverId ? 'driver' : 'seller',
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

    async getStorePayouts(storeId, options = {}) {
        const { status, search, from, to, limit = 20, offset = 0 } = options;

        let query = this.db
            .from(this.tableName)
            .select('*')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) query = query.eq('status', status);
        if (from) query = query.gte('created_at', from);
        if (to) query = query.lte('created_at', to);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async getDriverPayouts(driverId, options = {}) {
        const { status, from, to, limit = 20, offset = 0 } = options;

        let query = this.db
            .from(this.tableName)
            .select('*')
            .eq('driver_id', driverId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) query = query.eq('status', status);
        if (from) query = query.gte('created_at', from);
        if (to) query = query.lte('created_at', to);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async updatePayoutStatus(payoutId, status, updateData = {}) {
        const { data, error } = await this.db
            .from(this.tableName)
            .update({
                status,
                transaction_reference: updateData.transactionReference,
                admin_notes: updateData.notes,
                updated_at: new Date().toISOString(),
                processed_at: status === 'completed' ? new Date().toISOString() : undefined
            })
            .eq('id', payoutId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async findByTransactionReference(ref) {
        const { data, error } = await this.db
            .from(this.tableName)
            .select('*')
            .eq('transaction_reference', ref)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    }

    // Admin: list all payouts with store/driver names, filterable
    async getAdminPayouts(options = {}) {
        const { type, status, search, from, to, limit = 30, offset = 0 } = options;
        const db = require('../config/postgres').getPool();

        const conditions = [];
        const params = [];
        let idx = 1;

        if (type === 'seller') { conditions.push(`p.store_id IS NOT NULL`); }
        if (type === 'driver') { conditions.push(`p.driver_id IS NOT NULL`); }
        if (status) { conditions.push(`p.status = $${idx++}`); params.push(status); }
        if (from) { conditions.push(`p.created_at >= $${idx++}`); params.push(from); }
        if (to) { conditions.push(`p.created_at <= $${idx++}`); params.push(to); }
        if (search) {
            conditions.push(`(s.store_name ILIKE $${idx} OR up.full_name ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const countSql = `
            SELECT COUNT(*) FROM payouts p
            LEFT JOIN stores s ON s.id = p.store_id
            LEFT JOIN user_profiles up ON up.user_id = p.driver_id
            ${where}
        `;
        const dataSql = `
            SELECT
                p.*,
                s.store_name,
                up.full_name AS driver_name,
                CASE WHEN p.driver_id IS NOT NULL THEN 'driver' ELSE 'seller' END AS payout_type
            FROM payouts p
            LEFT JOIN stores s ON s.id = p.store_id
            LEFT JOIN user_profiles up ON up.user_id = p.driver_id
            ${where}
            ORDER BY p.created_at DESC
            LIMIT $${idx} OFFSET $${idx + 1}
        `;

        const [countRes, dataRes] = await Promise.all([
            db.query(countSql, params),
            db.query(dataSql, [...params, limit, offset])
        ]);

        return { data: dataRes.rows, count: parseInt(countRes.rows[0].count, 10) };
    }

    async getAdminPayoutSummary() {
        const db = require('../config/postgres').getPool();
        const sql = `
            SELECT
                status,
                payout_type,
                COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0) AS total
            FROM payouts
            GROUP BY status, payout_type
        `;
        const { rows } = await db.query(sql);
        return rows;
    }

    // For scheduler: find pending payouts already created to avoid duplicates
    async hasPendingPayout(storeId, driverId) {
        let query = this.db.from(this.tableName).select('id').eq('status', 'pending');
        if (storeId) query = query.eq('store_id', storeId);
        if (driverId) query = query.eq('driver_id', driverId);
        const { data, error } = await query.limit(1);
        if (error) throw error;
        return data && data.length > 0;
    }
}

module.exports = PayoutRepository;
