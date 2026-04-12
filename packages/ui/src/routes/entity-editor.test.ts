import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';

function renderMarkdownToHtml(text: string): string {
  return renderToStaticMarkup(
    createElement(Markdown, { remarkPlugins: [remarkGfm] }, text),
  );
}

describe('MarkdownPreview rendering', () => {
  it('renders headings, bold, and italic', () => {
    const html = renderMarkdownToHtml('# Hello\n\n**bold** and *italic*');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders inline code', () => {
    const html = renderMarkdownToHtml('Use `console.log`');
    expect(html).toContain('<code>console.log</code>');
  });

  it('renders unordered lists', () => {
    const html = renderMarkdownToHtml('- item one\n- item two');
    expect(html).toContain('<li>');
    expect(html).toContain('<ul>');
  });

  it('renders GFM tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>');
    expect(html).toContain('<td>');
  });

  it('renders GFM task lists', () => {
    const md = '- [x] done\n- [ ] todo';
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('type="checkbox"');
  });

  it('renders GFM strikethrough', () => {
    const md = '~~deleted~~';
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<del>deleted</del>');
  });

  it('does not render raw script tags', () => {
    const html = renderMarkdownToHtml('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
  });

  it('does not render img tags with event handlers', () => {
    const html = renderMarkdownToHtml('<img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<img[^>]*onerror/);
  });

  it('does not render iframes', () => {
    const html = renderMarkdownToHtml(
      '<iframe src="https://evil.com"></iframe>',
    );
    expect(html).not.toContain('<iframe');
  });

  it('does not render links with javascript: protocol', () => {
    const html = renderMarkdownToHtml('[click](javascript:alert(1))');
    expect(html).not.toMatch(/href="javascript:/);
  });
});
