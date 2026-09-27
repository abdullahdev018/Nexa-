/**
 * Where a video renderer would plug in.
 *
 * There is none. Nexa writes video plans; turning one into a video file needs
 * a rendering provider, and no provider is integrated. This module exists so
 * that fact lives in one place: every screen asks `videoRendering()` and says
 * what it returns, rather than each deciding for itself what to claim.
 *
 * Adding a provider means implementing it here, setting `configured: true`
 * only when its credentials are present, and moving `Video.renderStatus`
 * through QUEUED → PROCESSING → READY/FAILED from its real job events. Until
 * then every video stays NOT_CONFIGURED, which is the truth.
 */
export interface VideoRenderingStatus {
  configured: boolean
  provider: string | null
  /** Shown wherever a user might expect a rendered file. */
  explanation: string
}

export function videoRendering(): VideoRenderingStatus {
  return {
    configured: false,
    provider: null,
    explanation:
      'No video provider is connected, so Nexa does not render video files. ' +
      'It writes the plan — shots, script, on-screen text and voiceover — for you or a creator to film.',
  }
}
