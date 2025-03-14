I need you to create a standalone interactive Markdown parser and renderer in TypeScript that can be used in a web application.

Requirements:
1. File structure:
   - One index.ts file (containing all logic)
   - One index.html file (for the UI)
   - One index.css file (for styling)
   - The link from html to js file is the following: "dist/index.js"

2. The parser should support standard Markdown features including:
   - Headings (# to ######)
   - Bold and italic text (**bold**, *italic*)
   - Links [text](url)
   - Images ![alt](url)
   - Ordered and unordered lists
   - Code blocks (both inline `code` and fenced blocks ```)
   - Blockquotes (>)
   - Horizontal rules (---)

3. The renderer should:
   - Convert the parsed Markdown to HTML
   - Add syntax highlighting for code blocks (use a simple approach, no need for external libraries)
   - Generate a clickable table of contents based on headings
   - Make all external links open in a new tab
   - Support collapsible sections for content between certain markers (e.g., <!-- collapse --> content <!-- /collapse -->)

4. Interactive features:
   - Clicking on a table of contents entry should scroll to that section
   - Code blocks should have a "copy code" button
   - Images should be expandable when clicked

5. UI Requirements:
   - Structured and convenient user interface with split-screen layout
   - Left side: Markdown editor textarea
   - Right side: Rendered output
   - Table of contents in a collapsible sidebar
   - Real-time rendering as the user types
   - Responsive design (works on desktop and tablets)

6. Include proper TypeScript interfaces/types for all components

7. Handle common edge cases and errors gracefully

Constraints:
- Do not use external Markdown parsing libraries (no marked, markdown-it, etc.)
- No CSS libraries or frameworks allowed (pure CSS only)
- No frontend frameworks (vanilla TypeScript/JavaScript only)
- Solution must be pure TypeScript - no runtime dependencies

Please implement this Markdown parser and renderer as described above. Include all three files (TypeScript, HTML, and CSS) in your solution.
