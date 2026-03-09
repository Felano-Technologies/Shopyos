/**
 * Background Task Names
 * Constants for all background tasks in the app
 */

export const TASK_DRIVER_LOCATION = 'TASK_DRIVER_LOCATION';

/**
 * Geofence / proximity task — runs for ALL authenticated users.
 * Fires a local notification when the user is within PROXIMITY_RADIUS_METERS
 * of any Shopyos-approved store, and also caches the human-readable location
 * text into AsyncStorage so the home screen can display it instantly.
 */
export const TASK_LOCATION_GEOFENCE = 'TASK_LOCATION_GEOFENCE';

/** Radius (in metres) at which a "you're near a store" notification fires */
export const PROXIMITY_RADIUS_METERS = 300;

