import { api, extractErrorMessage } from './client';

export interface Disclaimer {
  id: string;
  type: string;
  version: string;
  title: string;
  content: string;
  is_active: boolean;
}

export interface DisclaimerAcknowledgement {
  id: string;
  user_id: string;
  disclaimer_type: string;
  version: string;
  context_id?: string;
  context_type?: string;
  ip_address?: string;
  device_info?: string;
  acknowledged_at: string;
}

/**
 * Fetch disclaimer by type
 */
export const getDisclaimerByType = async (type: string): Promise<Disclaimer> => {
  try {
    const response = await api.get(`/disclaimers/${type}`);
    return response.data.disclaimer;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

/**
 * Acknowledge / accept a disclaimer
 */
export const acknowledgeDisclaimer = async (
  disclaimerType: string,
  version: string,
  contextId?: string,
  contextType?: string
): Promise<DisclaimerAcknowledgement> => {
  try {
    const response = await api.post('/disclaimers/acknowledge', {
      disclaimerType,
      version,
      contextId,
      contextType,
    });
    return response.data.acknowledgement;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

/**
 * Check if the user has already acknowledged a specific disclaimer
 */
export const checkAcknowledgement = async (
  type: string,
  version?: string,
  contextId?: string
): Promise<{ acknowledged: boolean; acknowledgement: DisclaimerAcknowledgement | null }> => {
  try {
    const response = await api.get('/disclaimers/check', {
      params: { type, version, contextId },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
