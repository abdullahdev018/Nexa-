import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Hides the floating dev badge that sits over the bottom-left of the app in
  // development. Compile and runtime errors are still surfaced.
  devIndicators: false,
}

export default nextConfig
