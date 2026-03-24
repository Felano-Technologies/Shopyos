// db/repositories/DriverRepository.js
// Data access layer for driver_profiles table

const BaseRepository = require('./BaseRepository');

class DriverRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'driver_profiles');
  }

  /**
   * Find driver profile by user ID
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async findByUserId(userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Create or update driver profile
   * @param {string} userId
   * @param {Object} profileData
   * @returns {Promise<Object>}
   */
  async upsertProfile(userId, profileData) {
    const existing = await this.findByUserId(userId);

    const dataToSave = {
      user_id: userId,
      vehicle_type: profileData.vehicleType || profileData.vehicle_type,
      license_plate: profileData.plateNumber || profileData.license_plate,
      drivers_license_number: profileData.licenseNumber || profileData.drivers_license_number,
      license_image_url: profileData.license_image_url || null,
      national_id_url: profileData.national_id_url || null,
      insurance_doc_url: profileData.insurance_doc_url || null,
      vehicle_reg_url: profileData.vehicle_reg_url || null,
      roadworthy_url: profileData.roadworthy_url || null,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      return this.update(existing.id, dataToSave);
    } else {
      const { data, error } = await this.db
        .from(this.tableName)
        .insert({
          ...dataToSave,
          license_expiry_date: profileData.licenseExpiryDate || new Date(Date.now() + 31536000000).toISOString().split('T')[0], // Default 1 year
          is_verified: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }
}

module.exports = DriverRepository;
