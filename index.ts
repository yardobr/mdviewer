// Define interfaces for our Markdown parser and renderer
interface MarkdownNode {
  type: string;
  content?: string;
  level?: number;
  url?: string;
  alt?: string;
  children?: MarkdownNode[];
  language?: string;
  ordered?: boolean;
}

// Parser class to convert Markdown text to an Abstract Syntax Tree (AST)
class MarkdownParser {
  private text: string;
  private position: number = 0;
  private length: number;
  private headings: MarkdownNode[] = [];

  constructor(text: string) {
    this.text = text;
    this.length = text.length;
  }

  // Main parsing method
  parse(): { ast: MarkdownNode[], headings: MarkdownNode[] } {
    const ast: MarkdownNode[] = [];
    this.position = 0;
    this.headings = [];

    while (this.position < this.length) {
      const node = this.parseBlock();
      if (node) {
        ast.push(node);
      }
    }

    return { ast, headings: this.headings };
  }

  // Parse a block-level element
  private parseBlock(): MarkdownNode | null {
    // Skip empty lines
    this.skipEmptyLines();
    
    if (this.position >= this.length) {
      return null;
    }

    // Check for different block types
    const char = this.text[this.position];
    
    // Headings
    if (char === '#') {
      return this.parseHeading();
    }
    
    // Horizontal rule
    if (this.isHorizontalRule()) {
      return this.parseHorizontalRule();
    }
    
    // Blockquote
    if (char === '>') {
      return this.parseBlockquote();
    }
    
    // Code block
    if (this.text.substring(this.position, this.position + 3) === '```') {
      return this.parseCodeBlock();
    }
    
    // Lists
    if ((char === '-' || char === '*' || char === '+') && 
        (this.position + 1 < this.length && this.isWhitespace(this.text[this.position + 1]))) {
      return this.parseList(false);
    }
    
    if (char >= '0' && char <= '9') {
      let pos = this.position + 1;
      // Look for the pattern: digit+ followed by . and space
      while (pos < this.length && this.text[pos] >= '0' && this.text[pos] <= '9') {
        pos++;
      }
      if (pos < this.length && this.text[pos] === '.' && 
          (pos + 1 < this.length && this.isWhitespace(this.text[pos + 1]))) {
        return this.parseList(true);
      }
    }
    
    // Default: paragraph
    return this.parseParagraph();
  }

  // Helper methods for parsing specific elements
  private parseHeading(): MarkdownNode {
    let level = 0;
    const start = this.position;
    
    // Count # symbols
    while (this.position < this.length && this.text[this.position] === '#') {
      level++;
      this.position++;
    }
    
    // Limit to h6
    level = Math.min(level, 6);
    
    // Skip whitespace
    this.skipWhitespace();
    
    // Read until end of line
    const contentStart = this.position;
    while (this.position < this.length && this.text[this.position] !== '\n') {
      this.position++;
    }
    
    const content = this.text.substring(contentStart, this.position).trim();
    this.position++; // Skip newline
    
    const heading: MarkdownNode = {
      type: 'heading',
      level,
      content,
      children: this.parseInline(content)
    };
    
    // Store heading for table of contents
    this.headings.push(heading);
    
    return heading;
  }

  private parseHorizontalRule(): MarkdownNode {
    // Match --- or *** or ___
    const pattern = this.text[this.position];
    let count = 0;
    
    while (this.position < this.length && this.text[this.position] === pattern) {
      count++;
      this.position++;
    }
    
    // Skip to next line
    this.skipUntilNewline();
    this.position++; // Skip newline
    
    return {
      type: 'hr'
    };
  }

  private parseBlockquote(): MarkdownNode {
    const lines: string[] = [];
    
    while (this.position < this.length) {
      // Skip '>' character and whitespace
      if (this.text[this.position] === '>') {
        this.position++;
        this.skipWhitespace();
      }
      
      const lineStart = this.position;
      
      // Read until end of line
      while (this.position < this.length && this.text[this.position] !== '\n') {
        this.position++;
      }
      
      lines.push(this.text.substring(lineStart, this.position));
      
      // Check if next line is an empty line or doesn't start with '>'
      if (this.position + 1 >= this.length || 
          (this.text[this.position] === '\n' && this.text[this.position + 1] !== '>')) {
        this.position++; // Skip newline
        break;
      }
      
      this.position++; // Skip newline
    }
    
    const content = lines.join('\n');
    
    return {
      type: 'blockquote',
      content,
      children: this.parseInline(content)
    };
  }

