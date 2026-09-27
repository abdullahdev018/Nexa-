/**
 * Where an ad-platform connection would plug in.
 *
 * There is none. Nexa writes ads; launching one spends the user's money, so it
 * needs a real ad-account integration AND an explicit confirmation from the
 * user each time. Neither exists, so every ad stays NOT_LAUNCHED and every
 * screen says so, reading from here rather than deciding for itself.
 *
 * Adding a platform means implementing it here, reporting `configured: true`
 * only once its account is genuinely connected, moving an ad through
 * AWAITING_CONFIRMATION → LAUNCHED on the user's confirmation, and storing the
 * platform's own id in `Ad.externalId`.
 */
export interface AdLaunchStatus {
  configured: boolean
  explanation: string
}

export function adLaunching(): AdLaunchStatus {
  return {
    configured: false,
    explanation:
      'No ad account is connected, so Nexa has not launched anything and has not spent any money. ' +
      'Copy these into Ads Manager — or download the CSV — when you are ready to run them.',
  }
}
