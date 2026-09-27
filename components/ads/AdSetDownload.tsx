'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { adsToCsv, type AdPlatform, type AdVariation } from '@/lib/ads/plan'

/** The whole set as a CSV, built in the browser from what is on the page. */
export function AdSetDownload({ platform, ads, name }: { platform: AdPlatform; ads: AdVariation[]; name: string }) {
  function download() {
    // A byte-order mark, so Excel opens it as UTF-8 rather than mangling accents.
    const blob = new Blob(['﻿', adsToCsv(platform, ads)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'ads'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button size="sm" variant="secondary" onClick={download}>
      <Download className="h-4 w-4" aria-hidden="true" />
      Download CSV
    </Button>
  )
}
