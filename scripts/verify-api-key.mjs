/**
 * Verifies the key sitting in .env.local — first its shape, then for real by
 * calling the provider. Prints only the length and last four characters, so
 * the key itself never reaches the terminal, the scrollback, or a log.
 *
 *   node scripts/verify-api-key.mjs
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = path.join(root, '.env.local')

/** Minimal dotenv read — enough for this file, and no dependency to install. */
async function readEnv(file) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch {
    return null
  }
  const out = {}
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const tail = (key) => `${key.length} characters, ending ...${key.slice(-4)}`

function fail(message, hint) {
  console.error(`\n  FAILED  ${message}`)
  if (hint) console.error(`          ${hint}`)
  console.error(`\n  Edit line 20 of .env.local, then run this again.`)
  console.error(`  Guide: docs/ADD-API-KEY.md\n`)
  process.exit(1)
}

const env = await readEnv(ENV_FILE)
if (!env) fail('.env.local does not exist.', 'Copy .env.example to .env.local first.')

const provider = env.AI_PROVIDER || 'openrouter'
const spec = {
  openrouter: { name: 'OPENROUTER_API_KEY', prefix: 'sk-or-v1-', label: 'OpenRouter' },
  anthropic: { name: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-', label: 'Anthropic' },
}[provider]

if (!spec) fail(`AI_PROVIDER is "${provider}".`, 'It must be "openrouter" or "anthropic".')

const key = env[spec.name] ?? ''

console.log(`\n  Provider  ${spec.label}  (AI_PROVIDER=${provider})`)
console.log(`  Variable  ${spec.name}`)

// --- Shape checks, cheapest first ------------------------------------------
if (key === '') fail(`${spec.name} is empty.`, 'Paste the key straight after the "=" sign, with nothing else on the line.')
if (/^<.*>$/.test(key)) fail('The placeholder is still there.', 'Replace the whole <...> including the angle brackets.')
if (/\s/.test(key)) fail('The key contains a space.', 'A copy-paste dragged one in. Remove every space.')
if (!key.startsWith(spec.prefix)) {
  fail(
    `A ${spec.label} key must start with "${spec.prefix}".`,
    'Using the other provider? Switch AI_PROVIDER in .env.local to match the key you have.',
  )
}

console.log(`  Key       ${tail(key)} — shape is correct`)
console.log(`\n  Calling ${spec.label} to confirm the key actually works...`)

// --- The real check: does the provider accept it? --------------------------
let res
try {
  res =
    provider === 'openrouter'
      ? await fetch('https://openrouter.ai/api/v1/key', {
          headers: { Authorization: `Bearer ${key}` },
        })
      : await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        })
} catch (error) {
  fail(`Could not reach ${spec.label}: ${error.message}`, 'Check your internet connection and try again.')
}

if (res.status === 401 || res.status === 403) {
  fail(
    `${spec.label} rejected the key (HTTP ${res.status}).`,
    'The key is real but wrong, revoked, or from a different account. Create a fresh one.',
  )
}
if (res.status === 402) {
  fail(`${spec.label} says the account has no credit (HTTP 402).`, 'The key is valid — add billing credit to use it.')
}
if (!res.ok) {
  fail(`${spec.label} returned HTTP ${res.status}.`, 'Not a key problem. Try again in a moment.')
}

// --- A valid key on an empty account still cannot answer a chat ------------
if (provider === 'openrouter') {
  const { data = {} } = await res.json().catch(() => ({}))
  const spent = Number(data.usage ?? 0)
  const cap = data.limit
  const broke = data.is_free_tier === true && spent === 0 && cap === null

  if (broke || (typeof cap === 'number' && spent >= cap)) {
    console.error(`\n  OK BUT     The key is valid — OpenRouter accepted it.`)
    console.error(`  PROBLEM    The account has no credit, so chat will fail with`)
    console.error(`             "The AI provider account is out of credit."`)
    console.error(``)
    console.error(`  Two ways forward:`)
    console.error(`    1. Add credit at https://openrouter.ai/credits (a few dollars is plenty)`)
    console.error(`    2. Or use free models — see "No credit?" in docs/ADD-API-KEY.md`)
    console.error(``)
    process.exit(2)
  }
}

console.log(`\n  OK  ${spec.label} accepted the key. Chat is ready to work.\n`)
