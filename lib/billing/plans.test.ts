import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CREDIT_COSTS,
  PLANS,
  PLAN_IDS,
  PLAN_LIST,
  creditCost,
  formatPrice,
  getPlan,
  planAllows,
  planIncludes,
  planLimit,
} from './plans'

test('every plan id has a definition that agrees with its key', () => {
  for (const id of PLAN_IDS) {
    assert.equal(PLANS[id].id, id)
  }
  assert.equal(PLAN_LIST.length, PLAN_IDS.length)
})

test('credit allowances match the published plans', () => {
  assert.equal(PLANS.FREE.monthlyCredits, 100)
  assert.equal(PLANS.STARTER.monthlyCredits, 500)
  assert.equal(PLANS.PRO.monthlyCredits, 2000)
  assert.equal(PLANS.AGENCY.monthlyCredits, 7000)
})

test('allowances and brand limits only ever increase up the ladder', () => {
  for (let i = 1; i < PLAN_IDS.length; i += 1) {
    const lower = PLANS[PLAN_IDS[i - 1]]
    const higher = PLANS[PLAN_IDS[i]]
    assert.ok(
      higher.monthlyCredits > lower.monthlyCredits,
      `${higher.id} should grant more credits than ${lower.id}`,
    )
    assert.ok(
      higher.limits.brands >= lower.limits.brands,
      `${higher.id} should allow at least as many brands as ${lower.id}`,
    )
  }
})

test('a paid plan never costs more per month when billed yearly', () => {
  for (const plan of PLAN_LIST) {
    assert.ok(
      plan.yearlyPriceCents <= plan.monthlyPriceCents * 12,
      `${plan.id} yearly price should not exceed twelve monthly payments`,
    )
  }
})

test('planIncludes orders the ladder', () => {
  assert.ok(planIncludes('PRO', 'FREE'))
  assert.ok(planIncludes('PRO', 'PRO'))
  assert.ok(!planIncludes('FREE', 'PRO'))
  assert.ok(planIncludes('AGENCY', 'STARTER'))
  assert.ok(!planIncludes('STARTER', 'AGENCY'))
})

test('feature gates follow the published plans', () => {
  assert.ok(!planAllows('FREE', 'brandKit'))
  assert.ok(planAllows('STARTER', 'brandKit'))
  assert.ok(!planAllows('STARTER', 'videoGeneration'))
  assert.ok(planAllows('PRO', 'videoGeneration'))
  assert.ok(!planAllows('PRO', 'clientWorkspaces'))
  assert.ok(planAllows('AGENCY', 'clientWorkspaces'))
  // The free plan is the only one that watermarks.
  assert.ok(planAllows('FREE', 'watermarkedExports'))
  assert.ok(!planAllows('STARTER', 'watermarkedExports'))
})

test('planLimit reads the numeric caps', () => {
  assert.equal(planLimit('FREE', 'brands'), 1)
  assert.equal(planLimit('PRO', 'brands'), 5)
  assert.equal(planLimit('AGENCY', 'workspaces'), 20)
})

test('an unknown plan falls back to FREE rather than throwing', () => {
  assert.equal(getPlan('NONSENSE').id, 'FREE')
  assert.equal(getPlan(null).id, 'FREE')
  assert.equal(getPlan(undefined).id, 'FREE')
})

test('every credit cost is a positive whole number', () => {
  for (const [feature, cost] of Object.entries(CREDIT_COSTS)) {
    assert.ok(Number.isInteger(cost) && cost > 0, `${feature} should cost a positive integer`)
  }
})

test('creditCost falls back rather than returning NaN', () => {
  assert.equal(creditCost('CAMPAIGN'), CREDIT_COSTS.CAMPAIGN)
  // @ts-expect-error — deliberately outside the union, as a bad caller would be.
  assert.equal(creditCost('NOT_A_FEATURE'), 1)
})

test('formatPrice drops decimals only for whole amounts', () => {
  assert.equal(formatPrice(0), '$0')
  assert.equal(formatPrice(900), '$9')
  assert.equal(formatPrice(2900), '$29')
  assert.equal(formatPrice(1250), '$12.50')
})

test('pricing never presents an unbuilt capability as included', async () => {
  const { UNBUILT, TEAM_INVITES_BUILT } = await import('./plans')
  const { FEATURES } = await import('@/lib/content/landing')

  // A feature card on the landing page must be something the product does.
  for (const feature of FEATURES) {
    if (feature.requires) assert.ok(!UNBUILT.has(feature.requires), `${feature.title} is not built`)
  }

  // Highlights naming an unbuilt capability must be marked soon.
  const unbuiltWords = [/competitor/i, /client workspace/i, /bulk/i, /white-label/i]
  if (!TEAM_INVITES_BUILT) unbuiltWords.push(/team member/i)
  for (const plan of PLAN_LIST) {
    for (const highlight of plan.highlights) {
      if (unbuiltWords.some((pattern) => pattern.test(highlight.text))) {
        assert.ok(highlight.soon, `${plan.id}: "${highlight.text}" must be marked soon`)
      }
    }
  }
})

test('no plan claims a watermark or a vague "advanced" tier', () => {
  for (const plan of PLAN_LIST) {
    for (const highlight of plan.highlights) {
      assert.doesNotMatch(highlight.text, /watermark|advanced campaign|limited ai/i, `${plan.id}: ${highlight.text}`)
    }
  }
})
