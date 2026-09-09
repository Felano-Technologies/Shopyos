// services/verification.ts
// Thin wrappers over the Phase 1 verification API (backend/routes/verificationRoutes.js)
// for the seller (and later driver) onboarding wizard.

import { api } from './client';
import { uriToBlob } from './uploadUtils';

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
    const blob = await uriToBlob(uri, mimeType);

    const formData = new FormData();
    formData.append('document', blob, filename);
    formData.append('stepKey', stepKey);
    formData.append('documentType', documentType);
    if (previousDocumentId) formData.append('previousDocumentId', previousDocumentId);

    const response = await api.post(`/verification/${applicationId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || 'Failed to upload document');
    throw new Error(error.message || 'Network error uploading document');
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
    const formData = new FormData();
    formData.append('passed', String(payload.passed));
    formData.append('challengeSequence', payload.challengeSequence);
    if (payload.antiSpoofScore !== undefined) formData.append('antiSpoofScore', String(payload.antiSpoofScore));
    formData.append('methodVersion', payload.methodVersion || 'multi_frame_v1');
    if (payload.deviceInfo) formData.append('deviceInfo', payload.deviceInfo);
    if (payload.appVersion) formData.append('appVersion', payload.appVersion);

    const frameLabels: string[] = [];
    for (const frame of payload.frames) {
      const blob = await uriToBlob(frame.uri, 'image/jpeg');
      formData.append('frames', blob, `${frame.label}.jpg`);
      frameLabels.push(frame.label);
    }
    formData.append('frameLabels', JSON.stringify(frameLabels));

    const response = await api.post(`/verification/${applicationId}/liveness`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || 'Failed to submit liveness attempt');
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
