import assert from 'node:assert/strict'
import { test } from 'node:test'
import { daysUntil, priceList, usageByReason } from './usage'
import { devPlanSwitchEnabled, payments } from './payments'

test('usage groups spends by reason, nets refunds and ignores grants', () => {
  const lines = usageByReason([
    { amount: 100, kind: 'GRANT', reason: 'Monthly credits' },
    { amount: -25, kind: 'SPEND', reason: 'Campaign generation' },
    { amount: -25, kind: 'SPEND', reason: 'Campaign generation' },
    { amount: 25, kind: 'REFUND', reason: 'Campaign generation' },
    { amount: -3, kind: 'SPEND', reason: 'Content generation' },
    { amount: -1, kind: 'SPEND', reason: 'AI Assistant' },
    { amount: 1, kind: 'REFUND', reason: 'AI Assistant' },
  ])
  assert.deepEqual(lines, [
    { reason: 'Campaign generation', credits: 25, times: 2 },
    { reason: 'Content generation', credits: 3, times: 1 },
  ])
})

test('the price list says what the balance still covers', () => {
  const list = priceList(30)
  assert.equal(list[0].feature, 'CAMPAIGN')
  assert.equal(list[0].affordable, 1)
  assert.equal(list.find((line) => line.feature === 'CHAT')?.affordable, 30)
  assert.equal(priceList(-5)[0].affordable, 0)
})

test('days until renewal', () => {
  const now = new Date('2026-09-26T12:00:00Z')
  assert.equal(daysUntil(new Date('2026-09-28T00:00:00Z'), now), 2)
  assert.equal(daysUntil(new Date('2026-09-01T00:00:00Z'), now), 0)
})

test('no payment provider is claimed, and the dev switch needs both guards', () => {
  assert.equal(payments().configured, false)
  assert.equal(devPlanSwitchEnabled({ NODE_ENV: 'development', NEXA_DEV_PLAN_SWITCH: '1' }), true)
  assert.equal(devPlanSwitchEnabled({ NODE_ENV: 'development' }), false)
  assert.equal(devPlanSwitchEnabled({ NODE_ENV: 'production', NEXA_DEV_PLAN_SWITCH: '1' }), false)
})

test('prices for unbuilt features are not listed as buyable', () => {
  assert.ok(!priceList(1000).some((line) => line.feature === 'COMPETITOR'))
})
