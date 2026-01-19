// db/repositories/RoleRepository.js
// Data access layer for roles and user_roles tables

const BaseRepository = require('./BaseRepository');

class RoleRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'roles');
  }

  /**
   * Find role by name (buyer, seller, driver)
   * @param {string} roleName
   * @returns {Promise<Object|null>}
   */
  async findByName(roleName) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('name', roleName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Assign role to user
   * @param {string} userId
   * @param {string} roleId
   * @returns {Promise<Object>}
   */
  async assignRoleToUser(userId, roleId) {
    const { data, error } = await this.db
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get user roles
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getUserRoles(userId) {
    const { data, error } = await this.db
      .from('user_roles')
      .select(`
        id,
        is_active,
        assigned_at,
        role:roles(id, name, display_name, description)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    return data;
  }

  /**
   * Check if user has role
   * @param {string} userId
   * @param {string} roleName
   * @returns {Promise<boolean>}
   */
  async userHasRole(userId, roleName) {
    const { data, error } = await this.db
      .from('user_roles')
      .select('id, role:roles(name)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    
    return data.some(ur => ur.role?.name === roleName);
  }

  /**
   * Remove role from user
   * @param {string} userId
   * @param {string} roleId
   * @returns {Promise<Object>}
   */
  async removeRoleFromUser(userId, roleId) {
    const { data, error } = await this.db
      .from('user_roles')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all roles
   * @returns {Promise<Array>}
   */
  async getAllRoles() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  }
}

module.exports = RoleRepository;
