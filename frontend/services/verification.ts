// services/verification.ts
// Thin wrappers over the Phase 1 verification API (backend/routes/verificationRoutes.js)
// for the seller (and later driver) onboarding wizard.

import { File, UploadType } from 'expo-file-system';
import { api, API_URL, secureStorage } from './client';
import { uploadMultipartViaNativeFile } from './uploadUtils';

export type VerificationRole = 'seller' | 'driver';

export type VerificationStep = {
  id: string;
  application_id: string;
  step_key: string;
  status: 'not_started' | 'in_progress' | 'complete' | 'verified' | 'action_required' | 'rejected';
  match_status: string | null;
  data: Record<string, any>;
  completed_at: string | null;
};

export type VerificationDocumentMeta = {
  id: string;
  step_key: string;
  document_type: string;
  status: string;
  uploaded_at: string;
};

export type VerificationApplication = {
  id: string;
  user_id: string;
  role: VerificationRole;
  status: string;
  requirements_version: number;
  risk_score: number;
  risk_level: string;
  rejection_reason: string | null;
  steps: VerificationStep[];
  requiredSteps: string[];
  progress: number;
  hasConsented: boolean;
  documents: VerificationDocumentMeta[];
  // Fallback preview URLs for images that live directly on the linked
  // store/driver_profile row (uploaded pre-wizard, or by an admin) rather
  // than through a verification_documents row — keyed by the same
  // document_type strings the step schemas use.
  entityDocumentPreviews: Record<string, string>;
};

export const getOrCreateVerificationApplication = async (role: VerificationRole): Promise<VerificationApplication> => {
  try {
    const response = await api.get(`/verification/${role}`);
    return response.data?.application;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || 'Failed to load verification application');
    throw new Error(error.message || 'Network error loading verification application');
  }
};

export const recordVerificationConsent = async (applicationId: string) => {
  try {
    const response = await api.post(`/verification/${applicationId}/consent`);
    return response.data?.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || 'Failed to record consent');
    throw new Error(error.message || 'Network error recording consent');
  }
};

export const saveVerificationStep = async (
  applicationId: string,
  stepKey: string,
  data: Record<string, any>,
  status: 'in_progress' | 'complete' = 'complete'
) => {
  try {
    const response = await api.patch(`/verification/${applicationId}/steps/${stepKey}`, { data, status });
    return response.data?.step as VerificationStep;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || 'Failed to save step');
    throw new Error(error.message || 'Network error saving step');
  }
};

export const uploadVerificationDocument = async (
  applicationId: string,
  uri: string,
  stepKey: string,
  documentType: string,
  previousDocumentId?: string
) => {
  try {
    const filename = uri.split('/').pop() || `${documentType}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1] : 'jpg';
    const mimeType = ext.toLowerCase() === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    // Confirmed via production logs: sending this as an axios/FormData Blob
    // reaches the server with the right filename/mimetype but 0 actual file
    // bytes — RN's Blob-native-store bridging isn't reliably attaching the
    // real content to the outgoing multipart body on this app/architecture.
    // expo-file-system's own File.upload() does a native multipart upload
    // directly from the file on disk, bypassing RN's Blob/FormData path
    // entirely, so it isn't subject to that bug.
    const file = new File(uri);
    if (!file.exists || !file.size) {
      throw new Error('Could not read the selected file — it appears to be empty. Please try picking it again.');
    }

    const token = (await secureStorage.getItem('userToken')) || (await secureStorage.getItem('businessToken'));
    const parameters: Record<string, string> = { stepKey, documentType };
    if (previousDocumentId) parameters.previousDocumentId = previousDocumentId;

    const result = await file.upload(`${API_URL}verification/${applicationId}/documents`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'document',
      mimeType,
      parameters,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const body = result.body ? JSON.parse(result.body) : null;
    if (result.status < 200 || result.status >= 300) {
      throw new Error(body?.error || 'Failed to upload document');
    }
    return body?.data;
  } catch (error: any) {
    throw new Error(error.message || 'Network error uploading document');
  }
};

// The owner (or an admin) is the only one who can resolve a document id to a
// viewable URL — never a raw storage key — and every successful call is
// audit-logged server-side. Used to preview a document already on file
// instead of showing a blank uploader on every re-visit of a step.
export const getVerificationDocumentSignedUrl = async (documentId: string): Promise<string | null> => {
  try {
    const response = await api.get(`/verification/documents/${documentId}/signed-url`);
    return response.data?.document?.signedUrl || null;
  } catch {
    return null; // best-effort preview — a failure here shouldn't block the step from rendering
  }
};

export const submitVerificationLivenessAttempt = async (
  applicationId: string,
  payload: {
    passed: boolean;
    challengeSequence: string;
    // One frame per challenge step PLUS a 'baseline' frame captured before
    // the sequence starts — real (future) server-side liveness analysis
    // needs to compare frames across the sequence (e.g. head-yaw delta for
    // "turn left"), which a single final photo can't support.
    frames: { label: string; uri: string }[];
    antiSpoofScore?: number;
    methodVersion?: string;
    deviceInfo?: string;
    appVersion?: string;
  }
) => {
  try {
    const fields: Record<string, string> = {
      passed: String(payload.passed),
      challengeSequence: payload.challengeSequence,
      methodVersion: payload.methodVersion || 'multi_frame_v1',
    };
    if (payload.antiSpoofScore !== undefined) fields.antiSpoofScore = String(payload.antiSpoofScore);
    if (payload.deviceInfo) fields.deviceInfo = payload.deviceInfo;
    if (payload.appVersion) fields.appVersion = payload.appVersion;
    fields.frameLabels = JSON.stringify(payload.frames.map((f) => f.label));

    const token = (await secureStorage.getItem('userToken')) || (await secureStorage.getItem('businessToken'));
    const { status, body } = await uploadMultipartViaNativeFile(
      `${API_URL}verification/${applicationId}/liveness`,
      fields,
      payload.frames.map((frame) => ({ fieldName: 'frames', filename: `${frame.label}.jpg`, mimeType: 'image/jpeg', uri: frame.uri })),
      token ? { Authorization: `Bearer ${token}` } : {}
    );

    const parsed = body ? JSON.parse(body) : null;
    if (status < 200 || status >= 300) {
      throw new Error(parsed?.error || 'Failed to submit liveness attempt');
    }
    return parsed?.data;
  } catch (error: any) {
    throw new Error(error.message || 'Network error submitting liveness attempt');
  }
};

export const submitVerificationApplication = async (applicationId: string) => {
  try {
    const response = await api.post(`/verification/${applicationId}/submit`);
    return response.data?.application as VerificationApplication;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || 'Failed to submit application');
    throw new Error(error.message || 'Network error submitting application');
  }
};

export const requestShopLocationChange = async (storeId: string, data: {
  addressLine1?: string; city?: string; region?: string; latitude?: number; longitude?: number;
}) => {
  try {
    const response = await api.post('/verification/shop-location-change', { storeId, ...data });
    return response.data?.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || 'Failed to submit location change');
    throw new Error(error.message || 'Network error submitting location change');
  }
};
