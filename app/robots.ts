import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The signed-in surface holds nothing worth indexing and every route
      // there needs a session anyway.
      disallow: ['/chat', '/settings', '/account', '/onboarding', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
