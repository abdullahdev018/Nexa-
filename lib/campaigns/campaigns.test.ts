import assert from 'node:assert/strict'
import { test } from 'node:test'
import { campaignBriefSchema, defaultCampaignName, isGenerationStale } from './options'
import {
  buildCampaignPrompt,
  buildItemPrompt,
  extractJson,
  parseCampaignPlan,
  parseItem,
  planToAssets,
} from './plan'

const PLAN = {
  strategy: {
    summary: 'Position Fig Candle as the thoughtful gift.',
    objective: 'Sell 300 units in 30 days.',
    keyMessage: 'A gift that smells like somewhere.',
    phases: [
      { name: 'Tease', focus: 'Scent stories' },
      { name: 'Launch', focus: 'Offer' },
    ],
  },
  audienceSummary: 'Gift buyers 25–45.',
  positioning: 'Premium but personal.',
  marketingAngle: 'Scent as memory.',
  hook: 'This candle smells like a Greek summer.',
  alternativeHooks: ['A', 'B', 'C', 'D', 'E', 'F-extra'],
  contentIdeas: [
    { title: 'Unboxing', platform: 'Instagram', format: 'Reels', description: 'Slow unboxing.' },
    { title: 'Broken', platform: 'Instagram' },
  ],
  videoConcepts: [{ title: 'Pour', hook: 'Watch this.', concept: 'Hand-pour close-ups.', platform: 'TikTok' }],
  adCopy: [{ platform: 'meta', headline: 'Smell the summer', primaryText: 'Hand-poured.', description: '' }],
  socialCaptions: [{ platform: 'IG', caption: 'Golden hour.', hashtags: ['#candles', 'soy wax', ''] }],
  ctas: ['Shop now'],
  calendar: [
    { day: 3, platform: 'INSTAGRAM', format: 'POST', title: 'Day three', notes: 'n' },
    { day: '1', platform: 'Pinterest', format: 'webinar', title: 'Day one' },
  ],
}

test('a plan wrapped in a fence and prose still parses', () => {
  const reply = `Here you go!\n\`\`\`json\n${JSON.stringify(PLAN)}\n\`\`\``
  const result = parseCampaignPlan(reply)
  assert.ok(result.ok)
})

test('lists are capped, broken items dropped, and labels normalised', () => {
  const result = parseCampaignPlan(JSON.stringify(PLAN))
  assert.ok(result.ok)
  const plan = result.value
  assert.equal(plan.alternativeHooks.length, 5)
  assert.equal(plan.contentIdeas.length, 1, 'the idea with no description is dropped')
  assert.equal(plan.contentIdeas[0].platform, 'INSTAGRAM')
  assert.equal(plan.contentIdeas[0].format, 'REEL')
  assert.equal(plan.adCopy[0].platform, 'FACEBOOK')
  assert.equal(plan.adCopy[0].description, null)
  assert.deepEqual(plan.socialCaptions[0].hashtags, ['#candles', '#soywax'])
  // An unknown platform becomes null rather than failing the whole plan.
  assert.equal(plan.calendar[1].platform, null)
  assert.equal(plan.calendar[1].day, 1)
})

test('items that leave out platform or format still count', () => {
  const result = parseCampaignPlan(
    JSON.stringify({
      ...PLAN,
      videoConcepts: [{ title: 'Pour', hook: 'Watch', concept: 'Macro' }],
      contentIdeas: [{ title: 'Idea', description: 'D' }],
      calendar: [{ day: 1, title: 'Slot' }],
    }),
  )
  assert.ok(result.ok, result.ok ? '' : result.reason)
  assert.equal(result.value.videoConcepts[0].platform, null)
  assert.equal(result.value.contentIdeas[0].format, null)
  assert.equal(result.value.calendar[0].platform, null)
})

test('a plan missing a required section is a failure, not a partial campaign', () => {
  const result = parseCampaignPlan(JSON.stringify({ ...PLAN, strategy: undefined }))
  assert.equal(result.ok, false)
  assert.equal(parseCampaignPlan(JSON.stringify({ ...PLAN, ctas: [] })).ok, false)
  assert.equal(parseCampaignPlan('Sorry, I cannot help with that.').ok, false)
  assert.equal(extractJson('{ not json'), null)
})

