/**
 * SafeMarkdownRenderer - XSS-safe markdown rendering component
 * 
 * Renders markdown content without using dangerouslySetInnerHTML.
 * Supports: h2, h3, paragraphs, bold, code, lists, blockquotes.
 */

import React from 'react';
import { parseMarkdownToBlocks, parseInlineMarkdown, type TextSegment } from '@/lib/safeMarkdown';
import { cn } from '@/lib/utils';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'default' | 'blog';
}

function InlineContent({ segments }: { segments: TextSegment[] }) {
  return (
    <>
      {segments.map((segment, i) => {
        if (segment.bold) {
          return (
            <strong key={i} className="text-white font-semibold">
              {segment.text}
            </strong>
          );
        }
        if (segment.code) {
          return (
            <code key={i} className="bg-white/10 px-2 py-0.5 rounded text-white/80 text-sm">
              {segment.text}
            </code>
          );
        }
        return <span key={i}>{segment.text}</span>;
      })}
    </>
  );
}

export function SafeMarkdownRenderer({ 
  content, 
  className,
  variant = 'default' 
}: SafeMarkdownRendererProps) {
  const blocks = parseMarkdownToBlocks(content);
  
  const styles = {
    default: {
      h2: 'text-xl font-semibold text-white mt-8 mb-4',
      h3: 'text-lg font-medium text-white mt-6 mb-3',
      p: 'text-white/60 mb-4 leading-relaxed',
      blockquote: 'border-l-2 border-white/20 pl-4 italic text-white/50 my-4',
      code: 'bg-white/5 border border-white/10 rounded-xl p-4 overflow-x-auto my-4',
      codeText: 'text-white/70 text-sm font-mono whitespace-pre-wrap',
      list: 'list-disc list-inside text-white/60 mb-4 space-y-1',
      listItem: 'ml-4',
    },
    blog: {
      h2: 'text-2xl font-semibold text-white mt-12 mb-4',
      h3: 'text-xl font-medium text-white mt-8 mb-3',
      p: 'text-white/70 mb-4 leading-relaxed',
      blockquote: 'border-l-4 border-primary/50 pl-4 italic text-white/60 my-6 bg-white/5 py-2 rounded-r-lg',
      code: 'bg-white/5 border border-white/10 rounded-xl p-4 overflow-x-auto my-6',
      codeText: 'text-white/70 text-sm font-mono whitespace-pre-wrap',
      list: 'list-disc list-inside text-white/70 mb-4 space-y-2',
      listItem: 'ml-4',
    },
  };

  const s = styles[variant];

  return (
    <div className={cn('space-y-1', className)}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2 key={index} className={s.h2}>
                <InlineContent segments={parseInlineMarkdown(block.content)} />
              </h2>
            );
          
          case 'h3':
            return (
              <h3 key={index} className={s.h3}>
                <InlineContent segments={parseInlineMarkdown(block.content)} />
              </h3>
            );
          
          case 'p':
            return (
              <p key={index} className={s.p}>
                <InlineContent segments={parseInlineMarkdown(block.content)} />
              </p>
            );
          
          case 'blockquote':
            return (
              <blockquote key={index} className={s.blockquote}>
                <InlineContent segments={parseInlineMarkdown(block.content)} />
              </blockquote>
            );
          
          case 'code':
            return (
              <pre key={index} className={s.code}>
                <code className={s.codeText}>{block.content}</code>
              </pre>
            );
          
          case 'list':
            return (
              <ul key={index} className={s.list}>
                {block.items?.map((item, i) => (
                  <li key={i} className={s.listItem}>
                    <InlineContent segments={parseInlineMarkdown(item)} />
                  </li>
                ))}
              </ul>
            );
          
          default:
            return null;
        }
      })}
    </div>
  );
}
