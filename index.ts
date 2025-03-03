// index.ts

// Define interfaces for components
interface Heading {
  level: number;
  id: string;
  text: string;
}

interface CodeBlock {
  lang: string;
  code: string;
}

// Global TOC array (will be updated during parsing)
let tocItems: Heading[] = [];

/**
 * Escapes HTML special characters.
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A very simple syntax highlighter that highlights a few JavaScript keywords.
 */
function simpleSyntaxHighlight(code: string): string {
  // For demonstration, we highlight a few keywords.
  // Extend this function based on language and needs.
  const keywords = [
    "const",
    "let",
    "function",
    "if",
    "else",
    "for",
    "while",
    "return",
    "class",
    "interface",
    "import",
    "export"
  ];
  keywords.forEach((kw) => {
    // Use word boundaries to replace keywords
    const re = new RegExp(`\\b${kw}\\b`, "g");
    code = code.replace(
      re,
      `<span class="syntax-keyword">${kw}</span>`
    );
  });
  return code;
}

/**
 * Generates the Table of Contents HTML from tocItems.
 */
function generateTOC(): string {
  if (tocItems.length === 0) {
    return "<p>No headings</p>";
  }
  let tocHTML = `<ul>`;
  tocItems.forEach((heading) => {
    tocHTML += `<li class="toc-level-${heading.level}">
      <a href="#${heading.id}" class="toc-link">${heading.text}</a>
    </li>`;
  });
  tocHTML += `</ul>`;
  return tocHTML;
}

/**
 * Parses Markdown text into HTML.
 */
function parseMarkdown(text: string): string {
  // Reset tocItems for every new parsing
  tocItems = [];

  // --- Process collapsible sections ---
  // Convert content between <!-- collapse --> and <!-- /collapse --> into a collapsible div.
  text = text.replace(
    /<!--\s*collapse\s*-->([\s\S]*?)<!--\s*\/collapse\s*-->/gm,
    (_, content) => {
      // Recursively parse the inner content
      return `<div class="collapsible">
  <button class="collapse-toggle">Toggle</button>
  <div class="collapse-content">
    ${parseMarkdown(content)}
  </div>
</div>`;
    }
  );

  // --- Process fenced code blocks ---
  text = text.replace(
    /```(\w+)?\n([\s\S]*?)```/gm,
    (match, lang, codeBlock) => {
      const escapedCode = escapeHTML(codeBlock);
      const highlighted = simpleSyntaxHighlight(escapedCode);
      return `<pre class="code-block"><code data-lang="${
        lang || ""
      }">${highlighted}</code>
  <button class="copy-code-button">Copy Code</button>
</pre>`;
    }
  );

  // --- Process inline code ---
  text = text.replace(/`([^`]+)`/g, (_match, code) => {
    return `<code>${escapeHTML(code)}</code>`;
  });

  // --- Process line-by-line elements ---
  const lines = text.split("\n");
  const htmlLines: string[] = [];
  const listStack: string[] = [];

  // Regular expression definitions
  const headingRegex = /^(#{1,6})\s+(.*)$/;
  const hrRegex = /^---\s*$/;
  const blockquoteRegex = /^>\s+(.*)$/;
  const orderedListRegex = /^(\d+)\.\s+(.*)$/;
  const unorderedListRegex = /^[-\*]\s+(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(headingRegex);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2].trim();
      const id = "heading-" + tocItems.length;
      tocItems.push({ level, id, text: content });
      htmlLines.push(`<h${level} id="${id}">${content}</h${level}>`);
      continue;
    }

    // Horizontal Rules
    if (hrRegex.test(line)) {
      htmlLines.push(`<hr />`);
      continue;
    }

    // Blockquotes
    const blockquoteMatch = line.match(blockquoteRegex);
    if (blockquoteMatch) {
      htmlLines.push(`<blockquote>${blockquoteMatch[1]}</blockquote>`);
      continue;
    }

    // Ordered & Unordered Lists
    const orderedMatch = line.match(orderedListRegex);
    const unorderedMatch = line.match(unorderedListRegex);

    if (orderedMatch || unorderedMatch) {
      const tag = orderedMatch ? "ol" : "ul";
      const content = orderedMatch
        ? orderedMatch[2]
        : unorderedMatch![1];

      // If the current list is not the same type, close open list if necessary
      if (
        listStack.length === 0 ||
        listStack[listStack.length - 1] !== tag
      ) {
        // If a different list is open, close it
        if (listStack.length > 0) {
          htmlLines.push(`</${listStack.pop()}>`);
        }
        htmlLines.push(`<${tag}>`);
        listStack.push(tag);
      }
      htmlLines.push(`<li>${content}</li>`);
      continue;
    } else {
      // If not a list line, close any open list
      while (listStack.length > 0) {
        htmlLines.push(`</${listStack.pop()}>`);
      }
    }

    // Paragraphs (non-empty lines)
    if (line.trim() !== "") {
      htmlLines.push(`<p>${line}</p>`);
    }
  }
  // Close any remaining open lists
  while (listStack.length > 0) {
    htmlLines.push(`</${listStack.pop()}>`);
  }

  let html = htmlLines.join("\n");

  // --- Process Bold and Italics ---
  // Bold: **text**
  html = html.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");
  // Italic: *text*
  html = html.replace(/\*([^\*]+)\*/g, "<em>$1</em>");

  // --- Process Images ---
  // Format: ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    `<img alt="$1" src="$2" class="expandable" />`
  );

  // --- Process Links ---
  // Format: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" target="_blank">$1</a>`
  );

  return html;
}

