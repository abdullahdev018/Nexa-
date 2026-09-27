import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PLATFORM_FORMATS, generateContentSchema, updateContentSchema } from './options'
import { buildContentPrompt, buildReplacementPrompt, parseVariations, variationToBody } from './plan'

const REEL = {
  title: 'Pour ritual',
  hook: 'Stop scrolling — smell this.',
  scenes: [
    { time: '0–3s', visual: 'Match strikes', onScreenText: 'POV: Sunday', voiceover: 'Okay, listen.' },
    { time: '3–8s', visual: 'Wax pours', onScreenText: null },
    { visual: 'Candle lit' },
  ],
  caption: 'Hand-poured, fig and cedar.',
  hashtags: ['#soycandle', 'home decor', 42],
  cta: 'Pre-order now',
}

test('Ad Studio owns ads: no platform offers the AD format here', () => {
  for (const formats of Object.values(PLATFORM_FORMATS)) assert.ok(!formats.includes('AD'))
})

test('a request must pick a format the platform has', () => {
  const base = { platform: 'WHATSAPP', topic: 'New scent drop', format: 'POST' }
  assert.equal(generateContentSchema.safeParse(base).success, true)
  const bad = generateContentSchema.safeParse({ ...base, format: 'REEL' })
  assert.equal(bad.success, false)
  assert.equal(generateContentSchema.safeParse({ ...base, format: 'AD' }).success, false)
  assert.equal(generateContentSchema.safeParse({ ...base, variations: 4 }).success, false)
  assert.equal(generateContentSchema.safeParse({ ...base, ideaId: 'x' }).success, false, 'an idea needs its campaign')
  assert.equal(generateContentSchema.parse(base).variations, 1)
})

test('status can only be set to draft or ready by hand', () => {
  assert.equal(updateContentSchema.safeParse({ status: 'READY' }).success, true)
  assert.equal(updateContentSchema.safeParse({ status: 'PUBLISHED' }).success, false)
  assert.equal(updateContentSchema.safeParse({ status: 'SCHEDULED' }).success, false)
  assert.equal(updateContentSchema.safeParse({}).success, false)
})

test('a reel flattens into hook, script, caption, CTA and hashtags', () => {
  const parsed = parseVariations(JSON.stringify({ variations: [REEL] }), 'REEL', 1)
  assert.ok(parsed.ok)
  const body = variationToBody('REEL', parsed.value[0])
  assert.match(body, /^HOOK\nStop scrolling/)
  assert.match(body, /SCRIPT\n0–3s — Match strikes\n {3}On screen: POV: Sunday\n {3}Voiceover: Okay, listen\./)
  assert.match(body, /Scene 3 — Candle lit/)
  assert.match(body, /CAPTION\nHand-poured/)
  assert.match(body, /CALL TO ACTION\nPre-order now/)
  assert.match(body, /#soycandle #homedecor$/)
})

test('variations that do not fit the format are dropped, and extras capped', () => {
  const thin = { title: 'Thin', scenes: [{ visual: 'one' }] }
  const parsed = parseVariations(JSON.stringify({ variations: [thin, REEL, REEL, REEL] }), 'REEL', 2)
  assert.ok(parsed.ok)
  assert.equal(parsed.value.length, 2)
  assert.equal(parseVariations(JSON.stringify({ variations: [thin] }), 'REEL', 1).ok, false)
  assert.equal(parseVariations('no json here', 'POST', 1).ok, false)
})

test('carousels, stories and posts each keep their own shape', () => {
  const carousel = parseVariations(
    JSON.stringify({ variations: [{ title: 'c', slides: [{ heading: 'A' }, { heading: 'B', text: 'b' }, { heading: 'C' }], caption: 'cap' }] }),
    'CAROUSEL',
    1,
  )
  assert.ok(carousel.ok)
  assert.match(variationToBody('CAROUSEL', carousel.value[0]), /SLIDES\n1\. A\n2\. B\n {3}b\n3\. C\n\nCAPTION\ncap/)

  const story = parseVariations(JSON.stringify({ variations: [{ title: 's', frames: [{ text: 'one' }, { text: 'two', visual: 'v' }] }] }), 'STORY', 1)
  assert.ok(story.ok)
  assert.match(variationToBody('STORY', story.value[0]), /FRAMES\n1\. one\n2\. two\n {3}Visual: v/)

  const post = parseVariations(JSON.stringify({ variations: [{ title: 'p', body: 'Copy', visual: 'Flat lay' }] }), 'POST', 1)
  assert.ok(post.ok)
  assert.equal(variationToBody('POST', post.value[0]), 'POST\nCopy\n\nVISUAL\nFlat lay')
})

test('prompts name the platform norms, count and context', () => {
  const { system, user } = buildContentPrompt({
    platform: 'TIKTOK',
    format: 'SHORT',
    topic: 'Why soy wax',
    variations: 3,
    brandBlock: '<brand>\nName: Lumen\n</brand>',
    campaign: 'Goal: Sales',
    idea: 'Myth-busting soy wax',
    instructions: 'Mention the 50-hour burn',
  })
  assert.match(system, /Write exactly 3 variations/)
  assert.match(system, /TikTok: native/)
  assert.match(system, /"scenes"/)
  assert.match(user, /Write a TikTok short\./)
  assert.match(user, /content idea from the campaign:\nMyth-busting/)
  assert.match(user, /Extra instructions from the user: Mention the 50-hour burn/)

  const replacement = buildReplacementPrompt({
    platform: 'INSTAGRAM', format: 'CAPTION', topic: 't', variations: 1, brandBlock: null,
    current: 'Old caption', others: ['Kept one'],
  })
  assert.match(replacement.system, /Write exactly 1 variation\b/)
  assert.match(replacement.user, /Old caption/)
  assert.match(replacement.user, /- Kept one/)
})
