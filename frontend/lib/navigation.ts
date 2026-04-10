import { router } from 'expo-router';

/**
 * Navigation utility to prevent "Double Tap" or "Duplicate Stack" navigation issues.
 * This is a common problem on slow devices or networks where multiple clicks 
 * result in the same screen being pushed onto the stack multiple times.
 */

let lastNavigateTime = 0;
const THROTTLE_DELAY = 600; // ms

export const safePush = (route: string, params?: Record<string, any>) => {
  const now = Date.now();
  if (now - lastNavigateTime < THROTTLE_DELAY) {
    return;
  }
  lastNavigateTime = now;

  if (params) {
    router.push({ pathname: route, params } as any);
  } else {
    router.push(route as any);
  }
};

export const safeNavigate = (route: string, params?: Record<string, any>) => {
  const now = Date.now();
  if (now - lastNavigateTime < THROTTLE_DELAY) {
    return;
  }
  lastNavigateTime = now;

  if (params) {
    router.navigate({ pathname: route, params } as any);
  } else {
    router.navigate(route as any);
  }
};

export const safeReplace = (route: string, params?: Record<string, any>) => {
  const now = Date.now();
  if (now - lastNavigateTime < THROTTLE_DELAY) {
    return;
  }
  lastNavigateTime = now;

  if (params) {
    router.replace({ pathname: route, params } as any);
  } else {
    router.replace(route as any);
  }
};
