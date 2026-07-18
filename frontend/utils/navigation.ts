import { router } from 'expo-router';

// Clear the current navigation stack before entering a destination, so
// Android back from there exits the app instead of unwinding into whatever
// funnel (login/register/getstarted, or a stale authenticated screen) came
// before it.
//
// dismissAll() (not a manual canGoBack()/back() loop) — a guarded screen in
// the stack (e.g. index.tsx's auth-redirect) can re-push itself when popped
// back into, making canGoBack() stay true forever and freezing the JS thread
// in an infinite synchronous loop. Reproduced once: logs stopped mid-
// navigation with no error, no crash — just silence, right after a manual
// back-loop call.
//
// canDismiss() guards against a dev-only "POP_TO_TOP not handled" warning
// that fires when the stack is already shallow/at its root — harmless, but
// noisy. The try/catch stays as a defensive fallback for any other case.
export function resetToRoute(destination: string) {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // No stack to dismiss — fine, just replace below
  }
  router.replace(destination as any);
}
