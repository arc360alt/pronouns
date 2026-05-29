import { marked } from 'marked';

marked.use({
  breaks: true,
  renderer: {
    link({ href, title, text }: { href: string; title?: string | null; text: string }) {
      const safe = href && /^javascript:/i.test(href.trim()) ? '#' : (href ?? '#');
      const t = title ? ` title="${title}"` : '';
      return `<a href="${safe}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    image() { return ''; },
  },
});

export function renderMarkdown(text: string): string {
  if (!text?.trim()) return '';
  return marked.parse(text) as string;
}
