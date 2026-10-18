/**
 * Clean Service Worker Registration & Instant Update Module for NEXA CBT
 *
 * Implements:
 * - Unified single registration entrypoint
 * - Seamless client auto-refresh on new SW activation (controllerchange)
 * - Anti-looping reload guard
 * - Periodic and visibility-based update polling
 * - Dynamic Vite chunk load error auto-recovery
 */

let refreshing = false;
let isInitialized = false;
let isChunkRecoveryInitialized = false;

export function setupChunkErrorRecovery() {
  if (typeof window === 'undefined' || isChunkRecoveryInitialized) return;
  isChunkRecoveryInitialized = true;

  const CHUNK_RELOAD_KEY = 'nexa_chunk_retry_timestamp';
  const RELOAD_TIMEOUT = 10000;

  const isChunkError = (err) => {
    const msg = (err?.message || err?.name || String(err || '')).toLowerCase();
    return (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('failed to load module script') ||
      msg.includes('loading chunk') ||
      msg.includes('chunkloaderror') ||
      msg.includes('importing a module script failed')
    );
  };

  let isOnlinePending = false;

  const triggerReload = () => {
    // If device is offline, defer reload until network connectivity is restored
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!isOnlinePending) {
        isOnlinePending = true;
        window.addEventListener('online', () => {
          isOnlinePending = false;
          triggerReload();
        }, { once: true });
      }
      return;
    }

    const now = Date.now();
    try {
      const last = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10);
      if (!last || now - last >= RELOAD_TIMEOUT) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
        window.location.reload();
      }
    } catch {
      // Storage access blocked (iframe sandbox, private browsing) or quota exceeded:
      // Prevent fatal infinite reload loop by checking URL parameter fallback
      const hasRetried = typeof window !== 'undefined' && /[?&]chunk_retry=/.test(window.location.search);
      if (!hasRetried && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('chunk_retry', String(now));
        window.location.replace(url.href);
      }
    }
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkError(event.reason)) {
      event.preventDefault();
      triggerReload();
    }
  });

  window.addEventListener('error', (event) => {
    if (isChunkError(event.message || event.error)) {
      triggerReload();
    }
  });
}

export function registerSW() {
  if (typeof window === 'undefined') return;

  // Always enable dynamic chunk error recovery
  setupChunkErrorRecovery();

  if (!('serviceWorker' in navigator) || isInitialized) {
    return;
  }
  isInitialized = true;

  // Track whether page was already controlled to distinguish initial install from updates
  let hadController = Boolean(navigator.serviceWorker.controller);

  // In-memory fallback if sessionStorage throws QuotaExceededError or is restricted
  let inMemoryUpdateDeferred = false;

  const isExamActive = () => {
    try {
      return Boolean(
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nexa_active_exam')) ||
        (typeof window !== 'undefined' && window.location.hash.includes('exam'))
      );
    } catch {
      return typeof window !== 'undefined' && window.location.hash.includes('exam');
    }
  };

  // Seamless client auto-refresh when new service worker takes over
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    if (!hadController) {
      hadController = true;
      return;
    }
    if (isExamActive()) {
      // Defer reload during an active exam to protect student exam integrity
      try {
        sessionStorage.setItem('nexa_update_deferred', '1');
      } catch {
        inMemoryUpdateDeferred = true;
      }
      return;
    }
    refreshing = true;
    window.location.reload();
  });

  const performRegistration = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // If a worker is already waiting upon registration, trigger immediate takeover
        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Trigger deferred reload after exam session finishes
        const triggerDeferredUpdateIfReady = () => {
          try {
            const hasDeferred = inMemoryUpdateDeferred || Boolean(sessionStorage.getItem('nexa_update_deferred'));
            if (hasDeferred && !isExamActive()) {
              inMemoryUpdateDeferred = false;
              try {
                sessionStorage.removeItem('nexa_update_deferred');
              } catch {}
              if (!refreshing) {
                refreshing = true;
                window.location.reload();
                return true;
              }
            }
          } catch {
            if (inMemoryUpdateDeferred && !isExamActive()) {
              inMemoryUpdateDeferred = false;
              if (!refreshing) {
                refreshing = true;
                window.location.reload();
                return true;
              }
            }
          }
          return false;
        };

        // Trigger manual check when active document visibility changes or tab regains focus
        const checkUpdate = () => {
          if (triggerDeferredUpdateIfReady()) return;
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };

        const onNavigation = () => {
          if (triggerDeferredUpdateIfReady()) return;
          registration.update().catch(() => {});
        };

        document.addEventListener('visibilitychange', checkUpdate);
        window.addEventListener('focus', checkUpdate);
        window.addEventListener('pageshow', checkUpdate);
        window.addEventListener('online', checkUpdate);
        window.addEventListener('popstate', onNavigation);
        window.addEventListener('hashchange', onNavigation);

        // Periodic background update check every 30 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        // Immediate takeover signal if update is found
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration failed:', error);
      });
  };

  if (document.readyState === 'complete') {
    performRegistration();
  } else {
    window.addEventListener('load', performRegistration);
  }
}

export default registerSW;
