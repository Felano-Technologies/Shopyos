import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './store/themeStore'
import App from './App.tsx'

// Vite fires this when a lazy-loaded route chunk 404s — happens whenever a tab
// stays open across a deploy and then navigates to a page whose chunk hash
// changed. A single reload picks up the new index.html/chunks; guard against
// a reload loop in case the deploy itself is actually broken.
const RELOAD_GUARD_KEY = 'shopyos-admin:reloaded-after-preload-error';
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
  window.location.reload();
});
// Clear the guard once this load has run cleanly for a bit, so a later,
// unrelated deploy can still trigger one more auto-reload in the same tab.
setTimeout(() => sessionStorage.removeItem(RELOAD_GUARD_KEY), 10000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
