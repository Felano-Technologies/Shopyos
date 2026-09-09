// db/repositories/VerificationRepository.js
// Data access for the unified KYC/verification system: applications, steps,
// documents, liveness attempts, consent, and admin communications. See
// migrations/055_verification_system.sql for the schema this backs.

const BaseRepository = require('./BaseRepository');

class VerificationRepository extends BaseRepository {
  constructor(client) {
    super(client, 'verification_applications');
  }

  // ── Applications ───────────────────────────────────────────────────────
  async findOpenApplication(userId, role) {
    const { data, error } = await this.db
      .from('verification_applications')
      .select('*')
      .eq('user_id', userId)
      .eq('role', role)
      .not('status', 'in', '(rejected,suspended)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async createApplication({ userId, role, requirementsVersion }) {
    return this.create({
      user_id: userId,
      role,
      requirements_version: requirementsVersion,
      status: 'draft',
    });
  }

  // Looks up an application by the operational entity it verifies (store.id
  // for sellers, driver_profiles.id for drivers) rather than by user — used
  // by businessController.js so the legacy stores-shaped API response can
  // derive its verificationStatus from the new table without needing the
  // requesting user's own session (getBusinessById is publicly viewable).
  async getApplicationByEntityId(entityId, role) {
    const { data, error } = await this.db
      .from('verification_applications')
      .select('*')
      .eq('entity_id', entityId)
      .eq('role', role)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async updateApplication(id, fields) {
    return this.update(id, fields);
  }

  async getApplicationWithSteps(id) {
    const application = await this.findById(id);
    if (!application) return null;
    const { data: steps, error } = await this.db
      .from('verification_steps')
      .select('*')
      .eq('application_id', id);
    if (error) throw error;
    return { ...application, steps: steps || [] };
  }

  async listApplicationsAdmin({ role, status, riskLevel, limit = 25, offset = 0 } = {}) {
    let query = this.db
      .from('verification_applications')
      .select('*, applicant:user_id (id, email)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (riskLevel) query = query.eq('risk_level', riskLevel);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { applications: data || [], total: count || 0 };
  }

  // ── Steps ──────────────────────────────────────────────────────────────
  async upsertStep(applicationId, stepKey, fields) {
    const { data: existing, error: findError } = await this.db
      .from('verification_steps')
      .select('*')
      .eq('application_id', applicationId)
      .eq('step_key', stepKey)
      .maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const { data, error } = await this.db
        .from('verification_steps')
        .update(fields)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await this.db
      .from('verification_steps')
      .insert({ application_id: applicationId, step_key: stepKey, ...fields })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getStep(applicationId, stepKey) {
    const { data, error } = await this.db
      .from('verification_steps')
      .select('*')
      .eq('application_id', applicationId)
      .eq('step_key', stepKey)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async getStepsForApplication(applicationId) {
    const { data, error } = await this.db
      .from('verification_steps')
      .select('*')
      .eq('application_id', applicationId);
    if (error) throw error;
    return data || [];
  }

  // ── Documents ──────────────────────────────────────────────────────────
  async createDocument({ parentType, parentId, stepKey, documentType, storageKey, expiresAt }) {
    const { data, error } = await this.db
      .from('verification_documents')
      .insert({
        parent_type: parentType,
        parent_id: parentId,
        step_key: stepKey,
        document_type: documentType,
        storage_key: storageKey,
        expires_at: expiresAt || null,
        status: 'submitted',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // A reupload keeps the old row (history) and links the new one to it.
  async replaceDocument(previousDocumentId, newDocumentData) {
    const created = await this.createDocument(newDocumentData);
    const { error } = await this.db
      .from('verification_documents')
      .update({ previous_document_id: previousDocumentId })
      .eq('id', created.id);
    if (error) throw error;
    return created;
  }

  async getDocument(id) {
    const { data, error } = await this.db
      .from('verification_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async getDocumentsForParent(parentType, parentId) {
    const { data, error } = await this.db
      .from('verification_documents')
      .select('*')
      .eq('parent_type', parentType)
      .eq('parent_id', parentId)
      .is('deleted_at', null);
    if (error) throw error;
    return data || [];
  }

  async reviewDocument(id, { status, rejectionReason, verificationMethod, reviewedBy }) {
    const { data, error } = await this.db
      .from('verification_documents')
      .update({
        status,
        rejection_reason: rejectionReason || null,
        verification_method: verificationMethod || 'admin',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getExpiringDocuments(beforeDate) {
    const { data, error } = await this.db
      .from('verification_documents')
      .select('*')
      .lte('expires_at', beforeDate)
      .eq('status', 'verified')
      .is('deleted_at', null);
    if (error) throw error;
    return data || [];
  }

  // ── Liveness ───────────────────────────────────────────────────────────
  async createLivenessAttempt(applicationId, attemptData) {
    const attemptNumber = (await this._livenessAttemptCount(applicationId)) + 1;
    const { data, error } = await this.db
      .from('liveness_verifications')
      .insert({
        application_id: applicationId,
        attempt_number: attemptNumber,
        passed: attemptData.passed,
        challenge_sequence: attemptData.challengeSequence,
        anti_spoof_score: attemptData.antiSpoofScore,
        captured_frame_key: attemptData.capturedFrameKey,
        method_version: attemptData.methodVersion,
        device_info: attemptData.deviceInfo,
        app_version: attemptData.appVersion,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async _livenessAttemptCount(applicationId) {
    const { count, error } = await this.db
      .from('liveness_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', applicationId);
    if (error) throw error;
    return count || 0;
  }

  async getLivenessAttempts(applicationId) {
    const { data, error } = await this.db
      .from('liveness_verifications')
      .select('*')
      .eq('application_id', applicationId)
      .order('attempt_number', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // ── Consent ────────────────────────────────────────────────────────────
  async hasConsent(applicationId, consentVersion) {
    const { data, error } = await this.db
      .from('verification_consents')
      .select('id')
      .eq('application_id', applicationId)
      .eq('consent_version', consentVersion)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  async recordConsent(applicationId, consentVersion) {
    const { data, error } = await this.db
      .from('verification_consents')
      .insert({ application_id: applicationId, consent_version: consentVersion })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ── Communications ─────────────────────────────────────────────────────
  async logCommunication({ applicationId, adminId, channel, direction, message, deliveryStatus }) {
    const { data, error } = await this.db
      .from('verification_communications')
      .insert({
        application_id: applicationId,
        admin_id: adminId || null,
        channel,
        direction,
        message,
        delivery_status: deliveryStatus || (direction === 'internal_note' || channel === 'in_app' ? 'sent' : 'pending'),
        sent_at: deliveryStatus === 'sent' ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getCommunications(applicationId) {
    const { data, error } = await this.db
      .from('verification_communications')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // ── Post-approval shop location changes ───────────────────────────────
  // An approved seller's verified location stays active/operational while a
  // requested change is reviewed — this table is intentionally separate from
  // verification_applications so it never touches the seller's approved
  // status while pending.
  async createShopLocationChange(storeId, { addressLine1, city, region, latitude, longitude }) {
    const { data, error } = await this.db
      .from('shop_location_changes')
      .insert({
        store_id: storeId,
        new_address_line1: addressLine1 || null,
        new_city: city || null,
        new_region: region || null,
        new_latitude: latitude ?? null,
        new_longitude: longitude ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getShopLocationChanges(storeId) {
    const { data, error } = await this.db
      .from('shop_location_changes')
      .select('*')
      .eq('store_id', storeId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async reviewShopLocationChange(id, { status, rejectionReason, reviewedBy }) {
    const { data, error } = await this.db
      .from('shop_location_changes')
      .update({
        status,
        rejection_reason: rejectionReason || null,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ── Post-approval vehicle changes ─────────────────────────────────────
  // Mirrors the shop_location_changes methods above — an approved driver's
  // current verified vehicle stays active/operational while a new one is
  // reviewed (see plan §Vehicle lifecycle).
  async createDriverVehicle(driverProfileId, { vehicleType, make, model, year, colour, plateNumber, relationship }) {
    const { data, error } = await this.db
      .from('driver_vehicles')
      .insert({
        driver_profile_id: driverProfileId,
        vehicle_type: vehicleType || null,
        make: make || null,
        model: model || null,
        year: year || null,
        colour: colour || null,
        plate_number: plateNumber || null,
        relationship,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getDriverVehicles(driverProfileId) {
    const { data, error } = await this.db
      .from('driver_vehicles')
      .select('*')
      .eq('driver_profile_id', driverProfileId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async reviewDriverVehicle(id, { status, rejectionReason, reviewedBy }) {
    const { data, error } = await this.db
      .from('driver_vehicles')
      .update({
        status,
        rejection_reason: rejectionReason || null,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // A newly-verified vehicle becomes the one in active use; every other
    // vehicle for this driver stops being active.
    if (status === 'verified') {
      await this.db.from('driver_vehicles').update({ is_active: false }).eq('driver_profile_id', data.driver_profile_id).neq('id', id);
      await this.db.from('driver_vehicles').update({ is_active: true }).eq('id', id);
    }
    return data;
  }

  async getLatestOutboundMessage(applicationId) {
    const { data, error } = await this.db
      .from('verification_communications')
      .select('*')
      .eq('application_id', applicationId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
}

module.exports = VerificationRepository;
