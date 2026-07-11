import Constants from 'expo-constants';

// Single source of truth: the "version" field in app.json.
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
