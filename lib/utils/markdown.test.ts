// Sanity checks for the markdown parser. Run with `npm test`, which loads tsx
// so the TypeScript source can be imported directly.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseInline, parseMarkdown, type Block, type Inline } from './markdown'

/** Narrows a block to one variant, failing the test if it is something else. */
function block<T extends Block['type']>(source: string, type: T, index = 0) {
  const blocks = parseMarkdown(source)
  const found = blocks[index]
  assert.ok(found, `expected a block at index ${index}`)
  assert.equal(found.type, type)
  return found as Extract<Block, { type: T }>
}

function inline<T extends Inline['type']>(nodes: Inline[], type: T, index = 0) {
  const found = nodes[index]
  assert.ok(found, `expected an inline node at index ${index}`)
  assert.equal(found.type, type)
  return found as Extract<Inline, { type: T }>
}

test('parses headings and paragraphs', () => {
  assert.equal(block('# Title\n\nSome text.', 'heading').level, 1)
  block('# Title\n\nSome text.', 'paragraph', 1)
})

test('keeps fenced code verbatim, including blank lines', () => {
  const code = block('```ts\nconst a = 1\n\nconst b = 2\n```', 'code')
  assert.equal(code.language, 'ts')
  assert.equal(code.value, 'const a = 1\n\nconst b = 2')
})

test('closes an unterminated fence at end of input', () => {
  assert.equal(block('```\nstreaming...', 'code').value, 'streaming...')
})

test('does not treat markdown inside code as markup', () => {
  assert.equal(block('```\n**not bold**\n```', 'code').value, '**not bold**')
})

test('parses unordered lists', () => {
  const list = block('- one\n- two', 'list')
  assert.equal(list.ordered, false)
  assert.equal(list.items.length, 2)
})

test('keeps the start number of an ordered list', () => {
  const list = block('3. three\n4. four', 'list')
  assert.equal(list.ordered, true)
  assert.equal(list.start, 3)
})

test('parses tables', () => {
  const table = block('| A | B |\n| --- | --- |\n| 1 | 2 |', 'table')
  assert.equal(table.head.length, 2)
  assert.equal(table.rows.length, 1)
})

test('parses inline marks', () => {
  const nodes = parseInline('**bold** and `code` and *it*')
  inline(nodes, 'bold')
  assert.ok(nodes.some((node) => node.type === 'code'))
  assert.ok(nodes.some((node) => node.type === 'italic'))
})

test('drops dangerous link schemes but keeps the text', () => {
  const nodes = parseInline('[click](javascript:alert(1))')
  assert.ok(!nodes.some((node) => node.type === 'link'))
  const text = nodes.map((node) => (node.type === 'text' ? node.value : '')).join('')
  assert.equal(text, 'click')
})

test('keeps http links', () => {
  assert.equal(inline(parseInline('[docs](https://example.com)'), 'link').href, 'https://example.com')
})

test('keeps balanced parentheses inside a link target', () => {
  const link = inline(parseInline('[wiki](https://example.com/Foo_(bar))'), 'link')
  assert.equal(link.href, 'https://example.com/Foo_(bar)')
})

test('handles blockquotes', () => {
  const quote = block('> quoted\n> lines', 'quote')
  assert.equal(quote.children[0].type, 'paragraph')
})
