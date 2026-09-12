/**
 * Theme resolution, shared by the server layout and the client control.
 *
 * The chosen theme lives in two places on purpose: the database row is the
 * durable record tied to the account, and a cookie is what the server layout
 * can read cheaply on every request to stamp the right class on <html> before
 * anything paints. Without the cookie the page would render light and then
 * snap to dark after hydration.
 */

export const THEMES = ['LIGHT', 'DARK', 'SYSTEM'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_COOKIE = 'nexa_theme'
export const DEFAULT_THEME: Theme = 'SYSTEM'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

/**
 * Runs before first paint, inlined into the document head.
 *
 * It reads the same cookie the server read. For an explicit choice the server
 * has already set the class and this is a no-op; for SYSTEM the OS preference
 * is only knowable here, so this is what actually applies it.
 */
export const THEME_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
var t=m?decodeURIComponent(m[1]):'${DEFAULT_THEME}';
var dark=t==='DARK'||(t!=='LIGHT'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',dark);
}catch(e){}})()`

/** Resolves a theme to the boolean the `dark` class represents. */
export function prefersDark(theme: Theme): boolean {
  if (theme === 'DARK') return true
  if (theme === 'LIGHT') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Applies a theme in the browser and records it in the cookie the server reads
 * on the next request. The database write is separate — this is what makes the
 * change visible instantly and survive a reload without a flash.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', prefersDark(theme))
  // A year, so the choice survives; Lax because it is only ever read by this
  // site's own document requests.
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`
}
