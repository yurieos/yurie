'use client';

import { memo, useMemo, useDeferredValue } from 'react';

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ 
  content, 
  streaming = false 
}: MarkdownRendererProps) {
  // Defer updates during rapid streaming
  const deferredContent = useDeferredValue(content);

  const parsedHtml = useMemo(() => {
    if (!deferredContent) return '';
    
    let text = deferredContent;
    
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // ============================================
    // PREPROCESSING: Convert common patterns to proper markdown
    // ============================================
    
    // "Title Something" at start of line -> # Something
    text = text.replace(/^Title\s+(.+)$/gm, '# $1');
    
    // "Abstract (lead answer) Content" -> ## Abstract\n\nContent
    text = text.replace(/^Abstract\s*\(lead answer\)\s*(.*)$/gm, '## Abstract\n\n$1');
    
    // Standalone section headers
    text = text.replace(/^(Abstract|Introduction|Background|Methodology|Methods|Results|Discussion|Conclusion|Conclusions|Summary|References)$/gm, '## $1');
    
    // Numbered sections: "1. Introduction" or "1.1 Background"
    text = text.replace(/^(\d+\.(?:\d+\.)*)\s+([A-Z][^\n]+)$/gm, '### $1 $2');
    
    // ============================================
    // PROTECT: Code blocks and inline code first
    // ============================================
    
    const blocks: Record<string, string> = {};
    const protect = (html: string): string => {
      const id = `__BLOCK_${Math.random().toString(36).substr(2, 9)}__`;
      blocks[id] = html;
      return id;
    };
    
    // Code blocks
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const langLabel = lang ? `<div class="text-xs text-muted-foreground mb-2 font-mono uppercase">${lang}</div>` : '';
      return protect(`<pre class="bg-secondary p-4 rounded-lg overflow-x-auto my-4 text-sm border border-border/50">${langLabel}<code class="font-mono">${escapeHtml(code.trim())}</code></pre>`);
    });
    
    // Inline code
    text = text.replace(/`([^`]+)`/g, (_, code) => {
      return protect(`<code class="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono">${escapeHtml(code)}</code>`);
    });
    
    // ============================================
    // PARSE: Markdown elements
    // ============================================
    
    // Links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80 underline decoration-primary/30 underline-offset-2">$1</a>');
    
    // Citations [1], [2,3], etc.
    text = text.replace(/\[(\d+(?:,\s*\d+)*)\]/g, 
      '<sup class="citation text-primary hover:text-primary/80 cursor-pointer font-medium text-xs">[$1]</sup>');
    
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
    
    // Strikethrough
    text = text.replace(/~~(.+?)~~/g, '<del class="line-through opacity-70">$1</del>');
    
    // Headers (must process in order: h4 -> h3 -> h2 -> h1)
    text = text.replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold mt-6 mb-3 text-foreground">$1</h4>');
    text = text.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-8 mb-3 text-foreground">$1</h3>');
    text = text.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-10 mb-4 text-foreground">$1</h2>');
    text = text.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-5 text-foreground">$1</h1>');
    
    // Horizontal rule - only when explicitly used
    text = text.replace(/^---$/gm, '<hr class="my-6 border-t border-border/30" />');
    
    // Blockquotes
    text = text.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary pl-4 py-1 my-4 italic text-muted-foreground">$1</blockquote>');
    
    // ============================================
    // PARSE: Lists (complex handling)
    // ============================================
    
    const lines = text.split('\n');
    const processedLines: string[] = [];
    let inList = false;
    let listType = 'ul';
    let listDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
      const numberMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      
      if (bulletMatch) {
        const indent = bulletMatch[1].length;
        const content = bulletMatch[2];
        
        if (!inList) {
          processedLines.push('<ul class="my-4 space-y-2">');
          inList = true;
          listType = 'ul';
          listDepth = indent;
        }
        processedLines.push(`<li class="ml-6 list-disc leading-relaxed">${content}</li>`);
      } else if (numberMatch) {
        const indent = numberMatch[1].length;
        const content = numberMatch[3];
        
        if (!inList) {
          processedLines.push('<ol class="my-4 space-y-2">');
          inList = true;
          listType = 'ol';
          listDepth = indent;
        }
        processedLines.push(`<li class="ml-6 list-decimal leading-relaxed">${content}</li>`);
      } else {
        // End list if we hit a non-list line
        if (inList && line.trim() === '') {
          processedLines.push(`</${listType}>`);
          inList = false;
        }
        processedLines.push(line);
      }
    }
    
    // Close any open list
    if (inList) {
      processedLines.push(`</${listType}>`);
    }
    
    text = processedLines.join('\n');
    
    // ============================================
    // PARSE: Paragraphs
    // ============================================
    
    // Split by double newlines for paragraphs
    text = text.split(/\n\n+/).map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      
      // Don't wrap if already an HTML element
      if (trimmed.match(/^<(h[1-6]|ul|ol|pre|blockquote|hr|div|table)/)) {
        return trimmed;
      }
      
      // Check if paragraph starts with a number followed by bold text (pseudo-header)
      // e.g., "1. **Title**:" or "2. <strong>Title</strong>"
      const isNumberedBold = /^\d+\.\s*(<strong|<b|\*\*)/.test(trimmed);
      
      // Add extra top margin for numbered bold paragraphs (pseudo-headers)
      if (isNumberedBold) {
        return `<p class="mb-4 mt-6 leading-relaxed">${trimmed.replace(/\n/g, ' ')}</p>`;
      }
      
      // Wrap in paragraph
      return `<p class="mb-4 leading-relaxed">${trimmed.replace(/\n/g, ' ')}</p>`;
    }).join('\n');
    
    // ============================================
    // RESTORE: Protected blocks
    // ============================================
    
    Object.keys(blocks).forEach(id => {
      text = text.split(id).join(blocks[id]);
    });
    
    // Clean up empty paragraphs
    text = text.replace(/<p class="[^"]*"><\/p>/g, '');
    
    return text;
  }, [deferredContent]);

  // Safety check
  if (deferredContent.length > 100000) {
    return (
      <div className="p-4 bg-muted/30 rounded text-muted-foreground">
        Content too long to render ({Math.round(deferredContent.length / 1024)}KB)
      </div>
    );
  }

  return (
    <div className="text-foreground">
      <div 
        dangerouslySetInnerHTML={{ __html: parsedHtml }} 
        className="markdown-content leading-[1.75] tracking-[0.01em] text-[1.0625rem]"
      />
      {streaming && (
        <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-0.5 align-text-bottom rounded-sm" />
      )}
    </div>
  );
});

// Helper to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
