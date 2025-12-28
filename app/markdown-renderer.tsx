'use client';

import { memo } from 'react';
import katex from 'katex';

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ 
  content, 
  streaming = false 
}: MarkdownRendererProps) {
  // Simple markdown parsing
  const parseMarkdown = (text: string) => {
    try {
      // Safety check for extremely long content to avoid regex stack overflow
      if (text.length > 50000) {
        return `<div class="p-4 bg-muted/30 rounded text-muted-foreground">Content too long to render preview (${Math.round(text.length / 1024)}KB)</div>`;
      }

      const blocks: Record<string, string> = {};
    const protect = (content: string) => {
      const id = `__BLOCK_${Math.random().toString(36).substr(2, 9)}__`;
      blocks[id] = content;
      return id;
    };

    // Normalize line endings (CRLF -> LF)
    let parsed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Protect Code Blocks
    parsed = parsed.replace(/```([^\n]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang ? lang.trim() : '';
      const langLabel = language 
        ? `<div class="flex justify-between items-center mb-2 select-none"><span class="text-xs text-muted-foreground font-mono uppercase">${language}</span></div>` 
        : '';
      return protect(`<pre class="bg-secondary p-3 rounded-lg overflow-x-auto my-3 text-sm">${langLabel}<code>${code}</code></pre>`);
    });

    // 2. Protect Inline Code
    parsed = parsed.replace(/`([^`]+)`/g, (match, code) => {
      return protect(`<code class="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono text-secondary-foreground">${code}</code>`);
    });

    // 3. Protect/Render Math
    const renderMath = (math: string, displayMode: boolean, originalMatch: string) => {
      try {
        const html = katex.renderToString(math.trim(), { 
          displayMode, 
          throwOnError: false,
          strict: false,
          trust: true,
          macros: {
            // Common macros not natively supported by KaTeX
            "\\splitfrac": "\\genfrac{}{}{0pt}{}{#1}{#2}",
            "\\R": "\\mathbb{R}",
            "\\N": "\\mathbb{N}",
            "\\Z": "\\mathbb{Z}",
            "\\C": "\\mathbb{C}",
            "\\Q": "\\mathbb{Q}",
            "\\eps": "\\varepsilon",
            "\\phi": "\\varphi",
            "\\d": "\\mathrm{d}",
            "\\grad": "\\nabla",
            "\\div": "\\nabla \\cdot",
            "\\curl": "\\nabla \\times",
            "\\argmax": "\\operatorname{arg\\,max}",
            "\\argmin": "\\operatorname{arg\\,min}",
          }
        });
        return protect(html);
      } catch {
        // Return styled fallback for failed math
        const fallbackClass = displayMode 
          ? 'block text-center my-4 p-2 bg-secondary rounded font-mono text-sm' 
          : 'bg-secondary px-1 rounded font-mono text-sm';
        return protect(`<span class="${fallbackClass}">${originalMatch}</span>`);
      }
    };

    // Block Math $$...$$ (with optional whitespace)
    parsed = parsed.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (match, math) => renderMath(math, true, match));
    
    // Block Math \[...\] (with optional whitespace)
    parsed = parsed.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, math) => renderMath(math, true, match));

    // Inline Math \(...\) (with optional whitespace)
    parsed = parsed.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (match, math) => renderMath(math, false, match));

    // Inline Math $...$ - more permissive pattern (single $ not preceded/followed by $)
    parsed = parsed.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, math) => renderMath(math, false, match));

    // 4. Links & Citations
    parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80 underline decoration-primary/30 underline-offset-4 transition-colors">$1</a>');
    parsed = parsed.replace(/\[(\d+)\]/g, '<sup class="citation text-primary hover:text-primary/80 cursor-pointer font-medium select-none transition-colors">[$1]</sup>');
    
    // 5. Basic Formatting
    // Bold: requires non-whitespace after opening and before closing **
    parsed = parsed.replace(/\*\*(?=\S)((?:[^*]|\*(?!\*))+?)(?<=\S)\*\*/g, '<strong class="font-semibold">$1</strong>');
    // Italic: requires non-whitespace after opening and before closing *, and not adjacent to other *
    parsed = parsed.replace(/(?<!\*)\*(?!\*)(?=\S)((?:[^*])+?)(?<=\S)\*(?!\*)/g, '<em>$1</em>');
    // Strikethrough
    parsed = parsed.replace(/~~(.+?)~~/g, '<del class="line-through opacity-70">$1</del>');
    
    // Clean up orphaned markdown symbols (unmatched ** or * at word boundaries)
    // Remove orphaned ** that didn't get matched (typically at start of unfinished bold)
    parsed = parsed.replace(/\*\*(?=\S)/g, '');
    // Remove orphaned * that didn't get matched (typically at start of unfinished italic)
    parsed = parsed.replace(/(?<!\*)\*(?!\*)(?=\S)/g, '');
    
    // 6. Blockquotes
    parsed = parsed.replace(/^> (.+)$/gm, '<blockquote class="border-l-3 border-primary pl-5 py-1 my-6 italic text-muted-foreground leading-relaxed">$1</blockquote>');
    
    // 7. Headers - allow optional leading whitespace
    parsed = parsed.replace(/^\s*#### (.+)$/gm, '<h4 class="text-base font-heading font-semibold mt-6 mb-3 tracking-tight leading-snug">$1</h4>');
    parsed = parsed.replace(/^\s*### (.+)$/gm, '<h3 class="text-lg font-heading font-semibold mt-8 mb-4 tracking-tight leading-snug">$1</h3>');
    parsed = parsed.replace(/^\s*## (.+)$/gm, '<h2 class="text-xl font-heading font-semibold mt-10 mb-4 tracking-tight leading-snug">$1</h2>');
    parsed = parsed.replace(/^\s*# (.+)$/gm, '<h1 class="text-2xl font-heading font-bold mt-10 mb-5 tracking-tight leading-snug">$1</h1>');
    
    // 8. HR
    parsed = parsed.replace(/^---$/gm, '<hr class="my-10 border-border" />');

    // 9. Handle list blocks and tables
    const listBlocks = parsed.split('\n');
    let inList = false;
    let listType = 'ul';
    let inTable = false;
    let tableAlignments: string[] = [];
    
    const processedLines = [];
    
    for (let i = 0; i < listBlocks.length; i++) {
      const line = listBlocks[i];
      
      // Table detection
      const tableRowMatch = line.trim().match(/^\|(.+)\|$/);
      
      if (tableRowMatch && !inList) {
        if (!inTable) {
          // Check if next line is a separator to confirm it's a table header
          if (i + 1 < listBlocks.length) {
            const nextLine = listBlocks[i + 1].trim();
            // Separator must look like |---|---| or |:---|---:| etc
            const separatorMatch = nextLine.match(/^\|([-:| ]+)\|$/);
            
            if (separatorMatch) {
              inTable = true;
              const headerCells = tableRowMatch[1].split('|');
              const separators = separatorMatch[1].split('|');
              
              // Determine alignments
              tableAlignments = separators.map(s => {
                s = s.trim();
                if (s.startsWith(':') && s.endsWith(':')) return 'center';
                if (s.endsWith(':')) return 'right';
                return 'left';
              });
              
              processedLines.push('<div class="overflow-x-auto my-4 rounded-lg border border-border"><table class="min-w-full divide-y divide-border text-sm">');
              processedLines.push('<thead class="bg-secondary"><tr>');
              
              headerCells.forEach((cell, idx) => {
                const align = tableAlignments[idx] || 'left';
                processedLines.push(`<th class="px-3 py-2 text-${align} font-semibold text-secondary-foreground">${cell.trim()}</th>`);
              });
              
              processedLines.push('</tr></thead><tbody class="divide-y divide-border bg-card">');
              
              // Skip the separator line
              i++; 
              continue;
            }
          }
        } else {
          // We are in a table and this is a row
          const cells = tableRowMatch[1].split('|');
          processedLines.push('<tr>');
          cells.forEach((cell, idx) => {
            const align = tableAlignments[idx] || 'left';
            processedLines.push(`<td class="px-3 py-2 text-${align} text-card-foreground">${cell.trim()}</td>`);
          });
          processedLines.push('</tr>');
          continue;
        }
      }
      
      // If we were in a table but this line is not a row
      if (inTable && !tableRowMatch) {
        inTable = false;
        processedLines.push('</tbody></table></div>');
      }

      const bulletMatch = line.match(/^- (.+)$/);
      const numberMatch = line.match(/^(\d+)\. (.+)$/);
      const isListItem = bulletMatch || numberMatch;
      const isContinuation = inList && line.match(/^\s+/) && line.trim();
      
      if (isListItem && !inList) {
        listType = bulletMatch ? 'ul' : 'ol';
        processedLines.push(`<${listType} class="space-y-3 my-6 pl-0">`);
        inList = true;
      } else if (!isListItem && !isContinuation && inList && line.trim() === '') {
        // Empty line ends the list
        processedLines.push(`</${listType}>`);
        inList = false;
      }
      
      if (bulletMatch) {
        processedLines.push(`<li class="ml-6 list-disc leading-relaxed">${bulletMatch[1]}</li>`);
      } else if (numberMatch) {
        processedLines.push(`<li class="ml-6 list-decimal leading-relaxed">${numberMatch[2]}</li>`);
      } else if (isContinuation && inList) {
        // Append continuation to previous list item
        if (processedLines.length > 0 && processedLines[processedLines.length - 1].includes('<li')) {
          const lastLine = processedLines.pop();
          if (lastLine) {
            processedLines.push(lastLine.replace('</li>', ' ' + line.trim() + '</li>'));
          }
        }
      } else {
        processedLines.push(line);
      }
    }
    
    if (inList) {
      processedLines.push(`</${listType}>`);
    }
    if (inTable) {
      processedLines.push('</tbody></table></div>');
    }
    
    parsed = processedLines.join('\n');
    
    // 10. Restore Blocks
    Object.keys(blocks).forEach(id => {
       parsed = parsed.split(id).join(blocks[id]);
    });
    
    // 11. Paragraphs
    parsed = parsed.split('\n\n').map(para => {
      if (para.trim() && 
          !para.includes('<h') && 
          !para.includes('<ul') && 
          !para.includes('<ol') && 
          !para.includes('<pre') && 
          !para.includes('<div') && 
          !para.includes('<table') && 
          !para.includes('<blockquote') &&
          !para.includes('<hr') &&
          !para.includes('katex-display')) {
        return `<p class="mb-5 leading-relaxed">${para}</p>`;
      }
      return para;
    }).join('\n');
    
    // Clean up
    parsed = parsed.replace(/<p class="mb-3"><\/p>/g, '');
    parsed = parsed.replace(/\n/g, ' ');
    
    return parsed;
    } catch (e) {
      console.error('Markdown parsing failed:', e);
      return `<div class="whitespace-pre-wrap font-mono text-sm overflow-x-auto">${text}</div>`;
    }
  };

  return (
    <div className="text-foreground text-base">
      <div 
        dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} 
        className="markdown-content leading-[1.8] tracking-[0.01em] [&>h1]:text-foreground [&>h2]:text-foreground [&>h3]:text-foreground [&>h4]:text-foreground [&>p]:text-[1.05rem] [&>li]:text-[1.05rem]"
      />
      {streaming && <span className="animate-pulse text-primary">▊</span>}
    </div>
  );
});
