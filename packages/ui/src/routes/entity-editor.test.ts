import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './entity-editor.js';

import DOMPurify from 'dompurify';
const window = new Window();
const purify = DOMPurify(window as unknown as Window);

function sanitizedMarkdown(text: string): string {
  return purify.sanitize(renderMarkdown(text));
}

describe('MarkdownPreview sanitization', () => {
  it('renders basic markdown correctly', () => {
    const result = sanitizedMarkdown(
      '# Hello\n\nSome **bold** and *italic* text',
    );
    expect(result).toContain('<h1>Hello</h1>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('renders code spans', () => {
    const result = sanitizedMarkdown('Use `console.log` here');
    expect(result).toContain('<code>console.log</code>');
  });

  it('renders lists', () => {
    const result = sanitizedMarkdown('- item one\n- item two');
    expect(result).toContain('<li>item one</li>');
    expect(result).toContain('<ul>');
  });

  it('does not produce executable script tags', () => {
    const result = sanitizedMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('does not produce img tags with event handlers', () => {
    const result = sanitizedMarkdown('<img src=x onerror=alert(1)>');
    // Should not contain an actual <img tag with onerror
    expect(result).not.toMatch(/<img[^>]*onerror/);
  });

  it('does not produce links with javascript: protocol', () => {
    // renderMarkdown has no link syntax, so this stays as text
    const result = sanitizedMarkdown('[click](javascript:alert(1))');
    expect(result).not.toMatch(/<a[^>]*javascript:/);
  });

  it('does not produce iframe elements', () => {
    const result = sanitizedMarkdown(
      '<iframe src="https://evil.com"></iframe>',
    );
    expect(result).not.toContain('<iframe');
  });

  it('does not produce SVG with event handlers', () => {
    const result = sanitizedMarkdown('<svg onload=alert(1)>');
    expect(result).not.toMatch(/<svg[^>]*onload/);
  });

  it('DOMPurify strips injected tags that bypass regex escaping', () => {
    // Simulate what would happen if raw HTML somehow got through renderMarkdown
    const maliciousHtml = '<img src=x onerror=alert(1)><script>evil()</script>';
    const sanitized = purify.sanitize(maliciousHtml);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toMatch(/onerror/);
  });
});
