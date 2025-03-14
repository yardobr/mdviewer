# Markdown Parser Test Document

## Introduction
This document tests various *Markdown* **formatting** features. Let's see how well they are rendered.

## Text Formatting
*Italic text* and **bold text** should be properly styled.
***Bold and italic*** text combines both styles.

## Links
[Visit NeuryCode on YouTube](https://www.youtube.com/@NeuryCode)
[Visit Google](https://google.com)

## Images
![NeuryCode Logo](https://yt3.ggpht.com/nacPvCoJnP_Nfkd9ujhgMek29pirjITuaDpsoEPSzySJ-YhsjVJdTIAlQsFpe0hMl31AvO4kbnU=s600-c-k-c0x00ffffff-no-rj-rp-mo)

## Lists

### Ordered Lists
1. First item
2. Second item
3. Third item

### Unordered Lists
* Item A
* Item B
* Item C

### Nested Lists
1. First level
   * Nested unordered 1
   * Nested unordered 2
2. Back to first level
   1. Nested ordered 1
   2. Nested ordered 2

## Code Examples

Inline code: `const x = 10;`

Code block:
```typescript
// TypeScript function with syntax highlighting
function compareAIModels(models: string[]): void {
  models.forEach((model, index) => {
    console.log(`Testing model ${index + 1}: ${model}`);
    
    // Add scoring logic here
    const score = calculateScore(model);
    
    if (score > 20) {
      console.log('This model performed exceptionally well!');
    }
  });
}

interface ModelResult {
  name: string;
  score: number;
  features: string[];
}
```

## Blockquotes

> This is a blockquote.
> It can span multiple lines.
>
> And even have multiple paragraphs.

---

## Collapsible Sections

<!-- collapse -->
### Hidden Content
This section should be collapsible.
It contains multiple lines of text
and can be toggled open/closed.

```typescript
// Some hidden code
const secret = "This is inside a collapse section";
```
<!-- /collapse -->

## Complex Example

This section combines *italic* with **bold** and `code`.

> A blockquote with a [link](https://example.com) and some *emphasis*.

1. A list with **bold text**
2. And a `code snippet`
   * With a nested item containing [a link](https://example.com)

---

## The End

That's all for our test document!
