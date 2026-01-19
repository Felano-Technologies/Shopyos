// db/repositories/UserRepository.js
// Data access layer for users table

const BaseRepository = require('./BaseRepository');
const bcrypt = require('bcrypt');

class UserRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'users');
  }

  /**
   * Find user by email (exclude soft-deleted)
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Create new user with hashed password
   * @param {Object} userData
   * @param {string} userData.email
   * @param {string} userData.password
   * @returns {Promise<Object>}
   */
  async createUser(userData) {
    const { email, password, ...rest } = userData;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const user = await this.create({
      email: email.toLowerCase(),
      password_hash,
      ...rest
    });

    // Create associated profile (trigger handles this in DB)
    // Return user without password_hash
    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Verify user password
   * @param {string} userId
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async verifyPassword(userId, password) {
    const user = await this.findById(userId);
    if (!user) return false;

    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update user password
   * @param {string} userId
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  async updatePassword(userId, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    return this.update(userId, { password_hash });
  }

  /**
   * Set password reset token
   * @param {string} userId - User ID
   * @param {string} token
   * @param {Date} expires
   * @returns {Promise<Object>}
   */
  async setPasswordResetToken(userId, token, expires) {
    return this.update(userId, {
      password_reset_token: token,
      password_reset_expires: expires.toISOString()
    });
  }

  /**
   * Find user by password reset token
   * @param {string} token
   * @returns {Promise<Object|null>}
   */
  async findByPasswordResetToken(token) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('password_reset_token', token)
      .gt('password_reset_expires', new Date().toISOString())
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Clear password reset token
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async clearPasswordResetToken(userId) {
    return this.update(userId, {
      password_reset_token: null,
      password_reset_expires: null
    });
  }

  /**
   * Set email verification token
   * @param {string} userId
   * @param {string} token
   * @param {Date} expires
   * @returns {Promise<Object>}
   */
  async setEmailVerificationToken(userId, token, expires) {
    return this.update(userId, {
      email_verification_token: token,
      email_verification_expires: expires.toISOString()
    });
  }

  /**
   * Verify user email
   * @param {string} token
   * @returns {Promise<Object|null>}
   */
  async verifyEmail(token) {
    const { data, error } = await this.db
      .from(this.tableName)
      .update({
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('email_verification_token', token)
      .gt('email_verification_expires', new Date().toISOString())
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Update last login timestamp
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async updateLastLogin(userId) {
    return this.update(userId, {
      last_login_at: new Date().toISOString()
    });
  }

  /**
   * Get user with profile
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getUserWithProfile(userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        user_profiles (*)
      `)
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = data;
    return userWithoutPassword;
  }

  /**
   * Get user with roles
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getUserWithRoles(userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        user_roles (
          is_active,
          roles (*)
        )
      `)
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const { password_hash, ...userWithoutPassword } = data;
    return userWithoutPassword;
  }

  /**
   * Deactivate user account
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async deactivateUser(userId) {
    return this.update(userId, { is_active: false });
  }

  /**
   * Reactivate user account
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async reactivateUser(userId) {
    return this.update(userId, { is_active: true });
  }

  /**
   * Add role to user
   * @param {string} userId
   * @param {string} roleName - Role name (buyer, seller, driver, admin)
   * @returns {Promise<Object>}
   */
  async addRole(userId, roleName) {
    // Get role ID by name
    const { data: roleData, error: roleError } = await this.db
      .from('roles')
      .select('id')
      .eq('role_name', roleName.toLowerCase())
      .single();

    if (roleError) throw new Error(`Role '${roleName}' not found`);

    // Insert user_role (ignore if already exists)
    const { data, error } = await this.db
      .from('user_roles')
      .upsert({
        user_id: userId,
        role_id: roleData.id,
        is_active: true
      }, {
        onConflict: 'user_id,role_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Remove role from user
   * @param {string} userId
   * @param {string} roleName
   * @returns {Promise<void>}
   */
  async removeRole(userId, roleName) {
    // Get role ID
    const { data: roleData, error: roleError } = await this.db
      .from('roles')
      .select('id')
      .eq('role_name', roleName.toLowerCase())
      .single();

    if (roleError) throw new Error(`Role '${roleName}' not found`);

    // Delete user_role
    const { error } = await this.db
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleData.id);

    if (error) throw error;
  }

  /**
   * Replace all user roles with a single role
   * @param {string} userId
   * @param {string} roleName - Role name or 'none' to remove all roles
   * @returns {Promise<Object|null>}
   */
  async setRole(userId, roleName) {
    // Remove all existing roles
    await this.db
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // If role is 'none', we're done
    if (roleName === 'none') {
      return null;
    }

    // Add the new role
    return this.addRole(userId, roleName);
  }

  /**
   * Check if user has a specific role
   * @param {string} userId
   * @param {string} roleName
   * @returns {Promise<boolean>}
   */
  async hasRole(userId, roleName) {
    const { data, error } = await this.db
      .from('user_roles')
      .select(`
        id,
        roles!inner(role_name)
      `)
      .eq('user_id', userId)
      .eq('roles.role_name', roleName.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw error;
    }

    return !!data;
  }
}

module.exports = UserRepository;