  private parseCodeBlock(): MarkdownNode {
    // Skip opening ```
    this.position += 3;
    
    // Check for language identifier
    const languageStart = this.position;
    while (this.position < this.length && this.text[this.position] !== '\n') {
      this.position++;
    }
    
    const language = this.text.substring(languageStart, this.position).trim();
    this.position++; // Skip newline
    
    // Read content until closing ```
    const contentStart = this.position;
    while (this.position < this.length) {
      if (this.text.substring(this.position, this.position + 3) === '```' && 
          (this.position === 0 || this.text[this.position - 1] === '\n')) {
        break;
      }
      this.position++;
    }
    
    const content = this.text.substring(contentStart, this.position);
    
    // Skip closing ```
    if (this.position < this.length) {
      this.position += 3;
      // Skip to next line
      if (this.position < this.length && this.text[this.position] !== '\n') {
        this.skipUntilNewline();
      }
      if (this.position < this.length) {
        this.position++; // Skip newline
      }
    }
    
    return {
      type: 'code',
      content: content.trim(),
      language
    };
  }

  private parseList(ordered: boolean): MarkdownNode {
    const items: MarkdownNode[] = [];
    let currentIndent = 0;
    
    while (this.position < this.length) {
      const itemStart = this.position;
      let listMarkerFound = false;
      
      // Calculate indentation
      while (this.position < this.length && this.isWhitespace(this.text[this.position])) {
        this.position++;
      }
      
      const indent = this.position - itemStart;
      
      // First item or same indentation level
      if (items.length === 0 || indent === currentIndent) {
        // Check for list marker
        if (ordered) {
          // Ordered list marker (1. )
          let digits = '';
          while (this.position < this.length && this.text[this.position] >= '0' && this.text[this.position] <= '9') {
            digits += this.text[this.position];
            this.position++;
          }
          
          if (this.position < this.length && this.text[this.position] === '.') {
            this.position++; // Skip .
            this.skipWhitespace();
            listMarkerFound = true;
          }
        } else {
          // Unordered list marker (- or * or +)
          if (this.position < this.length && 
              (this.text[this.position] === '-' || 
               this.text[this.position] === '*' || 
               this.text[this.position] === '+')) {
            this.position++; // Skip marker
            this.skipWhitespace();
            listMarkerFound = true;
          }
        }
        
        if (listMarkerFound) {
          // Read item content until end of line or next list item
          const contentStart = this.position;
          let content = '';
          
          while (this.position < this.length) {
            if (this.text[this.position] === '\n') {
              // Check if next line is a new list item or continuation
              const nextLineStart = this.position + 1;
              let nextLineIndent = 0;
              let pos = nextLineStart;
              
              // Check indentation of next line
              while (pos < this.length && this.isWhitespace(this.text[pos])) {
                pos++;
                nextLineIndent++;
              }
              
              if (pos < this.length) {
                const nextChar = this.text[pos];
                
                // Check if next line is a new list item
                if ((ordered && nextChar >= '0' && nextChar <= '9') ||
                    (!ordered && (nextChar === '-' || nextChar === '*' || nextChar === '+'))) {
                  break;
                }
                
                // Check if next line is an empty line
                if (nextChar === '\n') {
                  break;
                }
              }
            }
            this.position++;
          }
          
          content = this.text.substring(contentStart, this.position).trim();
          
          items.push({
            type: 'list_item',
            content,
            children: this.parseInline(content)
          });
          
          // Skip newline
          if (this.position < this.length && this.text[this.position] === '\n') {
            this.position++;
          }
          
          // If next line is empty, break out of the list
          if (this.position < this.length && this.text[this.position] === '\n') {
            this.position++;
            break;
          }
          
          // Save current indentation level
          currentIndent = indent;
        } else {
          // Not a list item, exit
          break;
        }
      } else {
        // Different indentation level, exit
        break;
      }
    }
    
    return {
      type: 'list',
      ordered,
      children: items
    };
  }

