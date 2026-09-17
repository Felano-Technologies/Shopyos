import { useCallback } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { CustomInAppToast } from '@/components/InAppToastHost';

type RequireAuthOptions = {
  /** Toast copy shown when the user isn't signed in. */
  message?: string;
  /** Route to return to after a successful login (e.g. the current screen). */
  redirect?: string;
};

/**
 * Gate for account-only actions (favorite, follow, chat, review, checkout)
 * reachable from screens guests can otherwise browse freely. If signed in,
 * runs `action` immediately; if not, prompts and routes to /login, optionally
 * carrying a `redirect` param so login.tsx can send the user back afterward.
 */
export function useRequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const requireAuth = useCallback(
    (action: () => void, options: RequireAuthOptions = {}) => {
      if (isAuthenticated) {
        action();
        return true;
      }
      CustomInAppToast.show({
        type: 'info',
        title: 'Sign in required',
        message: options.message || 'Please sign in to continue.',
      });
      router.push(
        options.redirect
          ? { pathname: '/login', params: { redirect: options.redirect } }
          : ('/login' as any)
      );
      return false;
    },
    [isAuthenticated]
  );

  return { isAuthenticated, requireAuth };
}
