// index.ts
interface MarkdownBlock {
  type: string;
  content: string;
  items?: string[];
  level?: number;
  lang?: string;
  url?: string;
  alt?: string;
}

class MarkdownParser {
  parse(markdown: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    const lines = markdown.split('\n');
    let currentList: string[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let currentLang = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();

      if (line.startsWith('```')) {
        if (inCodeBlock) {
          blocks.push({
            type: 'code',
            content: codeBlockContent.join('\n'),
            lang: currentLang,
          });
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          currentLang = line.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      if (line.match(/^#{1,6}\s/)) {
        const level = line.indexOf(' ');
        blocks.push({
          type: 'heading',
          content: line.slice(level + 1),
          level: level,
        });
        continue;
      }

      if (line.startsWith('> ')) {
        blocks.push({ type: 'blockquote', content: line.slice(2) });
        continue;
      }

      if (line.match(/^[-*+]\s/)) {
        currentList.push(line.replace(/^[-*+]\s/, ''));
        continue;
      }

      if (line.match(/^\d+\.\s/)) {
        currentList.push(line.replace(/^\d+\.\s/, ''));
        continue;
      }

      if (currentList.length > 0) {
        blocks.push({
          type: 'list', items: [...currentList],
          content: ''
        });
        currentList = [];
      }

      if (line === '---') {
        blocks.push({ type: 'hr', content: '' });
        continue;
      }

      if (line) {
        blocks.push({ type: 'paragraph', content: line });
      }
    }

    return blocks;
  }
}

class MarkdownRenderer {
  private toc: { level: number; content: string; id: string }[] = [];

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private parseInline(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, url) => {
        return `<img src="${url}" alt="${alt}" class="md-image">`;
      })
      .replace(/\[(.*?)\]\((.*?)\)/g, (_, text, url) => {
        return `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
      });
  }

  generateToc(): string {
    return this.toc
      .map(
        (item) =>
          `<li class="toc-item toc-level-${item.level}">
            <a href="#${item.id}">${item.content}</a>
           </li>`
      )
      .join('');
  }

  render(blocks: MarkdownBlock[]): string {
    this.toc = [];
    let output = '';
    let inCollapsible = false;

    blocks.forEach((block) => {
      let content = this.parseInline(this.escapeHtml(block.content));

      if (block.type === 'heading') {
        const id = content.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        this.toc.push({ level: block.level!, content: block.content, id });
        output += `<h${block.level} id="${id}">${content}</h${block.level}>`;
      } else if (block.type === 'paragraph') {
        output += `<p>${content}</p>`;
      } else if (block.type === 'blockquote') {
        output += `<blockquote>${content}</blockquote>`;
      } else if (block.type === 'hr') {
        output += '<hr>';
      } else if (block.type === 'list') {
        const items = block.items!.map((item) => `<li>${this.parseInline(this.escapeHtml(item))}</li>`).join('');
        output += `<ul>${items}</ul>`;
      } else if (block.type === 'code') {
        const langClass = block.lang ? ` class="language-${block.lang}"` : '';
        output += `
          <div class="code-block">
            <button class="copy-button">Copy</button>
            <pre><code${langClass}>${this.escapeHtml(block.content)}</code></pre>
          </div>
        `;
      } else if (block.type === 'collapsible') {
        if (content.includes('<!-- collapse -->')) {
          inCollapsible = true;
          output += `
            <div class="collapsible">
              <button class="collapse-toggle">▼</button>
              <div class="collapse-content hidden">
          `;
        } else if (content.includes('<!-- /collapse -->')) {
          inCollapsible = false;
          output += `</div></div>`;
        } else if (inCollapsible) {
          output += content;
        }
      }
    });

    return output;
  }
}

class MarkdownApp {
  private editor: HTMLTextAreaElement;
  private output: HTMLElement;
  private tocSidebar: HTMLElement;
  private parser = new MarkdownParser();
  private renderer = new MarkdownRenderer();

  constructor() {
    this.editor = document.getElementById('editor') as HTMLTextAreaElement;
    this.output = document.getElementById('output')!;
    this.tocSidebar = document.getElementById('toc')!;

    this.setupEventListeners();
    this.updateOutput();
  }

  private setupEventListeners() {
    this.editor.addEventListener('input', () => this.updateOutput());
    document.addEventListener('click', (e) => this.handleClick(e));
  }

  private updateOutput() {
    const markdown = this.editor.value;
    const parsed = this.parser.parse(markdown);
    this.output.innerHTML = this.renderer.render(parsed);
    this.tocSidebar.innerHTML = `<ul>${this.renderer.generateToc()}</ul>`;
  }

  private handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    if (target.classList.contains('copy-button')) {
      const code = target.nextElementSibling!.textContent!;
      navigator.clipboard.writeText(code);
    }

    if (target.classList.contains('md-image')) {
      this.showImageModal(target as HTMLImageElement);
    }

    if (target.closest('.toc a')) {
      e.preventDefault();
      const id = target.getAttribute('href')!.slice(1);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }

    if (target.classList.contains('collapse-toggle')) {
      const content = target.nextElementSibling as HTMLElement;
      content.classList.toggle('hidden');
      target.textContent = content.classList.contains('hidden') ? '▶' : '▼';
    }
  }

  private showImageModal(img: HTMLImageElement) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <img src="${img.src}" alt="${img.alt}">
      </div>
    `;
    modal.onclick = () => document.body.removeChild(modal);
    document.body.appendChild(modal);
  }
}

new MarkdownApp();
