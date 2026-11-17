import DOMPurify from 'dompurify';

// A marker keeps existing plain text (including literal HTML examples) as text.
export const RICH_TEXT_PREFIX = '<!--svp-rich-text:v1-->';

export function narrativeHtml(value: string) {
  if (value.startsWith(RICH_TEXT_PREFIX)) {
    return DOMPurify.sanitize(value.slice(RICH_TEXT_PREFIX.length), {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'h2', 'h3', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['start'],
    });
  }
  const escaped = value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}