  private parseParagraph(): MarkdownNode {
    const start = this.position;
    
    // Read until empty line or another block element
    while (this.position < this.length) {
      if (this.text[this.position] === '\n') {
        // Check if next line is empty or a different block element
        const nextPos = this.position + 1;
        if (nextPos >= this.length || 
            this.text[nextPos] === '\n' || 
            this.text[nextPos] === '#' || 
            this.text[nextPos] === '>' || 
            this.text.substring(nextPos, nextPos + 3) === '```' ||
            this.text[nextPos] === '-' || 
            this.text[nextPos] === '*' || 
            this.text[nextPos] === '+' ||
            (this.text[nextPos] >= '0' && this.text[nextPos] <= '9' && 
             nextPos + 1 < this.length && this.text[nextPos + 1] === '.')) {
          break;
        }
      }
      this.position++;
    }
    
    const content = this.text.substring(start, this.position).trim();
    
    // Skip newline
    if (this.position < this.length && this.text[this.position] === '\n') {
      this.position++;
    }
    
    return {
      type: 'paragraph',
      content,
      children: this.parseInline(content)
    };
  }

  // Parse inline elements like bold, italic, links, etc.
  private parseInline(text: string): MarkdownNode[] {
    const nodes: MarkdownNode[] = [];
    let pos = 0;
    const len = text.length;
    
    while (pos < len) {
      // Bold
      if (pos + 1 < len && text.substring(pos, pos + 2) === '**') {
        pos += 2; // Skip **
        const start = pos;
        
        while (pos < len && text.substring(pos, pos + 2) !== '**') {
          pos++;
        }
        
        const content = text.substring(start, pos);
        
        if (pos < len) {
          pos += 2; // Skip closing **
        }
        
        nodes.push({
          type: 'bold',
          content
        });
        continue;
      }
      
      // Italic
      if (text[pos] === '*' && (pos === 0 || text[pos-1] !== '*') && (pos + 1 < len && text[pos+1] !== '*')) {
        pos++; // Skip *
        const start = pos;
        
        while (pos < len && text[pos] !== '*') {
          pos++;
        }
        
        const content = text.substring(start, pos);
        
        if (pos < len) {
          pos++; // Skip closing *
        }
        
        nodes.push({
          type: 'italic',
          content
        });
        continue;
      }
      
      // Inline code
      if (text[pos] === '`') {
        pos++; // Skip `
        const start = pos;
        
        while (pos < len && text[pos] !== '`') {
          pos++;
        }
        
        const content = text.substring(start, pos);
        
        if (pos < len) {
          pos++; // Skip closing `
        }
        
        nodes.push({
          type: 'inline_code',
          content
        });
        continue;
      }
      
      // Link
      if (text[pos] === '[') {
        const linkTextStart = pos + 1;
        let nextPos = pos + 1;
        let nestedBrackets = 0;
        
        // Find closing bracket
        while (nextPos < len) {
          if (text[nextPos] === '[') {
            nestedBrackets++;
          } else if (text[nextPos] === ']') {
            if (nestedBrackets === 0) {
              break;
            }
            nestedBrackets--;
          }
          nextPos++;
        }
        
        if (nextPos < len && text[nextPos] === ']' && nextPos + 1 < len && text[nextPos + 1] === '(') {
          const linkText = text.substring(linkTextStart, nextPos);
          
          // Find URL
          const urlStart = nextPos + 2;
          let urlEnd = urlStart;
          
          while (urlEnd < len && text[urlEnd] !== ')') {
            urlEnd++;
          }
          
          if (urlEnd < len) {
            const url = text.substring(urlStart, urlEnd);
            
            nodes.push({
              type: 'link',
              content: linkText,
              url
            });
            
            pos = urlEnd + 1;
            continue;
          }
        }
      }
      
      // Image
      if (pos + 1 < len && text.substring(pos, pos + 2) === '![') {
        const altTextStart = pos + 2;
        let nextPos = pos + 2;
        
        // Find closing bracket
        while (nextPos < len && text[nextPos] !== ']') {
          nextPos++;
        }
        
        if (nextPos < len && text[nextPos] === ']' && nextPos + 1 < len && text[nextPos + 1] === '(') {
          const altText = text.substring(altTextStart, nextPos);
          
          // Find URL
          const urlStart = nextPos + 2;
          let urlEnd = urlStart;
          
          while (urlEnd < len && text[urlEnd] !== ')') {
            urlEnd++;
          }
          
          if (urlEnd < len) {
            const url = text.substring(urlStart, urlEnd);
            
            nodes.push({
              type: 'image',
              alt: altText,
              url
            });
            
            pos = urlEnd + 1;
            continue;
          }
        }
      }
      
      // Plain text (collect until next special character)
      const textStart = pos;
      
      while (pos < len) {
        // Check for the start of any inline element
        if (
          (pos + 1 < len && text.substring(pos, pos + 2) === '**') || // Bold
          (text[pos] === '*' && (pos === 0 || text[pos-1] !== '*') && (pos + 1 < len && text[pos+1] !== '*')) || // Italic
          text[pos] === '`' || // Inline code
          text[pos] === '[' || // Link
          (pos + 1 < len && text.substring(pos, pos + 2) === '![') // Image
        ) {
          break;
        }
        pos++;
      }
      
      if (pos > textStart) {
        nodes.push({
          type: 'text',
          content: text.substring(textStart, pos)
        });
      }
    }
    
    return nodes;
  }

