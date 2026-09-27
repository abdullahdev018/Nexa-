import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexa AI',
    short_name: 'Nexa',
    description: 'Your AI marketing team. Give Nexa your product; it builds your marketing campaign.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#0b74e0',
    icons: [
      { src: '/logo/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/logo/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/logo/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