test('assets come out in kind order, with the calendar sorted by day', () => {
  const result = parseCampaignPlan(JSON.stringify(PLAN))
  assert.ok(result.ok)
  const assets = planToAssets(result.value)

  assert.equal(assets[0].kind, 'STRATEGY')
  assert.match(assets[0].body, /Objective: Sell 300/)
  assert.match(assets[0].body, /1\. Tease — Scent stories/)
  assert.equal(assets.filter((a) => a.kind === 'ALT_HOOK').length, 5)

  const calendar = assets.filter((a) => a.kind === 'CONTENT_CALENDAR')
  assert.deepEqual(calendar.map((a) => a.meta?.day), [1, 3])
  assert.deepEqual(calendar.map((a) => a.position), [0, 1])

  const ad = assets.find((a) => a.kind === 'AD_COPY')!
  assert.equal(ad.title, 'Smell the summer')
  assert.equal(ad.body, 'Hand-poured.')
})

test('a single regenerated item parses into the same shape', () => {
  const idea = parseItem(
    'CONTENT_IDEA',
    '{"item":{"title":"New","platform":"tiktok","format":"short","description":"D"}}',
  )
  assert.ok(idea.ok)
  assert.deepEqual(idea.value, { title: 'New', platform: 'TIKTOK', format: 'SHORT', description: 'D' })
  assert.equal(parseItem('CTA', '{"item":""}').ok, false)
  assert.equal(parseItem('CTA', '{"cta":"Buy"}').ok, false)
})

test('prompts carry the brief and brand, and never ask for other platforms', () => {
  const brief = {
    productName: 'Fig Candle',
    goal: 'SALES' as const,
    style: 'LUXURY' as const,
    platforms: ['INSTAGRAM' as const, 'TIKTOK' as const],
    audienceInterests: ['home decor'],
  }
  const { system, user } = buildCampaignPrompt(brief, '<brand>\nName: Lumen\n</brand>')
  assert.match(system, /<brand>/)
  assert.match(system, /use only the platforms in the brief/)
  assert.match(user, /Platforms: Instagram, TikTok/)
  assert.match(user, /Audience interests: home decor/)
  assert.doesNotMatch(user, /Pain points/)

  const item = buildItemPrompt({
    kind: 'CTA',
    brief,
    brandBlock: null,
    strategy: null,
    current: 'Shop now',
    siblings: ['Order today'],
  })
  assert.match(item.system, /PLATFORM is one of: INSTAGRAM, TIKTOK\./)
  assert.match(item.user, /- Order today/)
})

test('a brief needs a product, a goal, a style and a platform', () => {
  const base = { goal: 'SALES', style: 'FUN', platforms: ['INSTAGRAM', 'INSTAGRAM'] }
  assert.equal(campaignBriefSchema.safeParse(base).success, false)

  const ok = campaignBriefSchema.parse({ ...base, product: { name: ' Fig ' } })
  assert.deepEqual(ok.platforms, ['INSTAGRAM'], 'duplicates are removed')
  assert.equal(ok.product?.name, 'Fig')
  assert.equal(ok.name, null)

  assert.equal(campaignBriefSchema.safeParse({ ...base, productId: 'p1', platforms: [] }).success, false)
  assert.equal(campaignBriefSchema.safeParse({ ...base, productId: 'p1', goal: 'WORLD_PEACE' }).success, false)
})

test('names and stale generations', () => {
  assert.equal(defaultCampaignName('Fig Candle', 'PRODUCT_LAUNCH'), 'Fig Candle — Product launch')
  const now = new Date('2026-09-26T12:00:00Z')
  assert.ok(isGenerationStale('GENERATING', new Date('2026-09-26T11:50:00Z'), now))
  assert.ok(!isGenerationStale('GENERATING', new Date('2026-09-26T11:58:00Z'), now))
  assert.ok(!isGenerationStale('READY', new Date('2026-09-26T11:00:00Z'), now))
})
