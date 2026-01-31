/**
 * Safe Markdown-to-HTML renderer
 * 
 * Renders markdown content safely without using dangerouslySetInnerHTML.
 * Parses markdown syntax and returns React elements.
 */

import React from 'react';

interface ParsedBlock {
  type: 'h2' | 'h3' | 'p' | 'blockquote' | 'code' | 'list' | 'listItem';
  content: string;
  items?: string[];
}

/**
 * Parse markdown content into structured blocks
 */
export function parseMarkdownToBlocks(markdown: string): ParsedBlock[] {
  const lines = markdown.trim().split('\n');
  const blocks: ParsedBlock[] = [];
  let currentList: string[] = [];
  let inCodeBlock = false;
  let codeContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', content: codeContent.trim() });
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }

    // Flush current list if we hit a non-list item
    if (!line.match(/^[-\d]/) && currentList.length > 0) {
      blocks.push({ type: 'list', content: '', items: [...currentList] });
      currentList = [];
    }

    // H2 headers
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', content: line.slice(3) });
      continue;
    }

    // H3 headers
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.slice(4) });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push({ type: 'blockquote', content: line.slice(2) });
      continue;
    }

    // List items (unordered)
    if (line.match(/^- /)) {
      currentList.push(line.slice(2));
      continue;
    }

    // List items (ordered)
    if (line.match(/^\d+\. /)) {
      currentList.push(line.replace(/^\d+\. /, ''));
      continue;
    }

    // Regular paragraph (skip empty lines)
    if (line.trim()) {
      blocks.push({ type: 'p', content: line });
    }
  }

  // Flush remaining list
  if (currentList.length > 0) {
    blocks.push({ type: 'list', content: '', items: [...currentList] });
  }

  return blocks;
}

/**
 * Parse inline markdown (bold, code, etc.) and return text segments
 */
export interface TextSegment {
  text: string;
  bold?: boolean;
  code?: boolean;
}

export function parseInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      segments.push({ text: boldMatch[1], bold: true });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      segments.push({ text: codeMatch[1], code: true });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Find next special character
    const nextBold = remaining.indexOf('**');
    const nextCode = remaining.indexOf('`');
    
    let endIndex = remaining.length;
    if (nextBold > 0) endIndex = Math.min(endIndex, nextBold);
    if (nextCode > 0) endIndex = Math.min(endIndex, nextCode);

    if (endIndex > 0) {
      segments.push({ text: remaining.slice(0, endIndex) });
      remaining = remaining.slice(endIndex);
    } else if (remaining.length > 0) {
      // Skip unmatched special chars
      segments.push({ text: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  return segments;
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
}
