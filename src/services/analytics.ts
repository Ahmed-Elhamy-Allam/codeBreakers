/**
 * Microsoft Clarity analytics wrapper.
 *
 * Clarity captures session replays, heatmaps, and usage insights so you can
 * see exactly how players move through the game. It only activates when a
 * project ID is provided via VITE_CLARITY_PROJECT_ID, so local/dev builds
 * without the env var are completely no-ops.
 *
 * Get the project ID from your Clarity dashboard → Settings → Overview.
 */
import Clarity from '@microsoft/clarity';

const PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;

let started = false;

/** Initialize Clarity once. Safe to call multiple times. */
export function initAnalytics(): void {
  if (started || !PROJECT_ID) return;
  try {
    Clarity.init(PROJECT_ID);
    started = true;
  } catch (err) {
    // Never let analytics break the app.
    console.warn('[analytics] Clarity init failed:', err);
  }
}

/** Whether Clarity is active (project ID configured + initialized). */
export function analyticsEnabled(): boolean {
  return started;
}

/**
 * Associate the current session with a player. Lets you see recordings and
 * heatmaps per custom id (player) / session / page in the Clarity dashboard.
 */
export function identifyPlayer(playerId: string, playerName?: string): void {
  if (!started) return;
  try {
    // (customId, customSessionId?, customPageId?, friendlyName?)
    Clarity.identify(playerId, undefined, undefined, playerName);
  } catch {
    /* ignore */
  }
}

/** Tag the session with a key/value so you can filter/segment in Clarity. */
export function setTag(key: string, value: string | string[]): void {
  if (!started) return;
  try {
    Clarity.setTag(key, value);
  } catch {
    /* ignore */
  }
}

/** Record a custom event (e.g. "game_started", "booster_sabotage"). */
export function trackEvent(name: string): void {
  if (!started) return;
  try {
    Clarity.event(name);
  } catch {
    /* ignore */
  }
}

/**
 * Pass cookie-consent status. Clarity defaults to requiring consent for
 * EEA/UK/CH visitors; call this when the user accepts. We grant by default
 * here since there's no PII collected beyond gameplay interaction, but you
 * can wire it to a real consent banner later.
 */
export function grantConsent(granted = true): void {
  if (!started) return;
  try {
    Clarity.consent(granted);
  } catch {
    /* ignore */
  }
}
