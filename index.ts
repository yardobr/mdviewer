/**
 * Interactive Markdown Parser and Renderer in TypeScript
 */

// TypeScript interfaces and types
interface ParsedToken {
  type: string;
  content: string;
  raw: string;
  depth?: number;
  href?: string;
  alt?: string;
  lang?: string;
  ordered?: boolean;
  items?: string[];
}

interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
}

interface RenderOptions {
  generateTOC: boolean;
  syntaxHighlight: boolean;
  externalLinksNewTab: boolean;
  enableCollapsibleSections: boolean;
}

class MarkdownParser {
  private content: string = '';
  private parsedTokens: ParsedToken[] = [];
  private tocItems: TableOfContentsItem[] = [];
  private options: RenderOptions = {
    generateTOC: true,
    syntaxHighlight: true,
    externalLinksNewTab: true,
    enableCollapsibleSections: true
  };

  // Regular expressions for parsing
  private static HEADING_REGEX = /^(#{1,6})\s+(.+)/;
  private static BOLD_REGEX = /\*\*(.+?)\*\*/g;
  private static ITALIC_REGEX = /\*(.+?)\*/g;
  private static LINK_REGEX = /\[(.+?)\]\((.+?)\)/g;
  private static IMAGE_REGEX = /!\[(.+?)\]\((.+?)\)/g;
  private static INLINE_CODE_REGEX = /`(.+?)`/g;
  private static BLOCKQUOTE_REGEX = /^>\s+(.+)/;
  private static HORIZONTAL_RULE_REGEX = /^-{3,}/;
  private static UNORDERED_LIST_ITEM_REGEX = /^[-*+]\s+(.+)/;
  private static ORDERED_LIST_ITEM_REGEX = /^(\d+)\.\s+(.+)/;
  private static FENCED_CODE_BLOCK_START_REGEX = /^```(\w*)/;
  private static FENCED_CODE_BLOCK_END_REGEX = /^```$/;
  private static COLLAPSE_START_REGEX = /<!-- collapse -->/g;
  private static COLLAPSE_END_REGEX = /<!-- \/collapse -->/g;

  constructor(options?: Partial<RenderOptions>) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Set up event listener for markdown input
    const markdownInput = document.getElementById('markdown-input') as HTMLTextAreaElement;
    if (markdownInput) {
      markdownInput.addEventListener('input', this.handleInputChange.bind(this));
    }

    // Set up event listener for toggle TOC
    const tocToggle = document.getElementById('toc-toggle');
    if (tocToggle) {
      tocToggle.addEventListener('click', this.toggleTOC.bind(this));
    }

    // Initial render if there's content
    if (markdownInput && markdownInput.value) {
      this.parseAndRender(markdownInput.value);
    }

    // Set up click delegation for copy buttons and image expansion
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Handle copy code button
      if (target.classList.contains('copy-button')) {
        const codeBlock = target.nextElementSibling as HTMLElement;
        if (codeBlock) {
          this.copyToClipboard(codeBlock.textContent || '');
          target.textContent = 'Copied!';
          setTimeout(() => {
            target.textContent = 'Copy';
          }, 2000);
        }
      }
      
      // Handle image expansion
      if (target.tagName === 'IMG' && target.classList.contains('md-image')) {
        target.classList.toggle('expanded');
      }
    });
  }

  private handleInputChange(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.parseAndRender(input.value);
  }

  private toggleTOC(): void {
    const tocContainer = document.getElementById('toc-container');
    if (tocContainer) {
      tocContainer.classList.toggle('collapsed');
    }
  }

  private parseAndRender(markdown: string): void {
    this.content = markdown;
    this.parsedTokens = [];
    this.tocItems = [];
    
    this.parse();
    this.render();
  }

  private parse(): void {
    const lines = this.content.split('\n');
    let lineIndex = 0;
    let inFencedCodeBlock = false;
    let currentCodeBlock: ParsedToken | null = null;
    let inList = false;
    let currentList: ParsedToken | null = null;
    let currentListItems: string[] = [];
    let isOrderedList = false;

    while (lineIndex < lines.length) {
      let line = lines[lineIndex];
      
      // Handle fenced code blocks
      if (MarkdownParser.FENCED_CODE_BLOCK_START_REGEX.test(line) && !inFencedCodeBlock) {
        inFencedCodeBlock = true;
        const langMatch = line.match(MarkdownParser.FENCED_CODE_BLOCK_START_REGEX);
        currentCodeBlock = {
          type: 'fenced-code',
          content: '',
          raw: line,
          lang: langMatch ? langMatch[1] : ''
        };
        lineIndex++;
        continue;
      }
      
      if (MarkdownParser.FENCED_CODE_BLOCK_END_REGEX.test(line) && inFencedCodeBlock) {
        inFencedCodeBlock = false;
        if (currentCodeBlock) {
          this.parsedTokens.push(currentCodeBlock);
          currentCodeBlock = null;
        }
        lineIndex++;
        continue;
      }
      
      if (inFencedCodeBlock) {
        if (currentCodeBlock) {
          currentCodeBlock.content += line + '\n';
          currentCodeBlock.raw += '\n' + line;
        }
        lineIndex++;
        continue;
      }
      
      // Handle list items
      const ulMatch = line.match(MarkdownParser.UNORDERED_LIST_ITEM_REGEX);
      const olMatch = line.match(MarkdownParser.ORDERED_LIST_ITEM_REGEX);
      
      if (ulMatch || olMatch) {
        if (!inList) {
          inList = true;
          isOrderedList = !!olMatch;
          currentListItems = [];
          currentList = {
            type: 'list',
            content: '',
            raw: line,
            ordered: isOrderedList,
            items: currentListItems
          };
        }
        
        currentListItems.push(ulMatch ? ulMatch[1] : (olMatch ? olMatch[2] : ''));
        lineIndex++;
        continue;
      } else if (inList && line.trim() === '') {
        inList = false;
        if (currentList) {
          this.parsedTokens.push(currentList);
          currentList = null;
        }
        lineIndex++;
        continue;
      } else if (inList) {
        // Check if this is a continuation of the previous list item (indented)
        if (line.startsWith('  ') && currentListItems.length > 0) {
          const lastIndex = currentListItems.length - 1;
          currentListItems[lastIndex] += '\n' + line.trim();
          lineIndex++;
          continue;
        } else {
          inList = false;
          if (currentList) {
            this.parsedTokens.push(currentList);
            currentList = null;
          }
          // Don't increment lineIndex here, process this line again
        }
      }
      
      // Skip empty lines
      if (line.trim() === '') {
        lineIndex++;
        continue;
      }
      
      // Parse headings
      const headingMatch = line.match(MarkdownParser.HEADING_REGEX);
      if (headingMatch) {
        const depth = headingMatch[1].length;
        const content = headingMatch[2].trim();
        const headingId = this.generateHeadingId(content);
        
        this.parsedTokens.push({
          type: 'heading',
          content,
          raw: line,
          depth
        });
        
        if (this.options.generateTOC) {
          this.tocItems.push({
            id: headingId,
            text: content,
            level: depth
          });
        }
        
        lineIndex++;
        continue;
      }
      
      // Parse blockquotes
      const blockquoteMatch = line.match(MarkdownParser.BLOCKQUOTE_REGEX);
      if (blockquoteMatch) {
        this.parsedTokens.push({
          type: 'blockquote',
          content: blockquoteMatch[1],
          raw: line
        });
        lineIndex++;
        continue;
      }
      
      // Parse horizontal rules
      if (MarkdownParser.HORIZONTAL_RULE_REGEX.test(line)) {
        this.parsedTokens.push({
          type: 'hr',
          content: '',
          raw: line
        });
        lineIndex++;
        continue;
      }
      
      // Treat as paragraph
      this.parsedTokens.push({
        type: 'paragraph',
        content: line,
        raw: line
      });
      
      lineIndex++;
    }
    
    // If a list is still active at the end of the document
    if (inList && currentList) {
      this.parsedTokens.push(currentList);
    }
  }

  private render(): void {
    const outputElement = document.getElementById('markdown-output');
    const tocElement = document.getElementById('toc-content');
    
    if (!outputElement || !tocElement) {
      console.error('Output or TOC elements not found');
      return;
    }
    
    // Generate TOC
    if (this.options.generateTOC && this.tocItems.length > 0) {
      let tocHtml = '<ul>';
      for (const item of this.tocItems) {
        const indentClass = `toc-level-${item.level}`;
        tocHtml += `<li class="${indentClass}"><a href="#${item.id}">${item.text}</a></li>`;
      }
      tocHtml += '</ul>';
      tocElement.innerHTML = tocHtml;
    } else {
      tocElement.innerHTML = '<p>No headings found</p>';
    }
    
    // Generate content HTML
    let html = '';
    
    for (const token of this.parsedTokens) {
      switch (token.type) {
        case 'heading':
          const headingLevel = token.depth || 1;
          const headingId = this.generateHeadingId(token.content);
          html += `<h${headingLevel} id="${headingId}">${this.renderInlineElements(token.content)}</h${headingLevel}>`;
          break;
          
        case 'paragraph':
          html += `<p>${this.renderInlineElements(token.content)}</p>`;
          break;
          
        case 'blockquote':
          html += `<blockquote>${this.renderInlineElements(token.content)}</blockquote>`;
          break;
          
        case 'hr':
          html += '<hr>';
          break;
          
        case 'list':
          const listTag = token.ordered ? 'ol' : 'ul';
          html += `<${listTag}>`;
          if (token.items) {
            for (const item of token.items) {
              html += `<li>${this.renderInlineElements(item)}</li>`;
            }
          }
          html += `</${listTag}>`;
          break;
          
        case 'fenced-code':
          const language = token.lang || '';
          const codeContent = this.escapeHtml(token.content);
          const highlightedCode = this.options.syntaxHighlight ? 
            this.highlightSyntax(codeContent, language) : codeContent;
          
          html += `<div class="code-block-wrapper">`;
          html += `<button class="copy-button">Copy</button>`;
          html += `<pre><code class="language-${language}">${highlightedCode}</code></pre>`;
          html += `</div>`;
          break;
      }
    }
    
    // Handle collapsible sections
    if (this.options.enableCollapsibleSections) {
      html = html.replace(
        MarkdownParser.COLLAPSE_START_REGEX, 
        '<details><summary>Show/Hide</summary>'
      ).replace(
        MarkdownParser.COLLAPSE_END_REGEX, 
        '</details>'
      );
    }
    
    outputElement.innerHTML = html;
  }

  private renderInlineElements(text: string): string {
    // Process images first (to avoid conflict with links)
    text = text.replace(MarkdownParser.IMAGE_REGEX, (match, alt, src) => {
      return `<img src="${src}" alt="${alt}" class="md-image" title="${alt}">`;
    });
    
    // Process links
    text = text.replace(MarkdownParser.LINK_REGEX, (match, linkText, url) => {
      const target = this.options.externalLinksNewTab && this.isExternalUrl(url) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${url}"${target}>${linkText}</a>`;
    });
    
    // Process bold text
    text = text.replace(MarkdownParser.BOLD_REGEX, '<strong>$1</strong>');
    
    // Process italic text
    text = text.replace(MarkdownParser.ITALIC_REGEX, '<em>$1</em>');
    
    // Process inline code
    text = text.replace(MarkdownParser.INLINE_CODE_REGEX, '<code>$1</code>');
    
    return text;
  }

  private generateHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private highlightSyntax(code: string, language: string): string {
    // Simple syntax highlighting for common languages
    // In a real implementation, this would be more extensive
    
    if (!language) return code;
    
    // Common programming keywords
    const keywords = [
      'function', 'const', 'let', 'var', 'if', 'else', 'return', 'for', 'while', 
      'class', 'interface', 'import', 'export', 'from', 'extends', 'implements',
      'public', 'private', 'protected', 'static', 'new', 'this', 'super', 'try',
      'catch', 'finally', 'throw', 'async', 'await'
    ];
    
    const builtins = [
      'console', 'document', 'window', 'Math', 'Date', 'Array', 'Object', 
      'String', 'Number', 'Boolean', 'Map', 'Set', 'Promise', 'JSON', 'RegExp'
    ];
    
    // Highlight keywords
    let highlighted = code;
    
    // Highlight strings
    highlighted = highlighted.replace(
      /(["'`])(?:(?=(\\?))\2.)*?\1/g, 
      '<span class="syntax-string">$&</span>'
    );
    
    // Highlight comments (single line)
    highlighted = highlighted.replace(
      /\/\/.*$/gm, 
      '<span class="syntax-comment">$&</span>'
    );
    
    // Highlight multi-line comments
    highlighted = highlighted.replace(
      /\/\*[\s\S]*?\*\//g, 
      '<span class="syntax-comment">$&</span>'
    );
    
    // Highlight keywords
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      highlighted = highlighted.replace(
        regex, 
        '<span class="syntax-keyword">$&</span>'
      );
    }
    
    // Highlight built-in objects
    for (const builtin of builtins) {
      const regex = new RegExp(`\\b${builtin}\\b`, 'g');
      highlighted = highlighted.replace(
        regex, 
        '<span class="syntax-builtin">$&</span>'
      );
    }
    
    // Highlight numbers
    highlighted = highlighted.replace(
      /\b\d+(\.\d+)?\b/g, 
      '<span class="syntax-number">$&</span>'
    );
    
    return highlighted;
  }

  private isExternalUrl(url: string): boolean {
    // Consider it external if it starts with http:// or https:// or // 
    return /^(https?:)?\/\//i.test(url);
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }

  // Public method to set options
  public setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Re-render if we have content
    if (this.content) {
      this.parseAndRender(this.content);
    }
  }
}

