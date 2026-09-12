/**
 * A compact, dependency-free syntax highlighter.
 *
 * It tokenises with one combined regex per language family rather than
 * attempting a real parse. That is enough for comments, strings, numbers,
 * keywords and function names to read correctly in a chat transcript, at a
 * fraction of the weight of a full highlighting library.
 */

export type TokenType =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'builtin'
  | 'function'
  | 'property'
  | 'tag'
  | 'attr'

export interface Token {
  type: TokenType
  value: string
}

interface Grammar {
  keywords: string[]
  builtins: string[]
  /** Line-comment prefixes, e.g. `//` or `#`. */
  lineComment: string[]
  blockComment?: [string, string]
  /** Set for markup languages, which are tokenised tag-first. */
  markup?: boolean
}

const JS_KEYWORDS = [
  'abstract','as','async','await','break','case','catch','class','const','continue','debugger',
  'declare','default','delete','do','else','enum','export','extends','finally','for','from',
  'function','get','if','implements','import','in','instanceof','interface','let','new','of',
  'private','protected','public','readonly','return','satisfies','set','static','super','switch',
  'this','throw','try','type','typeof','var','void','while','yield',
]

const GRAMMARS: Record<string, Grammar> = {
  javascript: {
    keywords: JS_KEYWORDS,
    builtins: ['true','false','null','undefined','NaN','Infinity','console','Math','JSON','Promise','Array','Object','String','Number','Boolean','Date','Map','Set','RegExp','Error'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
  },
  typescript: {
    keywords: [...JS_KEYWORDS, 'any','unknown','never','namespace','keyof','infer','asserts'],
    builtins: ['true','false','null','undefined','string','number','boolean','object','symbol','bigint','void','console','Promise','Record','Partial','Array','Object'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
  },
  python: {
    keywords: ['and','as','assert','async','await','break','class','continue','def','del','elif','else','except','finally','for','from','global','if','import','in','is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield','match','case'],
    builtins: ['True','False','None','self','cls','print','len','range','dict','list','set','tuple','int','str','float','bool','open','enumerate','zip','sum','min','max','type','isinstance'],
    lineComment: ['#'],
  },
  go: {
    keywords: ['break','case','chan','const','continue','default','defer','else','fallthrough','for','func','go','goto','if','import','interface','map','package','range','return','select','struct','switch','type','var'],
    builtins: ['true','false','nil','iota','append','cap','copy','delete','len','make','new','panic','print','recover','string','int','int64','float64','bool','byte','rune','error'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
  },
  rust: {
    keywords: ['as','async','await','break','const','continue','crate','dyn','else','enum','extern','fn','for','if','impl','in','let','loop','match','mod','move','mut','pub','ref','return','self','static','struct','super','trait','type','unsafe','use','where','while'],
    builtins: ['true','false','None','Some','Ok','Err','String','Vec','Option','Result','Box','i32','i64','u32','u64','f64','usize','bool','str'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
  },
  java: {
    keywords: ['abstract','assert','break','case','catch','class','const','continue','default','do','else','enum','extends','final','finally','for','if','implements','import','instanceof','interface','native','new','package','private','protected','public','return','static','strictfp','super','switch','synchronized','this','throw','throws','transient','try','volatile','while','var','record'],
    builtins: ['true','false','null','int','long','double','float','boolean','char','byte','short','void','String','List','Map','Set','System','Integer','Object'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
  },
  sql: {
    keywords: ['select','from','where','insert','into','values','update','set','delete','create','table','alter','drop','index','join','inner','left','right','full','outer','on','group','by','order','having','limit','offset','union','all','distinct','as','and','or','not','in','exists','between','like','case','when','then','else','end','with','returning','primary','key','foreign','references','constraint','default','cascade'],
    builtins: ['null','true','false','int','integer','text','varchar','boolean','timestamp','date','serial','uuid','jsonb','count','sum','avg','min','max','coalesce','now'],
    lineComment: ['--'],
    blockComment: ['/*', '*/'],
  },
  bash: {
    keywords: ['if','then','else','elif','fi','for','while','do','done','case','esac','function','return','in','select','until','local','export','source','set','unset'],
    builtins: ['echo','cd','ls','cat','grep','sed','awk','curl','mkdir','rm','cp','mv','chmod','npm','node','git','docker','sudo','exit','test'],
    lineComment: ['#'],
  },
  css: {
    keywords: ['import','media','supports','keyframes','font-face','charset','layer','container'],
    builtins: ['inherit','initial','unset','none','auto','flex','grid','block','absolute','relative','fixed','sticky','hidden','var'],
    lineComment: [],
    blockComment: ['/*', '*/'],
  },
  json: { keywords: [], builtins: ['true', 'false', 'null'], lineComment: [] },
  yaml: { keywords: [], builtins: ['true', 'false', 'null', 'yes', 'no'], lineComment: ['#'] },
  html: { keywords: [], builtins: [], lineComment: [], markup: true },
}

/** Language aliases, so ```js and ```javascript behave the same. */
const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  golang: 'go',
  rs: 'rust',
  postgres: 'sql',
  postgresql: 'sql',
  mysql: 'sql',
  yml: 'yaml',
  scss: 'css',
  xml: 'html',
  svg: 'html',
}

export function resolveLanguage(language: string | null): string | null {
  if (!language) return null
  const key = language.toLowerCase()
  const resolved = ALIASES[key] ?? key
  return resolved in GRAMMARS ? resolved : null
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Builds (and caches) the one combined pattern used to scan a language. */
const patternCache = new Map<string, RegExp>()

function patternFor(language: string, grammar: Grammar): RegExp {
  const cached = patternCache.get(language)
  if (cached) return cached

  const parts: string[] = []

  if (grammar.blockComment) {
    const [open, close] = grammar.blockComment
    parts.push(`(?<block>${escapeRegex(open)}[\\s\\S]*?(?:${escapeRegex(close)}|$))`)
  }
  if (grammar.lineComment.length > 0) {
    parts.push(`(?<line>(?:${grammar.lineComment.map(escapeRegex).join('|')})[^\\n]*)`)
  }

  if (grammar.markup) {
    parts.push('(?<tag><\\/?[A-Za-z][\\w:-]*)')
    parts.push('(?<attr>[A-Za-z_:][\\w:.-]*(?=\\s*=))')
  }

  // Strings: double, single, and backtick, each tolerating escapes and an
  // unterminated tail (code can arrive mid-stream).
  parts.push('(?<string>"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?|`(?:\\\\.|[^`\\\\])*`?)')
  parts.push('(?<number>\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b|\\b0[xX][0-9a-fA-F]+\\b)')
  parts.push('(?<function>\\b[A-Za-z_$][\\w$]*(?=\\s*\\())')
  parts.push('(?<word>\\b[A-Za-z_$][\\w$]*\\b)')

  const pattern = new RegExp(parts.join('|'), 'g')
  patternCache.set(language, pattern)
  return pattern
}

export function highlight(code: string, language: string | null): Token[] {
  const resolved = resolveLanguage(language)
  if (!resolved) return [{ type: 'plain', value: code }]

  const grammar = GRAMMARS[resolved]
  const pattern = patternFor(resolved, grammar)
  const keywords = new Set(grammar.keywords)
  const builtins = new Set(grammar.builtins)

  const tokens: Token[] = []
  let lastIndex = 0
  pattern.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = pattern.exec(code)) !== null) {
    // A zero-length match would spin forever.
    if (match[0] === '') {
      pattern.lastIndex += 1
      continue
    }

    if (match.index > lastIndex) {
      tokens.push({ type: 'plain', value: code.slice(lastIndex, match.index) })
    }

    const groups = match.groups ?? {}
    let type: TokenType = 'plain'

    if (groups.block || groups.line) type = 'comment'
    else if (groups.tag) type = 'tag'
    else if (groups.attr) type = 'attr'
    else if (groups.string) type = 'string'
    else if (groups.number) type = 'number'
    else if (groups.function) {
      // A keyword followed by "(" — `if (`, `while (` — is still a keyword.
      type = keywords.has(match[0]) ? 'keyword' : 'function'
    } else if (groups.word) {
      const lower = match[0].toLowerCase()
      if (keywords.has(match[0]) || keywords.has(lower)) type = 'keyword'
      else if (builtins.has(match[0]) || builtins.has(lower)) type = 'builtin'
      else type = 'plain'
    }

    tokens.push({ type, value: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < code.length) {
    tokens.push({ type: 'plain', value: code.slice(lastIndex) })
  }

  return tokens
}

/** Tailwind classes per token type, used by the code block renderer. */
export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: '',
  comment: 'text-ink-400 italic',
  string: 'text-brand-300',
  number: 'text-amber-300',
  keyword: 'text-violet-300',
  builtin: 'text-sky-300',
  function: 'text-blue-200',
  property: 'text-sky-200',
  tag: 'text-brand-300',
  attr: 'text-amber-200',
}
