 // index.ts
 interface MarkdownNode {
  type: string;
  content?: string;
  children?: MarkdownNode[];
  attributes?: { [key: string]: string };
 }

 function parseMarkdown(markdown: string): MarkdownNode[] {
  const lines = markdown.split('\n');
  const nodes: MarkdownNode[] = [];
  let listType: 'ordered' | 'unordered' | null = null;
  let listItems: MarkdownNode[] = [];

  const addListItem = (content: string) => {
   listItems.push({ type: 'listItem', content: content.trim() });
  };

  const resetList = () => {
   if (listType && listItems.length > 0) {
    nodes.push({ type: listType === 'ordered' ? 'orderedList' : 'unorderedList', children: listItems });
    listType = null;
    listItems = [];
   }
  };

  for (let i = 0; i < lines.length; i++) {
   const line = lines[i];

   // Headings
   if (line.startsWith('#')) {
    resetList();
    const level = line.indexOf(' ');
    const content = line.substring(level + 1);
    nodes.push({ type: 'heading', content: content, attributes: { level: level.toString() } });
    continue;
   }

   // Blockquotes
   if (line.startsWith('>')) {
    resetList();
    const content = line.substring(1).trim();
    nodes.push({ type: 'blockquote', content: content });
    continue;
   }

   // Horizontal rule
   if (line.startsWith('---')) {
    resetList();
    nodes.push({ type: 'horizontalRule' });
    continue;
   }

   // Lists
   if (line.match(/^(\*|\d+\.)\s/)) {
    const isOrdered = /^\d+\.\s/.test(line);
    const content = line.substring(line.indexOf(' ') + 1);

    if (!listType) {
     listType = isOrdered ? 'ordered' : 'unordered';
    } else if ((isOrdered && listType === 'unordered') || (!isOrdered && listType === 'ordered')) {
     resetList();
     listType = isOrdered ? 'ordered' : 'unordered';
    }

    addListItem(content);
    continue;
   } else {
    resetList();
   }

   // Paragraphs
   if (line.trim() !== '') {
    nodes.push({ type: 'paragraph', content: line.trim() });
   }
  }

  resetList(); // Ensure any remaining list is added

  return nodes;
 }

 function renderMarkdown(nodes: MarkdownNode[]): string {
  let html = '';
  let toc = '<div class="toc"><ul>';
  let headingCount = 0;

  const escapeHtml = (text: string): string => {
   const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
   };
   return text.replace(/[&<>"']/g, function (m) { return map[m]; });
  };

  const inlineReplacements = (text: string): string => {
   let replacedText = text;
   replacedText = replacedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'); // Bold
   replacedText = replacedText.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
   replacedText = replacedText.replace(/`([^`]+)`/g, '<code>$1</code>'); // Inline code
   replacedText = replacedText.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" onclick="expandImage(this)">'); // Image
   replacedText = replacedText.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>'); // Link
   return replacedText;
  };

  const renderNode = (node: MarkdownNode): string => {
   switch (node.type) {
    case 'heading':
     const level = parseInt(node.attributes?.level || '1');
     const escapedContent = escapeHtml(node.content || '');
     const id = `heading-${headingCount++}`;
     toc += `<li><a href="#${id}">${escapedContent}</a></li>`;
     return `<h${level} id="${id}">${inlineReplacements(escapedContent)}</h${level}>`;
    case 'paragraph':
     return `<p>${inlineReplacements(escapeHtml(node.content || ''))}</p>`;
    case 'blockquote':
     return `<blockquote>${inlineReplacements(escapeHtml(node.content || ''))}</blockquote>`;
    case 'horizontalRule':
     return '<hr>';
    case 'codeBlock':
     const highlightedCode = highlightCode(escapeHtml(node.content || ''));
     return `<div class="code-block"><pre><code>${highlightedCode}</code></pre><button onclick="copyCode(this)">Copy Code</button></div>`;
    case 'orderedList':
     let ol = '<ol>';
     node.children?.forEach(item => {
      ol += `<li>${inlineReplacements(escapeHtml(item.content || ''))}</li>`;
     });
     ol += '</ol>';
     return ol;
    case 'unorderedList':
     let ul = '<ul>';
     node.children?.forEach(item => {
      ul += `<li>${inlineReplacements(escapeHtml(item.content || ''))}</li>`;
     });
     ul += '</ul>';
     return ul;
    case 'listItem':
     return `<li>${inlineReplacements(escapeHtml(node.content || ''))}</li>`;
    default:
     return '';
   }
  };

  const highlightCode = (code: string): string => {
   return code.replace(/(\b(const|let|var|function|class|if|else|for|while|return|import|from)\b)/g, '<span class="keyword">$1</span>')
    .replace(/(\b\d+\b)/g, '<span class="number">$1</span>')
    .replace(/(".*?")/g, '<span class="string">$1</span>')
    .replace(/(\/\/.*)/g, '<span class="comment">$1</span>');
  };

  const handleCollapse = (markdown: string): string => {
   const collapseStart = '<!-- collapse -->';
   const collapseEnd = '<!-- /collapse -->';
   let result = markdown;

   while (result.includes(collapseStart) && result.includes(collapseEnd)) {
    const start = result.indexOf(collapseStart);
    const end = result.indexOf(collapseEnd, start + collapseStart.length);

    if (start !== -1 && end !== -1) {
     const content = result.substring(start + collapseStart.length, end);
     const collapsedHtml = `<details><summary>Click to expand</summary>${content}</details>`;
     result = result.substring(0, start) + collapsedHtml + result.substring(end + collapseEnd.length);
    } else {
     break;
    }
   }

   return result;
  };

  const codeBlockRegex = /```([a-zA-Z]*)?\n([\s\S]*?)\n```/g;

  const replaceCodeBlocks = (markdown: string): string => {
   return markdown.replace(codeBlockRegex, (match, language, code) => {
    const node: MarkdownNode = { type: 'codeBlock', content: code };
    return renderNode(node);
   });
  };

  const collapsedMarkdown = handleCollapse(nodes.map(renderNode).join(''));
  const withCodeBlocks = replaceCodeBlocks(collapsedMarkdown);

  html = withCodeBlocks;
  toc += '</ul></div>';

  return toc + html;
 }

 function render() {
  const markdownText = (document.getElementById('markdown-input') as HTMLTextAreaElement).value;
  const parsedNodes = parseMarkdown(markdownText);
  const renderedHTML = renderMarkdown(parsedNodes);
  (document.getElementById('markdown-output') as HTMLDivElement).innerHTML = renderedHTML;
 }

 // Function to copy code
 (window as any).copyCode = (button: HTMLButtonElement) => {
  const codeBlock = button.parentNode?.querySelector('code');
  if (codeBlock) {
   const text = codeBlock.textContent || '';
   navigator.clipboard.writeText(text).then(() => {
    button.textContent = 'Copied!';
    setTimeout(() => {
     button.textContent = 'Copy Code';
    }, 2000);
   }).catch(err => {
    console.error('Failed to copy code: ', err);
    button.textContent = 'Error';
   });
  }
 };

 // Function to expand image
 (window as any).expandImage = (img: HTMLImageElement) => {
  img.classList.toggle('expanded');
 };

 // Event listener for real-time rendering
 document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('markdown-input') as HTMLTextAreaElement;
  textarea.addEventListener('input', render);
  render(); // Initial render
 });
