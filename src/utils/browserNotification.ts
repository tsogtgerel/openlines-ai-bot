/**
 * ============================================================================
 * 🔔 Browser Desktop Notification Service
 * ============================================================================
 * 
 * Provides permission management and safe desktop notification dispatching
 * for new inquiries arriving in assigned channels, with graceful degradation
 * in sandboxed iframes or browsers without Notification support.
 */

const NOTIFICATION_STORAGE_KEY = 'bsb_browser_notification_enabled';

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isBrowserNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
  return stored !== 'false'; // Default to true if not explicitly turned off
}

export function setBrowserNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return Notification.permission;
  } catch {
    return 'default';
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.debug('[BrowserNotification] Permission request was not permitted or cancelled:', err);
    return 'denied';
  }
}

export interface NewChatNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export function sendNewChatNotification({
  title,
  body,
  icon,
  tag,
  onClick,
}: NewChatNotificationOptions): Notification | null {
  if (!isBrowserNotificationSupported()) return null;
  if (!isBrowserNotificationEnabled()) return null;

  try {
    if (Notification.permission !== 'granted') {
      return null;
    }

    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      tag: tag || 'bsb-new-chat-inquiry',
      silent: true, // We use synthesized Web Audio for pristine, polite chimes
    });

    if (onClick) {
      notification.onclick = (event) => {
        event.preventDefault();
        try {
          window.focus();
        } catch {}
        onClick();
        notification.close();
      };
    }

    // Auto-close after 8 seconds to prevent notification clutter
    setTimeout(() => {
      try {
        notification.close();
      } catch {}
    }, 8000);

    return notification;
  } catch (err) {
    console.debug('[BrowserNotification] Notification display failed:', err);
    return null;
  }
}