// Initialize the parser when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const parser = new MarkdownParser();
  
  // Handle options changes
  const optionsForm = document.getElementById('options-form');
  if (optionsForm) {
    optionsForm.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const options: Partial<RenderOptions> = {};
      
      if (target.name === 'generateTOC') {
        options.generateTOC = target.checked;
      } else if (target.name === 'syntaxHighlight') {
        options.syntaxHighlight = target.checked;
      } else if (target.name === 'externalLinksNewTab') {
        options.externalLinksNewTab = target.checked;
      } else if (target.name === 'enableCollapsibleSections') {
        options.enableCollapsibleSections = target.checked;
      }
      
      parser.setOptions(options);
    });
  }
  
  // Populate with example markdown if textarea is empty
  const markdownInput = document.getElementById('markdown-input') as HTMLTextAreaElement;
  if (markdownInput && !markdownInput.value) {
    markdownInput.value = `# Interactive Markdown Parser
## Features

This **interactive markdown parser** supports:

* *Italics* and **bold** text
* [Links](https://example.com)
* Ordered and unordered lists
* Code blocks:

\`\`\`typescript
function sayHello(): void {
  console.log("Hello, World!");
}
\`\`\`

## Collapsible Section Example
<!-- collapse -->
This section is collapsible!

1. First item
2. Second item
3. Third item
<!-- /collapse -->

> This is a blockquote that you can use for important notes.

---

![Sample Image](https://via.placeholder.com/150)
`;
    // Trigger input event to render the example
    markdownInput.dispatchEvent(new Event('input'));
  }
});
