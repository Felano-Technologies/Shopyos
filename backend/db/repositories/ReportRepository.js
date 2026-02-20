// db/repositories/ReportRepository.js
// Repository for managing user reports (content moderation)

const BaseRepository = require('./BaseRepository');

class ReportRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'reports');
  }

  /**
   * Create a report
   * @param {Object} reportData - { reporterId, reportedId, reportedType, reason, description }
   * @returns {Promise<Object>} Created report
   */
  async createReport(reportData) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert({
        reporter_id: reportData.reporterId,
        reported_id: reportData.reportedId,
        reported_type: reportData.reportedType,
        reason: reportData.reason,
        description: reportData.description,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all reports with filters
   * @param {Object} options - { status, reportedType, limit, offset }
   * @returns {Promise<Array>} List of reports
   */
  async getAllReports(options = {}) {
    const { status, reportedType, limit = 50, offset = 0 } = options;

    let query = this.supabase
      .from(this.tableName)
      .select(`
        *,
        reporter:user_profiles!reports_reporter_id_fkey(id, full_name, email),
        reviewed_by_user:user_profiles!reports_reviewed_by_fkey(id, full_name)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (reportedType) {
      query = query.eq('reported_type', reportedType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Get report details with reported entity info
   * @param {string} reportId - Report ID
   * @returns {Promise<Object>} Report details
   */
  async getReportDetails(reportId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        reporter:user_profiles!reports_reporter_id_fkey(id, full_name, email),
        reviewed_by_user:user_profiles!reports_reviewed_by_fkey(id, full_name)
      `)
      .eq('id', reportId)
      .single();

    if (error) throw error;

    // Fetch reported entity based on type
    let reportedEntity = null;
    if (data.reported_type === 'product') {
      const { data: product } = await this.supabase
        .from('products')
        .select('id, title, description, product_images(image_url), is_active')
        .eq('id', data.reported_id)
        .single();
      reportedEntity = product;
    } else if (data.reported_type === 'store') {
      const { data: store } = await this.supabase
        .from('stores')
        .select('id, store_name, is_active')
        .eq('id', data.reported_id)
        .single();
      reportedEntity = store;
    } else if (data.reported_type === 'review') {
      const { data: review } = await this.supabase
        .from('product_reviews')
        .select('id, rating, review_text, created_at')
        .eq('id', data.reported_id)
        .single();
      reportedEntity = review;
    } else if (data.reported_type === 'user') {
      const { data: user } = await this.supabase
        .from('user_profiles')
        .select('id, full_name, email, account_status')
        .eq('id', data.reported_id)
        .single();
      reportedEntity = user;
    }

    return {
      ...data,
      reported_entity: reportedEntity
    };
  }

  /**
   * Update report status
   * @param {string} reportId - Report ID
   * @param {string} status - New status (pending, under_review, resolved, dismissed)
   * @param {string} reviewedBy - Admin user ID
   * @param {string} resolution - Resolution notes
   * @returns {Promise<Object>} Updated report
   */
  async updateReportStatus(reportId, status, reviewedBy, resolution = null) {
    const updateData = {
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString()
    };

    if (resolution) {
      updateData.resolution = resolution;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get reports for a specific entity
   * @param {string} reportedId - Reported entity ID
   * @param {string} reportedType - Entity type
   * @returns {Promise<Array>} Reports for entity
   */
  async getReportsByEntity(reportedId, reportedType) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        reporter:user_profiles!reports_reporter_id_fkey(id, full_name)
      `)
      .eq('reported_id', reportedId)
      .eq('reported_type', reportedType)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Get report statistics
   * @returns {Promise<Object>} Report stats
   */
  async getReportStats() {
    const { data: allReports } = await this.supabase
      .from(this.tableName)
      .select('status, reported_type');

    const stats = {
      total: allReports?.length || 0,
      pending: allReports?.filter(r => r.status === 'pending').length || 0,
      underReview: allReports?.filter(r => r.status === 'under_review').length || 0,
      resolved: allReports?.filter(r => r.status === 'resolved').length || 0,
      dismissed: allReports?.filter(r => r.status === 'dismissed').length || 0,
      byType: {
        product: allReports?.filter(r => r.reported_type === 'product').length || 0,
        store: allReports?.filter(r => r.reported_type === 'store').length || 0,
        review: allReports?.filter(r => r.reported_type === 'review').length || 0,
        user: allReports?.filter(r => r.reported_type === 'user').length || 0
      }
    };

    return stats;
  }

  /**
   * Check if user has already reported an entity
   * @param {string} reporterId - Reporter user ID
   * @param {string} reportedId - Reported entity ID
   * @param {string} reportedType - Entity type
   * @returns {Promise<boolean>} Whether report exists
   */
  async hasUserReported(reporterId, reportedId, reportedType) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('reported_id', reportedId)
      .eq('reported_type', reportedType)
      .single();

    return data !== null;
  }
}

module.exports = ReportRepository;
