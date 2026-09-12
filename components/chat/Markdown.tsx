import type { ReactNode } from 'react'
import { parseMarkdown, type Block, type Inline } from '@/lib/utils/markdown'
import { CodeBlock } from './CodeBlock'

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return node.value
      case 'bold':
        return (
          <strong key={index} className="font-semibold text-ink-900">
            {renderInline(node.children)}
          </strong>
        )
      case 'italic':
        return <em key={index}>{renderInline(node.children)}</em>
      case 'strike':
        return (
          <del key={index} className="text-ink-500">
            {renderInline(node.children)}
          </del>
        )
      case 'code':
        return (
          <code
            key={index}
            className="rounded border border-ink-200 bg-ink-100 px-1.5 py-0.5 font-mono text-[0.86em] text-ink-800"
          >
            {node.value}
          </code>
        )
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            // noreferrer as well as noopener: the target should not learn where
            // the click came from.
            rel="noopener noreferrer"
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            {renderInline(node.children)}
          </a>
        )
    }
  })
}

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-6 mb-3 text-[21px] font-semibold tracking-tight',
  2: 'mt-6 mb-2.5 text-[18.5px] font-semibold tracking-tight',
  3: 'mt-5 mb-2 text-[16.5px] font-semibold',
  4: 'mt-4 mb-1.5 text-[15px] font-semibold',
}

function renderBlocks(blocks: Block[]): ReactNode {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'paragraph':
        return (
          <p key={index} className="my-3 leading-[1.7] first:mt-0 last:mb-0">
            {renderInline(block.content)}
          </p>
        )

      case 'heading': {
        const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4'
        return (
          <Tag key={index} className={`${HEADING_CLASS[block.level]} text-ink-900 first:mt-0`}>
            {renderInline(block.content)}
          </Tag>
        )
      }

      case 'code':
        return <CodeBlock key={index} code={block.value} language={block.language} />

      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul'
        return (
          <Tag
            key={index}
            start={block.ordered ? block.start : undefined}
            className={`my-3 space-y-1.5 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-ink-400`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="leading-[1.7] [&>p]:my-0">
                {renderBlocks(item)}
              </li>
            ))}
          </Tag>
        )
      }

      case 'quote':
        return (
          <blockquote
            key={index}
            className="my-4 border-l-[3px] border-brand-300 bg-brand-50/50 py-1 pl-4 pr-3 text-ink-700"
          >
            {renderBlocks(block.children)}
          </blockquote>
        )

      case 'table':
        return (
          // Wide tables scroll on their own rather than stretching the message.
          <div key={index} className="scroll-subtle my-4 overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-ink-300">
                  {block.head.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      className="px-3 py-2 text-left font-semibold text-ink-900"
                      scope="col"
                    >
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-ink-200 last:border-0">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2 align-top text-ink-700">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      case 'rule':
        return <hr key={index} className="my-6 border-ink-200" />
    }
  })
}

/**
 * Renders a model reply. Nothing here produces HTML from the model's output —
 * the parser emits a typed tree and every node becomes a React element, so
 * markup in a reply is text, never markup.
 */
export function Markdown({ content }: { content: string }) {
  return <div className="text-[15px] text-ink-800">{renderBlocks(parseMarkdown(content))}</div>
}
