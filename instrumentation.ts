/**
 * Runs once when the server starts, before it accepts requests.
 *
 * Its only job is to say plainly whether the active AI provider has a
 * credential, so a misconfigured deployment is obvious in the boot log rather
 * than surfacing as a failed chat later. It reports the variable NAME only —
 * the value is never read into a log line.
 */
export async function register(): Promise<void> {
  // Guard the runtime: the edge bundle has no access to these modules.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { reportProviderConfig } = await import('@/lib/ai')
  reportProviderConfig()
}
