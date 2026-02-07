// db/repositories/BaseRepository.js
// Base repository class with common CRUD operations

class BaseRepository {
  constructor(supabaseClient, tableName) {
    this.db = supabaseClient;
    this.supabase = supabaseClient; // Alias for compatibility with older implementations
    this.tableName = tableName;
  }

  /**
   * Find record by ID
   * @param {string} id - UUID of record
   * @param {string} select - Columns to select (default: *)
   * @returns {Promise<Object|null>}
   */
  async findById(id, select = '*') {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(select)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Find one record by criteria
   * @param {Object} criteria - Where conditions
   * @param {string} select - Columns to select
   * @returns {Promise<Object|null>}
   */
  async findOne(criteria, select = '*') {
    let query = this.db.from(this.tableName).select(select);

    // Apply criteria
    Object.entries(criteria).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Find all records matching criteria
   * @param {Object} options - Query options
   * @param {Object} options.where - Where conditions
   * @param {string} options.select - Columns to select
   * @param {string} options.orderBy - Column to order by
   * @param {boolean} options.ascending - Sort order
   * @param {number} options.limit - Max records
   * @param {number} options.offset - Records to skip
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    const {
      where = {},
      select = '*',
      orderBy = 'created_at',
      ascending = false,
      limit,
      offset
    } = options;

    let query = this.db.from(this.tableName).select(select);

    // Apply where conditions
    Object.entries(where).forEach(([key, value]) => {
      if (value === null) {
        query = query.is(key, null);
      } else if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    });

    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    // Apply pagination
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 10) - 1);

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  }

  /**
   * Create new record
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record
   */
  async create(data) {
    const { data: created, error } = await this.db
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    return created;
  }

  /**
   * Update record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated record
   */
  async update(id, data) {
    const { data: updated, error } = await this.db
      .from(this.tableName)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return updated;
  }

  /**
   * Delete record by ID (hard delete)
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const { error } = await this.db
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return true;
  }

  /**
   * Soft delete record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Object>} Updated record
   */
  async softDelete(id) {
    return this.update(id, { deleted_at: new Date().toISOString() });
  }

  /**
   * Count records matching criteria
   * @param {Object} where - Where conditions
   * @returns {Promise<number>}
   */
  async count(where = {}) {
    let query = this.db
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    Object.entries(where).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  }

  /**
   * Check if record exists
   * @param {Object} criteria - Where conditions
   * @returns {Promise<boolean>}
   */
  async exists(criteria) {
    const count = await this.count(criteria);
    return count > 0;
  }

  /**
   * Batch insert records
   * @param {Array<Object>} records - Array of records
   * @returns {Promise<Array>} Created records
   */
  async bulkCreate(records) {
    const { data, error } = await this.db
      .from(this.tableName)
      .insert(records)
      .select();

    if (error) throw error;

    return data;
  }

  /**
   * Execute custom query
   * @param {Function} queryBuilder - Function that builds query
   * @returns {Promise<any>}
   */
  async customQuery(queryBuilder) {
    const query = queryBuilder(this.db.from(this.tableName));
    const { data, error } = await query;

    if (error) throw error;

    return data;
  }
}

module.exports = BaseRepository;