/**
 * Updates the rendered output and TOC.
 */
function updateRenderedOutput(): void {
  const markdownInput = (
    document.getElementById("markdown-editor") as HTMLTextAreaElement
  ).value;
  const outputDiv = document.getElementById("rendered-output")!;
  outputDiv.innerHTML = parseMarkdown(markdownInput);

  // Update Table of Contents
  const tocDiv = document.getElementById("toc")!;
  tocDiv.innerHTML = generateTOC();
}

/**
 * Sets up event listeners for interactive features.
 */
function setupEventListeners(): void {
  // Real-time rendering as user types
  const editor = document.getElementById(
    "markdown-editor"
  ) as HTMLTextAreaElement;
  editor.addEventListener("input", () => {
    updateRenderedOutput();
  });

  // Delegate click events for copy code buttons, collapse toggles, and image expand
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    // Copy code button
    if (target.classList.contains("copy-code-button")) {
      const codeElement = target.parentElement?.querySelector("code");
      if (codeElement) {
        const codeText = codeElement.textContent || "";
        navigator.clipboard
          .writeText(codeText)
          .then(() => {
            target.textContent = "Copied!";
            setTimeout(() => {
              target.textContent = "Copy Code";
            }, 1500);
          })
          .catch(() => {
            target.textContent = "Error";
          });
      }
    }

    // Collapsible sections toggle
    if (target.classList.contains("collapse-toggle")) {
      const contentDiv = target.nextElementSibling as HTMLElement;
      if (contentDiv) {
        contentDiv.classList.toggle("collapsed");
      }
    }

    // Expandable images
    if (target.tagName === "IMG" && target.classList.contains("expandable")) {
      target.classList.toggle("expanded");
    }

    // Table of contents navigation (smooth scroll)
    if (target.classList.contains("toc-link")) {
      event.preventDefault();
      const href = target.getAttribute("href");
      if (href) {
        const el = document.querySelector(href);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  });
}

/**
 * Initializes the application.
 */
function init(): void {
  updateRenderedOutput();
  setupEventListeners();
}

// Initialize when DOM content is loaded
document.addEventListener("DOMContentLoaded", init);
