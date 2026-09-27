import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AD_SPECS,
  adIssues,
  adPlatformFor,
  adRequestSchema,
  adsToCsv,
  buildAdPrompt,
  matchCta,
  parseAds,
  toVariation,
  updateAdSchema,
} from './plan'

const long = (n: number) => 'x'.repeat(n)

test('Google drops headlines over 30 characters, and needs three that fit', () => {
  const ad = toVariation('GOOGLE', {
    headlines: ['Hand-poured soy candles', long(31), 'Free UK delivery', 'Hand-poured soy candles', '50-hour burn'],
    descriptions: ['Small-batch candles scented with essential oils.', long(91), 'Order by Friday for gifting.'],
    primaryText: 'ignored for search ads',
  })
  assert.ok(ad)
  assert.deepEqual(ad.headlines, ['Hand-poured soy candles', 'Free UK delivery', '50-hour burn'], 'over-limit and duplicate lines go')
  assert.equal(ad.descriptions.length, 2)
  assert.equal(ad.primaryText, '')
  assert.equal(toVariation('GOOGLE', { headlines: ['a', long(40)], descriptions: ['d', 'e'] }), null)
})

test('Meta keeps a long headline but flags it; TikTok needs text', () => {
  const meta = toVariation('META', { primaryText: 'Smell the summer.', headlines: [long(45)], descriptions: [], cta: 'shop NOW' })
  assert.ok(meta)
  assert.equal(meta.headlines[0].length, 45)
  assert.equal(meta.cta, 'Shop now')
  const issues = adIssues('META', meta)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'warning')

  assert.equal(toVariation('TIKTOK', { primaryText: '  ', cta: 'Shop now' }), null)
  const tiktok = toVariation('TIKTOK', { primaryText: long(150) })
  assert.equal(tiktok?.primaryText.length, 100)
})

test('a CTA must be one of the platform buttons', () => {
  assert.equal(matchCta('META', 'Buy it now!!'), null)
  assert.equal(matchCta('TIKTOK', 'apply now'), 'Apply now')
  assert.equal(matchCta('GOOGLE', 'Shop now'), null, 'search ads have no button')
})

test('the checker catches hard-limit breaks after hand edits', () => {
  const issues = adIssues('GOOGLE', { primaryText: '', headlines: ['ok', long(31)], descriptions: ['d'] })
  const errors = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message)
  assert.ok(errors.some((m) => m.includes('at least 3 headlines')))
  assert.ok(errors.some((m) => m.includes('at least 2 descriptions')))
  assert.ok(errors.some((m) => m.includes('will reject it')))
  assert.equal(adIssues('META', { primaryText: long(126), headlines: ['h'], descriptions: [] })[0].severity, 'warning')
})

test('parsing keeps usable ads and caps the count', () => {
  const ad = { primaryText: 'P', headlines: ['H'], cta: 'Learn more' }
  const parsed = parseAds(`Here:\n${JSON.stringify({ ads: [ad, { headlines: [] }, ad, ad] })}`, 'META', 2)
  assert.ok(parsed.ok)
  assert.equal(parsed.value.length, 2)
  assert.equal(parseAds('{"ads":[{"headlines":[]}]}', 'META', 1).ok, false)
  assert.equal(parseAds('nope', 'META', 1).ok, false)
})

test('requests and edits', () => {
  assert.equal(adRequestSchema.parse({ platform: 'META', objective: 'SALES' }).variations, 3)
  assert.equal(adRequestSchema.safeParse({ platform: 'LINKEDIN', objective: 'SALES' }).success, false)
  assert.equal(adRequestSchema.safeParse({ platform: 'META', objective: 'SALES', variations: 6 }).success, false)
  assert.equal(updateAdSchema.safeParse({ status: 'READY' }).success, true)
  assert.equal(updateAdSchema.safeParse({ status: 'PUBLISHED' }).success, false)
  assert.equal(updateAdSchema.safeParse({}).success, false)
})

test('campaign platforms map onto ad platforms', () => {
  assert.equal(adPlatformFor('INSTAGRAM'), 'META')
  assert.equal(adPlatformFor('FACEBOOK'), 'META')
  assert.equal(adPlatformFor('GOOGLE'), 'GOOGLE')
  assert.equal(adPlatformFor('TIKTOK'), 'TIKTOK')
  assert.equal(adPlatformFor(null), 'META')
})

test('the prompt states the limits and forbids invented claims', () => {
  const { system, user } = buildAdPrompt({
    platform: 'GOOGLE',
    objective: 'SALES',
    variations: 2,
    brandBlock: null,
    offer: '15% off first order',
    current: 'OLD AD',
    others: ['Kept ad'],
  })
  assert.match(system, /30 characters or fewer/)
  assert.match(system, /Do not invent claims/)
  assert.match(system, /Write exactly 2 ads for a Google responsive search ad/)
  assert.match(user, /Offer: 15% off first order/)
  assert.match(user, /clearly different angle:\nOLD AD/)
  assert.match(user, /- Kept ad/)
})

test('CSV quotes cells, pads columns and defuses formulas', () => {
  const csv = adsToCsv('GOOGLE', [
    { primaryText: '', headlines: ['A "quoted" one', 'B', 'C'], descriptions: ['=HYPERLINK("x")', 'D2'], cta: null, audienceAngle: null, creativeConcept: null },
    { primaryText: '', headlines: ['A', 'B', 'C', 'D'], descriptions: ['x', 'y'], cta: null, audienceAngle: null, creativeConcept: null },
  ])
  const [header, first] = csv.split('\r\n')
  assert.equal(header, '"Ad","Headline 1","Headline 2","Headline 3","Headline 4","Description 1","Description 2"')
  assert.match(first, /"A ""quoted"" one"/)
  assert.match(first, /"'=HYPERLINK\(""x""\)"/)
  assert.ok(AD_SPECS.META.ctas.includes('Shop now'))
})
