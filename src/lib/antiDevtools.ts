import DisableDevtool from 'disable-devtool';

/**
 * The devtools guard, ported from the reference's `cf()`.
 *
 * The reference runs this once at startup and configures it to redirect to
 * `about:blank` rather than its default 404 page — in practice that closes the
 * console instead of navigating away. It is skipped on localhost and on the
 * preview worker hosts so development is not interrupted, matching the
 * reference's `ignoreLocalhost` default.
 */

/** Hosts the reference exempts from the guard. */
function isExemptHost(): boolean {
  if (typeof window === 'undefined' || !window.location) return true;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host === 'streamxtv.hybrows.workers.dev' ||
    host === 'framextv-fe.hybrows.workers.dev'
  );
}

let installed = false;

export function installDevtoolsGuard(): void {
  if (installed || typeof window === 'undefined') return;
  if (isExemptHost()) return;
  installed = true;
  try {
    DisableDevtool({
      url: 'about:blank',
      timeOutUrl: 'about:blank',
      disableMenu: true,
      clearLog: true,
    });
  } catch {
    // The guard is best-effort; a failure must never affect the app.
  }
}
