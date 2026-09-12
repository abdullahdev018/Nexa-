/**
 * A small Markdown parser, sized for chat replies.
 *
 * It handles what a model actually emits — headings, lists, fenced code,
 * tables, blockquotes, rules and the common inline marks — and deliberately
 * stops there. The output is a block tree the renderer turns into React
 * elements, so no HTML is ever produced and nothing needs sanitising.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'strike'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Inline[] }

export type Block =
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4; content: Inline[] }
  | { type: 'code'; language: string | null; value: string }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'quote'; children: Block[] }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { type: 'rule' }

/* ---------------------------------------------------------------------------
 * Inline parsing
 * ------------------------------------------------------------------------ */

/**
 * Ordered so that the longest delimiters are tried first (`**` before `*`).
 * The link target allows one level of balanced parentheses, so URLs like
 * `…/Foo_(disambiguation)` — and malformed ones like `javascript:alert(1)` —
 * are captured whole rather than leaving a stray `)` behind in the text.
 */
const INLINE_PATTERN =
  /(`+)([\s\S]*?)\1|\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([^*\n]+?)\*|_([^_\n]+?)_|\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)|<(https?:\/\/[^>\s]+)>|(https?:\/\/[^\s<>()[\]]+)/

/** Only these schemes are ever emitted as links. */
function safeHref(href: string): string | null {
  const trimmed = href.trim()
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed
  // Relative links are fine; anything else (javascript:, data:) is dropped.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed
  return null
}

export function parseInline(input: string): Inline[] {
  const out: Inline[] = []
  let rest = input

  while (rest.length > 0) {
    const match = INLINE_PATTERN.exec(rest)
    if (!match || match.index === undefined) {
      out.push({ type: 'text', value: rest })
      break
    }

    if (match.index > 0) {
      out.push({ type: 'text', value: rest.slice(0, match.index) })
    }

    const [
      whole,
      backticks,
      codeValue,
      boldItalic,
      bold,
      boldAlt,
      strike,
      italic,
      italicAlt,
      linkText,
      linkHref,
      autoAngle,
      autoBare,
    ] = match

    if (backticks !== undefined) {
      // Per CommonMark, one leading/trailing space inside a code span is
      // stripped so `` ` `` can be written.
      out.push({ type: 'code', value: (codeValue ?? '').replace(/^ | $/g, '') })
    } else if (boldItalic !== undefined) {
      out.push({ type: 'bold', children: [{ type: 'italic', children: parseInline(boldItalic) }] })
    } else if (bold !== undefined || boldAlt !== undefined) {
      out.push({ type: 'bold', children: parseInline(bold ?? boldAlt) })
    } else if (strike !== undefined) {
      out.push({ type: 'strike', children: parseInline(strike) })
    } else if (italic !== undefined || italicAlt !== undefined) {
      out.push({ type: 'italic', children: parseInline(italic ?? italicAlt) })
    } else if (linkHref !== undefined) {
      const href = safeHref(linkHref)
      const children = parseInline(linkText ?? '')
      if (href) out.push({ type: 'link', href, children })
      else out.push(...children)
    } else if (autoAngle !== undefined || autoBare !== undefined) {
      const raw = autoAngle ?? autoBare
      const href = safeHref(raw)
      if (href) out.push({ type: 'link', href, children: [{ type: 'text', value: raw }] })
      else out.push({ type: 'text', value: raw })
    }

    rest = rest.slice(match.index + whole.length)
  }

  return out
}

/* ---------------------------------------------------------------------------
 * Block parsing
 * ------------------------------------------------------------------------ */

const HEADING = /^(#{1,4})\s+(.*)$/
const FENCE = /^(`{3,}|~{3,})\s*([\w+-]*)\s*$/
const UNORDERED = /^([ \t]*)([-*+])\s+(.*)$/
const ORDERED = /^([ \t]*)(\d{1,9})[.)]\s+(.*)$/
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === '') {
      index += 1
      continue
    }

    // Fenced code — taken verbatim, including blank lines, until the closing
    // fence or the end of input (a stream can stop mid-block).
    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1][0]
      const length = fence[1].length
      const language = fence[2] || null
      const body: string[] = []
      index += 1

      while (index < lines.length) {
        const candidate = lines[index]
        const closing = FENCE.exec(candidate)
        if (closing && closing[1][0] === marker && closing[1].length >= length && !closing[2]) {
          index += 1
          break
        }
        body.push(candidate)
        index += 1
      }

      blocks.push({ type: 'code', language, value: body.join('\n') })
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4,
        content: parseInline(heading[2].trim()),
      })
      index += 1
      continue
    }

    // Table: a header row followed by a divider row.
    if (line.includes('|') && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
      const head = splitRow(line).map(parseInline)
      index += 2
      const rows: Inline[][][] = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(splitRow(lines[index]).map(parseInline))
        index += 1
      }
      blocks.push({ type: 'table', head, rows })
      continue
    }

    if (line.trimStart().startsWith('>')) {
      const body: string[] = []
      while (index < lines.length && lines[index].trimStart().startsWith('>')) {
        body.push(lines[index].trimStart().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', children: parseMarkdown(body.join('\n')) })
      continue
    }

    const unordered = UNORDERED.exec(line)
    const ordered = ORDERED.exec(line)
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered)
      const start = ordered ? Number(ordered[2]) : 1
      const items: string[][] = []

      while (index < lines.length) {
        const current = lines[index]
        const nextUnordered = UNORDERED.exec(current)
        const nextOrdered = ORDERED.exec(current)
        const marker = isOrdered ? nextOrdered : nextUnordered

        if (marker) {
          items.push([marker[3]])
          index += 1
          continue
        }

        // A blank line only ends the list if the following line is not an
        // indented continuation of the current item.
        if (current.trim() === '') {
          const following = lines[index + 1]
          if (following && /^(\s{2,}|\t)/.test(following)) {
            items.at(-1)?.push('')
            index += 1
            continue
          }
          break
        }

        if (/^(\s{2,}|\t)/.test(current) && items.length > 0) {
          items.at(-1)?.push(current.replace(/^(\s{2,}|\t)/, ''))
          index += 1
          continue
        }

        break
      }

      blocks.push({
        type: 'list',
        ordered: isOrdered,
        start,
        items: items.map((item) => parseMarkdown(item.join('\n'))),
      })
      continue
    }

    // Anything else is a paragraph, running until a blank line or the start of
    // another block.
    const paragraph: string[] = []
    while (index < lines.length) {
      const current = lines[index]
      if (
        current.trim() === '' ||
        FENCE.test(current) ||
        HEADING.test(current) ||
        RULE.test(current) ||
        UNORDERED.test(current) ||
        ORDERED.test(current) ||
        current.trimStart().startsWith('>')
      ) {
        break
      }
      paragraph.push(current)
      index += 1
    }

    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', content: parseInline(paragraph.join('\n')) })
    }
  }

  return blocks
}
