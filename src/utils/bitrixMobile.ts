/**
 * Bitrix24 & Mobile Environment Utility
 * Provides helpers for BX24 JS SDK, Bitrix24 Mobile App detection, and viewport adjustments.
 */

declare global {
  interface Window {
    BX24?: {
      init: (callback: () => void) => void;
      fitWindow: () => void;
      resizeWindow: (width: number, height: number) => void;
      placement?: {
        info: () => { placement: string; options?: any };
      };
      getAuth?: () => any;
      isAdmin?: () => boolean;
      callMethod?: (method: string, params: any, callback: (res: any) => void) => void;
    };
    BXMobileApp?: {
      UI?: {
        Page?: {
          TopBar?: {
            title?: {
              setText: (text: string) => void;
              show: () => void;
            };
          };
        };
      };
      onCustomEvent?: (event: string, callback: (data: any) => void) => void;
    };
  }
}

/**
 * Detects if the current page is being viewed inside Bitrix24 (Mobile App or Web iframe/slider).
 */
export function isBitrix24Environment(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Check window.BX24 or window.BXMobileApp
  if (window.BX24 || window.BXMobileApp) return true;

  // 2. Check query params typically passed by Bitrix24
  const params = new URLSearchParams(window.location.search);
  if (
    params.has('DOMAIN') ||
    params.has('AUTH_ID') ||
    params.has('APP_SID') ||
    params.has('PLACEMENT') ||
    params.has('from_bitrix')
  ) {
    return true;
  }

  // 3. Check userAgent for Bitrix24 mobile app wrapper
  const ua = navigator.userAgent || '';
  if (/Bitrix24/i.test(ua) || /BitrixMobile/i.test(ua)) {
    return true;
  }

  // 4. Check if loaded inside an iframe whose parent might be bitrix24
  try {
    if (window.self !== window.top) {
      return true;
    }
  } catch {
    // Cross-origin iframe usually means embedded in portal
    return true;
  }

  return false;
}

/**
 * Detects if the device is a mobile or tablet viewport.
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1024;
}

/**
 * Initializes Bitrix24 SDK if present, and auto-resizes iframe when running inside Bitrix24.
 */
export function initBitrix24SDK(onReady?: (info?: any) => void) {
  if (typeof window === 'undefined') return;

  const tryInit = () => {
    if (window.BX24 && typeof window.BX24.init === 'function') {
      try {
        window.BX24.init(() => {
          try {
            if (typeof window.BX24?.fitWindow === 'function') {
              window.BX24.fitWindow();
            }
          } catch (err) {
            console.warn('[BitrixSDK] fitWindow error:', err);
          }

          let placementInfo = null;
          try {
            if (window.BX24?.placement && typeof window.BX24.placement.info === 'function') {
              placementInfo = window.BX24.placement.info();
            }
          } catch {
            // Ignored if placement not active
          }

          if (onReady) onReady(placementInfo);
        });
      } catch (e) {
        console.warn('[BitrixSDK] init failed:', e);
      }
    }

    // Set Bitrix24 Mobile App TopBar Title if available
    try {
      if (window.BXMobileApp?.UI?.Page?.TopBar?.title?.setText) {
        window.BXMobileApp.UI.Page.TopBar.title.setText('BSB Live Chat');
      }
    } catch {
      // Ignored
    }
  };

  // If already loaded or defer
  if (window.BX24) {
    tryInit();
  } else {
    // Listen in case script loads asynchronously
    window.addEventListener('load', tryInit, { once: true });
  }

  // Re-fit on window resize
  window.addEventListener('resize', () => {
    if (window.BX24 && typeof window.BX24.fitWindow === 'function') {
      try {
        window.BX24.fitWindow();
      } catch {
        // Ignored
      }
    }
  });
}

/**
 * Gets the clean, canonical URL of this application for sharing/adding into Bitrix24 menu.
 */
export function getAppUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
}