  // Helper methods
  private skipEmptyLines() {
    while (this.position < this.length) {
      if (this.text[this.position] === '\n') {
        this.position++;
      } else if (this.isWhitespace(this.text[this.position])) {
        // Check if line contains only whitespace
        const lineStart = this.position;
        while (this.position < this.length && this.text[this.position] !== '\n') {
          if (!this.isWhitespace(this.text[this.position])) {
            // Line contains non-whitespace
            this.position = lineStart;
            return;
          }
          this.position++;
        }
        // Skip empty line
        this.position++;
      } else {
        break;
      }
    }
  }

  private skipWhitespace() {
    while (this.position < this.length && this.isWhitespace(this.text[this.position])) {
      this.position++;
    }
  }

  private skipUntilNewline() {
    while (this.position < this.length && this.text[this.position] !== '\n') {
      this.position++;
    }
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t';
  }

  private isHorizontalRule(): boolean {
    if (this.position + 2 >= this.length) {
      return false;
    }
    
    const char = this.text[this.position];
    if (char !== '-' && char !== '*' && char !== '_') {
      return false;
    }
    
    // Check for at least 3 consecutive characters
    if (this.text[this.position + 1] === char && this.text[this.position + 2] === char) {
      // Make sure it's a horizontal rule and not a heading
      let pos = this.position;
      while (pos < this.length && this.text[pos] !== '\n') {
        if (this.text[pos] !== char && !this.isWhitespace(this.text[pos])) {
          return false;
        }
        pos++;
      }
      return true;
    }
    
    return false;
  }
}

// Renderer class to convert AST to HTML
class MarkdownRenderer {
  private ast: MarkdownNode[];
  private headings: MarkdownNode[];
  
  constructor(ast: MarkdownNode[], headings: MarkdownNode[]) {
    this.ast = ast;
    this.headings = headings;
  }
  
  // Generate HTML from AST
  render(): string {
    let html = '';
    
    for (const node of this.ast) {
      html += this.renderNode(node);
    }
    
    return html;
  }
  
  // Generate Table of Contents
  generateTOC(): string {
    if (this.headings.length === 0) {
      return '';
    }
    
    let toc = '<ul class="toc-list">';
    
    for (let i = 0; i < this.headings.length; i++) {
      const heading = this.headings[i];
      const headingId = this.generateHeadingId(heading.content || '');
      
      toc += `<li class="toc-item toc-level-${heading.level}">
        <a href="#${headingId}">${this.renderInlineContent(heading.children || [])}</a>
      </li>`;
    }
    
    toc += '</ul>';
    return toc;
  }
  
  // Render a single node
  private renderNode(node: MarkdownNode): string {
    switch (node.type) {
      case 'heading':
        const headingId = this.generateHeadingId(node.content || '');
        return `<h${node.level} id="${headingId}">${this.renderInlineContent(node.children || [])}</h${node.level}>`;
        
      case 'paragraph':
        return `<p>${this.renderInlineContent(node.children || [])}</p>`;
        
      case 'blockquote':
        return `<blockquote>${this.renderInlineContent(node.children || [])}</blockquote>`;
        
      case 'code':
        return `<div class="code-block-container">
          <pre><code class="language-${node.language || ''}">${this.escapeHTML(node.content || '')}</code></pre>
          <button class="copy-button" aria-label="Copy code">Copy</button>
        </div>`;
        
      case 'list':
        const listTag = node.ordered ? 'ol' : 'ul';
        let listItems = '';
        
        for (const child of node.children || []) {
          listItems += this.renderNode(child);
        }
        
        return `<${listTag}>${listItems}</${listTag}>`;
        
      case 'list_item':
        return `<li>${this.renderInlineContent(node.children || [])}</li>`;
        
      case 'hr':
        return '<hr>';
        
      default:
        return '';
    }
  }
  
