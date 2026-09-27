import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildVideoPrompt,
  normaliseTimings,
  parseVideoPlan,
  planToText,
  videoPlanSchema,
  videoRequestSchema,
  voiceoverScript,
  type Scene,
} from './plan'

const scene = (start: number, end: number, extra: Partial<Scene> = {}): Scene => ({
  start,
  end,
  shot: 'Close-up',
  visual: `Visual ${start}`,
  onScreenText: null,
  voiceover: null,
  sound: null,
  ...extra,
})

const PLAN = {
  title: 'Fig pour',
  hook: { line: 'Your flat, on holiday.', visual: 'Match strike', onScreenText: 'POV' },
  scenes: [scene(10, 20, { voiceover: 'Second line' }), scene(0, 10, { voiceover: 'First line', onScreenText: 'Soy' })],
  cta: { line: 'Pre-order today.' },
  music: 'Warm lo-fi',
  shotList: ['Match strike', '  ', 'Pour'],
  thumbnail: null,
  caption: 'Fig & cedar.',
}

test('a request needs a video platform and a listed length', () => {
  const base = { type: 'UGC', platform: 'TIKTOK', durationSeconds: 30 }
  assert.equal(videoRequestSchema.safeParse(base).success, true)
  assert.equal(videoRequestSchema.safeParse({ ...base, platform: 'WHATSAPP' }).success, false)
  assert.equal(videoRequestSchema.safeParse({ ...base, durationSeconds: 20 }).success, false)
  assert.equal(videoRequestSchema.safeParse({ ...base, conceptId: 'c' }).success, false)
  assert.equal(videoRequestSchema.parse({ ...base, durationSeconds: '45' }).durationSeconds, 45)
})

test('timings are ordered, gapless and end exactly at the target length', () => {
  const out = normaliseTimings([scene(20, 24), scene(0, 3), scene(3, 20)], 30)
  // Weights 3 / 17 / 4 of 30 seconds.
  assert.deepEqual(out.map((s) => [s.start, s.end]), [[0, 4], [4, 25], [25, 30]])
  for (let i = 1; i < out.length; i += 1) assert.equal(out[i].start, out[i - 1].end)
  assert.equal(out.at(-1)!.end, 30)
})

test('a hand edit keeps the editor order', () => {
  const out = normaliseTimings([scene(0, 10), scene(10, 20), scene(0, 3)], 30, { keepOrder: true })
  assert.deepEqual(out.map((s) => s.visual), ['Visual 0', 'Visual 10', 'Visual 0'])
  assert.equal(out.at(-1)!.end, 30)
  assert.equal(out[2].start, out[1].end)
})

test('every scene keeps at least a second, even with silly input', () => {
  const out = normaliseTimings([scene(0, 0), scene(0, 0), scene(0, 100)], 15)
  for (const s of out) assert.ok(s.end - s.start >= 1, JSON.stringify(out))
  assert.equal(out.at(-1)!.end, 15)
  const crowded = normaliseTimings(Array.from({ length: 20 }, (_, i) => scene(i, i + 1)), 15)
  assert.equal(crowded.length, 15)
  assert.equal(crowded.at(-1)!.end, 15)
})

test('a reply parses into a normalised plan; a thin one fails', () => {
  const parsed = parseVideoPlan(`Sure!\n${JSON.stringify(PLAN)}`, 30)
  assert.ok(parsed.ok)
  assert.equal(parsed.value.scenes[0].visual, 'Visual 0')
  assert.equal(parsed.value.scenes.at(-1)!.end, 30)
  assert.deepEqual(parsed.value.shotList, ['Match strike', 'Pour'])
  assert.equal(parsed.value.hook.onScreenText, 'POV')

  assert.equal(parseVideoPlan(JSON.stringify({ ...PLAN, scenes: [scene(0, 5)] }), 30).ok, false)
  assert.equal(parseVideoPlan(JSON.stringify({ ...PLAN, cta: {} }), 30).ok, false)
  assert.equal(parseVideoPlan('nope', 30).ok, false)
})

test('the plan exports as text and as a voiceover script', () => {
  const parsed = parseVideoPlan(JSON.stringify(PLAN), 30)
  assert.ok(parsed.ok)
  const text = planToText(parsed.value)
  assert.match(text, /^FIG POUR\n\nHOOK\nYour flat, on holiday\.\nVisual: Match strike\nOn screen: POV/)
  assert.match(text, /0:00–0:15 {2}Close-up\n {2}Visual: Visual 0\n {2}On screen: Soy\n {2}Voiceover: First line/)
  assert.match(text, /SHOT LIST\n- Match strike\n- Pour/)
  assert.doesNotMatch(text, /THUMBNAIL/)
  assert.equal(voiceoverScript(parsed.value), 'Your flat, on holiday.\n\nFirst line\n\nSecond line\n\nPre-order today.')
})

test('the editor saves through the same schema', () => {
  assert.equal(videoPlanSchema.safeParse({ ...PLAN, title: '' }).success, false)
  assert.equal(videoPlanSchema.safeParse({ ...PLAN, scenes: [scene(0, 1, { shot: '' }), scene(1, 2)] }).success, false)
})

test('the prompt forbids fabricated testimonials and pins the length', () => {
  const { system, user } = buildVideoPrompt({
    type: 'TESTIMONIAL',
    platform: 'INSTAGRAM',
    durationSeconds: 45,
    brandBlock: '<brand>\nName: Lumen\n</brand>',
    product: 'Fig Candle',
    concept: 'Pour ritual',
    previous: 'OLD PLAN',
  })
  assert.match(system, /never\s+a fabricated quote/)
  assert.match(system, /from 0 to 45 seconds/)
  assert.match(system, /<brand>/)
  assert.match(user, /45-second testimonial video for Instagram/)
  assert.match(user, /video concept from the campaign:\nPour ritual/)
  assert.match(user, /clearly different approach:\nOLD PLAN/)
})