  // Render inline elements
  private renderInlineContent(nodes: MarkdownNode[]): string {
    let html = '';
    
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          html += this.escapeHTML(node.content || '');
          break;
          
        case 'bold':
          html += `<strong>${this.escapeHTML(node.content || '')}</strong>`;
          break;
          
        case 'italic':
          html += `<em>${this.escapeHTML(node.content || '')}</em>`;
          break;
          
        case 'inline_code':
          html += `<code>${this.escapeHTML(node.content || '')}</code>`;
          break;
          
        case 'link':
          const isExternal = this.isExternalUrl(node.url || '');
          const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
          html += `<a href="${this.escapeHTML(node.url || '')}"${target}>${this.escapeHTML(node.content || '')}</a>`;
          break;
          
        case 'image':
          html += `<img src="${this.escapeHTML(node.url || '')}" alt="${this.escapeHTML(node.alt || '')}" class="expandable-image">`;
          break;
      }
    }
    
    return html;
  }
  
  // Generate ID for heading (for TOC navigation)
  private generateHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
  
  // Check if URL is external
  private isExternalUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
  }
  
  // Escape HTML special characters
  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // Apply syntax highlighting to code blocks
  applySyntaxHighlighting(): void {
    const codeBlocks = document.querySelectorAll('pre code');
    
    for (let i = 0; i < codeBlocks.length; i++) {
      const codeBlock = codeBlocks[i] as HTMLElement;
      const language = codeBlock.className.replace('language-', '');
      
      if (language) {
        this.highlightCode(codeBlock, language);
      }
    }
  }
  
  // Basic syntax highlighting
  private highlightCode(element: HTMLElement, language: string): void {
    const code = element.textContent || '';
    
    // Simple syntax highlighting based on language
    let highlighted = code;
    
    // Common patterns for many languages
    const patterns: { [key: string]: { regex: RegExp, className: string }[] } = {
      'javascript': [
        { regex: /(\/\/.*)/g, className: 'comment' },
        { regex: /(["'`])(.*?)\1/g, className: 'string' },
        { regex: /\b(function|return|if|for|while|else|var|let|const|class|import|export|from|default|new)\b/g, className: 'keyword' },
        { regex: /\b(true|false|null|undefined|NaN)\b/g, className: 'boolean' },
        { regex: /\b(\d+)\b/g, className: 'number' }
      ],
      'typescript': [
        { regex: /(\/\/.*)/g, className: 'comment' },
        { regex: /(["'`])(.*?)\1/g, className: 'string' },
        { regex: /\b(function|return|if|for|while|else|var|let|const|class|interface|type|import|export|from|default|new)\b/g, className: 'keyword' },
        { regex: /\b(true|false|null|undefined|NaN)\b/g, className: 'boolean' },
        { regex: /\b(\d+)\b/g, className: 'number' }
      ],
      'html': [
        { regex: /(&lt;)(\/?)(.*?)(&gt;)/g, className: 'tag' },
        { regex: /(\w+)=["'](.*?)["']/g, className: 'attribute' }
      ],
      'css': [
        { regex: /([\.\#][\w\-]+)/g, className: 'selector' },
        { regex: /(\{)(.*?)(\})/g, className: 'block' },
        { regex: /(\w+)(\s*:\s*)(.*?)(;)/g, className: 'property' }
      ],
      'python': [
        { regex: /(#.*)/g, className: 'comment' },
        { regex: /(["'`])(.*?)\1/g, className: 'string' },
        { regex: /\b(def|class|if|elif|else|for|while|import|from|return|True|False|None)\b/g, className: 'keyword' },
        { regex: /\b(\d+)\b/g, className: 'number' }
      ]
    };
    
    // Default to javascript patterns if language not found
    const langPatterns = patterns[language] || patterns['javascript'];
    
    // Apply highlighting
    highlighted = this.escapeHTML(code);
    
    for (const pattern of langPatterns) {
      highlighted = highlighted.replace(pattern.regex, (match) => {
        return `<span class="token ${pattern.className}">${match}</span>`;
      });
    }
    
    element.innerHTML = highlighted;
  }
}

// Handle collapsible sections
function processCollapsibleSections(html: string): string {
  // Replace <!-- collapse --> with collapsible container
  return html.replace(
    /<!-- collapse -->([\s\S]*?)<!-- \/collapse -->/g, 
    '<details class="collapsible"><summary>Show/Hide Content</summary>$1</details>'
  );
}

// Main application class
class MarkdownEditor {
  private editor: HTMLTextAreaElement;
  private output: HTMLElement;
  private tocContainer: HTMLElement;
  private parser: MarkdownParser;
  private renderer: MarkdownRenderer;
  private updateTimeout: number | null = null;
  
  constructor() {
    // Initialize elements
    this.editor = document.getElementById('markdown-editor') as HTMLTextAreaElement;
    this.output = document.getElementById('preview') as HTMLElement;
    this.tocContainer = document.getElementById('toc-container') as HTMLElement;
    
    // Initialize with empty content
    this.parser = new MarkdownParser('');
    const { ast, headings } = this.parser.parse();
    this.renderer = new MarkdownRenderer(ast, headings);
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initial render with sample markdown
    this.setInitialContent();
  }
  
  // Set up event listeners
  private setupEventListeners(): void {
    // Editor input event for real-time rendering
    this.editor.addEventListener('input', () => {
      // Debounce to prevent too many renders on fast typing
      if (this.updateTimeout) {
        window.clearTimeout(this.updateTimeout);
      }
      
      this.updateTimeout = window.setTimeout(() => {
        this.updatePreview();
      }, 300);
    });
    
    // Toggle TOC visibility
    const tocToggle = document.getElementById('toc-toggle');
    if (tocToggle) {
      tocToggle.addEventListener('click', () => {
        document.body.classList.toggle('toc-visible');
      });
    }
    
    // Add event delegation for interactive elements
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      // Copy code button
      if (target.classList.contains('copy-button')) {
        this.handleCopyCode(target);
      }
      
      // Expandable image
      if (target.classList.contains('expandable-image')) {
        this.handleImageClick(target as HTMLImageElement);
      }
    });
  }
  
  // Set initial content
  private setInitialContent(): void {
    // Sample markdown content
    const sampleMarkdown = `# Markdown Parser Demo

Welcome to the TypeScript Markdown Parser and Renderer!

## Features

This parser supports:

* **Bold text**
* *Italic text*
* [Links](https://example.com)
* Images:

![Sample Image](https://picsum.photos/200/100)

### Code Blocks

Inline code: \`const x = 42;\`

\`\`\`typescript
// A sample TypeScript code block
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello, \${user.name}! You are \${user.age} years old.\`;
}
\`\`\`

## Blockquotes

> This is a blockquote.
> It can span multiple lines.

---

## Lists

1. First item
2. Second item
3. Third item

<!-- collapse -->
## Collapsible Section

This content will be hidden in a collapsible section.
<!-- /collapse -->

[Back to top](#markdown-parser-demo)
`;
    
    this.editor.value = sampleMarkdown;
    this.updatePreview();
  }
  
  // Update preview with current editor content
  private updatePreview(): void {
    const markdown = this.editor.value;
    
    // Parse markdown
    this.parser = new MarkdownParser(markdown);
    const { ast, headings } = this.parser.parse();
    
    // Render HTML
    this.renderer = new MarkdownRenderer(ast, headings);
    let html = this.renderer.render();
    
    // Process collapsible sections
    html = processCollapsibleSections(html);
    
    // Update output
    this.output.innerHTML = html;
    
    // Update TOC
    const toc = this.renderer.generateTOC();
    this.tocContainer.innerHTML = toc;
    
    // Apply syntax highlighting
    this.renderer.applySyntaxHighlighting();
  }
  
  // Handle copy code button click
  private handleCopyCode(button: HTMLElement): void {
    const container = button.closest('.code-block-container');
    if (!container) return;
    
    const codeElement = container.querySelector('code');
    if (!codeElement) return;
    
    // Copy code to clipboard
    const code = codeElement.textContent || '';
    navigator.clipboard.writeText(code)
      .then(() => {
        // Show feedback
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy code: ', err);
      });
  }
  
  // Handle expandable image click
  private handleImageClick(img: HTMLImageElement): void {
    // Toggle expanded class
    img.classList.toggle('expanded');
    
    // If expanded, create overlay
    if (img.classList.contains('expanded')) {
      const overlay = document.createElement('div');
      overlay.className = 'image-overlay';
      overlay.onclick = () => {
        img.classList.remove('expanded');
        document.body.removeChild(overlay);
      };
      
      document.body.appendChild(overlay);
    } else {
      // Remove overlay if exists
      const overlay = document.querySelector('.image-overlay');
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new MarkdownEditor();
});
