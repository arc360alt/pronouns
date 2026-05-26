import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
export const publicRouter = Router();

const LIMITS = { html: 5, css: 2, js: 1 } as const;
const VALID_FILENAME = /^[a-zA-Z0-9_-]{1,50}\.(html|css|js)$/;
const MAX_CONTENT = 5 * 1024 * 1024; // 5 MB
const AI_DAILY_LIMIT = 20;

// ── AI helpers ────────────────────────────────────────────────────────────────

type FileRow = { id: number; filename: string; filetype: string };
type FileAction = { type: 'created' | 'updated' | 'deleted'; filename: string };

function buildSystemPrompt(files: FileRow[], htmlCount: number, cssCount: number, jsCount: number) {
  const fileList = files.length
    ? files.map(f => `  - ${f.filename} (${f.filetype})`).join('\n')
    : '  (no files yet)';
  return `You are an autonomous web developer. CALL TOOLS IMMEDIATELY. Never write plans, steps, headers, or explanations before calling tools.

BANNED — doing any of these is a critical failure:
- Writing "### Step", "Step 1:", "Here's my plan", "I'll create", "I will", "Let me", "First I'll", "Here's what I'll do"
- Outputting code blocks (\`\`\`) in your reply — write code ONLY via create_file / update_file tools
- Telling the user to paste, copy, run, or apply anything manually
- Saying "here is the updated code", "replace X with Y", "add this to your file"
- Writing markdown headers (##, ###) or bullet lists in your reply
- Stopping after only one file when multiple files need changes

EXAMPLE — CORRECT behavior:
User: "make me a portfolio site"
You: [immediately call create_file("index.html", "..."), create_file("style.css", "...")]
Then reply: "Created index.html and style.css with a dark portfolio layout."

EXAMPLE — WRONG behavior (forbidden):
User: "make me a portfolio site"
You: "I'll create a portfolio site for you! Here's my plan:
### Step 1: Create index.html
### Step 2: Create style.css
..."
THIS IS FORBIDDEN. Never do this. You may do this in your thinking, but do not write it out to the user, do it in your thinking process.

TOOL RULES:
- Before editing an existing file: call read_file(filename) FIRST to see its current content. Never call update_file without reading the file first.
- To create: call create_file(filename, content)
- To edit: call read_file(filename) → then update_file(filename, completeNewContent)
- To delete: call delete_file(filename)
- Call ALL needed tools before replying. Never stop mid-task.
- Write each file EXACTLY ONCE per message. Never call update_file twice on the same file.
- NEVER write empty content. Every create_file and update_file call must have real, complete file content.

DEBUGGING / FIXING BUGS:
- When the user reports something is broken or not working: identify which file contains that feature (JS for interactivity/fetch/API calls, CSS for visuals, HTML for structure) — then call read_file on THAT file first.
- Do NOT touch unrelated files. If the bug is in JavaScript, read and fix the JS file. Do not edit CSS or HTML unless they are part of the problem.
- After reading the file, call update_file with the corrected full content. Do not stop after just reading.

CODE SEPARATION:
- NO <style> tags in HTML — use a separate .css file linked with <link rel="stylesheet" href="style.css">
- NO inline <script> tags in HTML — use a separate .js file linked with <script src="main.js"></script>
- HTML = structure only. CSS = all styling. JS = all behaviour.

NEW SITE MINIMUM: always create both index.html AND style.css at minimum. Add a .js file only if needed for features.
EXISTING SITE CHANGES: only update the specific files that need to change. Do not rewrite everything.

FILE LIMITS:
- Max 5 .html files  (currently ${htmlCount}/5)
- Max 2 .css files   (currently ${cssCount}/2)
- Max 1 .js file     (currently ${jsCount}/1)

Current files:
${fileList}

After all tool calls are done, reply with ONE short sentence describing what you changed. No lists, no headers, no code.`;
}

type OllamaToolCall = { function: { name: string; arguments: Record<string, string> | string } };
type OllamaMessage = { role: string; content: string; tool_name?: string; tool_calls?: OllamaToolCall[] };

const OLLAMA_URL = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:e4b';

const FILE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the current content of an existing file. Always call this before update_file.',
      parameters: { type: 'object', properties: { filename: { type: 'string', description: 'The filename to read.' } }, required: ['filename'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file in the user\'s site with the given content.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Filename with extension (.html, .css, or .js).' },
          content:  { type: 'string', description: 'Full file content.' },
        },
        required: ['filename', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_file',
      description: 'Overwrite the full content of an existing file.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Existing filename to update.' },
          content:  { type: 'string', description: 'New full file content.' },
        },
        required: ['filename', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file from the user\'s site.',
      parameters: { type: 'object', properties: { filename: { type: 'string', description: 'The filename to delete.' } }, required: ['filename'] },
    },
  },
];

// Some models wrap the file content inside a JSON tool-call object instead of passing raw content,
// or double-escape strings (e.g. \" in HTML attributes). Fix both.
function sanitizeContent(raw: string): string {
  let s = raw;
  // Unwrap if the whole content value is itself a JSON tool-call blob
  const trimmed = s.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const args = obj.arguments as Record<string, string> | undefined;
      if (typeof args?.content === 'string') s = args.content;
    } catch { /* not JSON */ }
  }
  // Fix double-escaped quotes: \" → " (only when not inside a proper JSON string context)
  // This handles models that JSON-encode the content string twice.
  if (s.includes('\\"')) {
    try {
      // If wrapping in quotes and parsing gives a plain string, it was double-encoded
      const attempt = JSON.parse(`"${s.replace(/"/g, '\\"').replace(/\\\\"/g, '\\"')}"`) as string;
      if (attempt && !attempt.includes('\\"')) s = attempt;
    } catch { /* leave as-is */ }
    // Simpler fallback: just replace literal \" with "
    s = s.replace(/\\"/g, '"');
  }
  return s;
}

// When a model outputs malformed JSON (literal newlines / unescaped quotes inside the content
// value), JSON.parse fails. This extractor recovers the tool name, filename, and content by
// scanning positionally rather than relying on a clean parse.
function extractMalformedToolCall(blob: string): { name: string; args: Record<string, string> } | null {
  const nameMatch   = blob.match(/"name"\s*:\s*"([\w]+)"/);
  const fileMatch   = blob.match(/"filename"\s*:\s*"([^"]+)"/);
  if (!nameMatch) return null;

  const name     = nameMatch[1];
  const filename = fileMatch?.[1] ?? '';

  const contentPrefix = '"content"';
  const cpIdx = blob.indexOf(contentPrefix);
  if (cpIdx === -1) return { name, args: { filename } };

  // Skip past  "content"  :  "
  let valStart = cpIdx + contentPrefix.length;
  while (valStart < blob.length && /[\s:]/.test(blob[valStart])) valStart++;
  if (blob[valStart] !== '"') return { name, args: { filename } };
  valStart++; // skip opening quote

  // Scan backwards from the end of the blob to find the closing quote of the content value.
  // The blob ends with  <content>"}}  or  <content>"}}}  — skip trailing whitespace and braces.
  let valEnd = blob.length - 1;
  while (valEnd > valStart && /[\s}]/.test(blob[valEnd])) valEnd--;
  // valEnd should now be on the closing '"' of the content value
  if (blob[valEnd] === '"') valEnd--;

  const content = blob.slice(valStart, valEnd + 1);
  return { name, args: { filename, content } };
}

// Fallback: model output raw JSON tool-call objects as plain text (no code fences at all).
// Handles both valid JSON blobs and malformed ones where content has literal newlines/quotes.
function applyJsonToolCalls(text: string, userId: number): { actions: FileAction[]; stripped: string } {
  const actions: FileAction[] = [];
  const seen = new Set<string>();
  const ranges: Array<[number, number]> = [];
  let pos = 0;

  while (pos < text.length) {
    const nameIdx = text.indexOf('"name"', pos);
    if (nameIdx === -1) break;

    // Find the opening brace immediately before "name" (allowing whitespace)
    let objStart = nameIdx - 1;
    while (objStart >= 0 && /\s/.test(text[objStart])) objStart--;
    if (objStart < 0 || text[objStart] !== '{') { pos = nameIdx + 1; continue; }

    // Primary walk: WITH string tracking for well-formed JSON.
    // Unescaped quotes inside content (e.g. lang="en") confuse inStr, causing early exit.
    let depth = 0, inStr = false, esc = false, objEnd = -1;
    for (let i = objStart; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) { objEnd = i + 1; break; }
    }

    // Verify primary walk succeeded with valid JSON.
    let primaryOk = false;
    if (objEnd > objStart) {
      try { JSON.parse(text.slice(objStart, objEnd)); primaryOk = true; } catch { /* malformed */ }
    }

    // Secondary walk: WITHOUT string tracking — safe because HTML/CSS/JS content has balanced
    // braces, so inner pairs cancel out and the outer depth still hits 0 at the right place.
    if (!primaryOk) {
      let d2 = 0, end2 = -1;
      for (let i = objStart; i < text.length; i++) {
        if (text[i] === '{') d2++;
        else if (text[i] === '}' && --d2 === 0) { end2 = i + 1; break; }
      }
      if (end2 > objStart) objEnd = end2;
    }

    // Last resort: look for closing pattern "}} or "}}} after the blob start.
    if (!primaryOk && objEnd <= objStart) {
      const m = /"\}\}\}?/.exec(text.slice(objStart + 20));
      if (m) objEnd = objStart + 20 + m.index + m[0].length;
    }

    pos = objEnd > objStart ? objEnd : nameIdx + 1;
    if (objEnd <= objStart) continue;

    const blob = text.slice(objStart, objEnd);

    // Try clean parse, then malformed positional extractor.
    let toolName: string | undefined;
    let rawArgs: Record<string, string> | undefined;
    if (primaryOk) {
      const parsed = JSON.parse(blob) as Record<string, unknown>;
      toolName = parsed.name as string | undefined;
      rawArgs  = parsed.arguments as Record<string, string> | undefined;
    } else {
      const extracted = extractMalformedToolCall(blob);
      if (extracted) { toolName = extracted.name; rawArgs = extracted.args; }
    }

    if (!toolName || !rawArgs) continue;
    if (!['create_file', 'update_file', 'delete_file'].includes(toolName)) continue;

    const filename = rawArgs.filename;
    if (!filename || seen.has(filename)) continue;
    seen.add(filename);

    const { action } = executeTool(toolName, rawArgs, userId);
    if (action) { actions.push(action); ranges.push([objStart, objEnd]); }
  }

  // Strip matched blobs from the reply (iterate backwards to preserve offsets)
  let stripped = text;
  for (let i = ranges.length - 1; i >= 0; i--) {
    const [s, e] = ranges[i];
    stripped = stripped.slice(0, s) + stripped.slice(e);
  }
  stripped = stripped.replace(/\n{3,}/g, '\n\n').trim();

  return { actions, stripped };
}

function validateContent(content: string, ext: string): string | null {
  const t = content.trim();

  // Catch placeholder patterns like "{your updated CSS rules here}" or "{code here}"
  if (/^\{[^{}]{0,120}\}$/.test(t))
    return `Invalid content: "${t}" is a placeholder, not real code. Write the actual ${ext.toUpperCase()} content.`;

  // Catch lines that contain template phrases even inside larger content
  if (/\{your |your .*(rules|code|styles|content|here)\s*\}/i.test(t))
    return `Invalid content: file contains placeholder text like "{your ... here}". Write real ${ext.toUpperCase()} code instead.`;

  if (ext === 'css') {
    if (!t.includes('{'))
      return 'Invalid CSS: must contain CSS rules with { }. Write actual CSS code.';
    if (!t.includes(':'))
      return 'Invalid CSS: must contain property declarations like "color: red". Write actual CSS property rules.';
  }

  if (ext === 'html' && !t.includes('<'))
    return 'Invalid HTML: must contain HTML tags like <html>, <body>, etc. Write actual HTML code.';

  if (ext === 'js' && !/[=();{}]/.test(t))
    return 'Invalid JS: must contain actual JavaScript code with statements, functions, or assignments. Write real JS code.';

  return null;
}

function executeTool(name: string, args: Record<string, string>, userId: number): { response: Record<string, unknown>; action: FileAction | null } {
  if (name === 'create_file') {
    const { filename } = args;
    const content = sanitizeContent(args.content ?? '');
    if (!filename || !VALID_FILENAME.test(filename)) return { response: { error: 'Invalid filename' }, action: null };
    if (!content.trim()) return { response: { error: 'Content cannot be empty. Provide the actual file content.' }, action: null };
    const ext = filename.split('.').pop() as keyof typeof LIMITS;
    const contentErr = validateContent(content, ext);
    if (contentErr) return { response: { error: contentErr }, action: null };
    const { c } = db.prepare('SELECT COUNT(*) as c FROM site_files WHERE user_id = ? AND filetype = ?').get(userId, ext) as { c: number };
    if (c >= LIMITS[ext]) return { response: { error: `Limit reached: max ${LIMITS[ext]} .${ext} files allowed` }, action: null };
    if (content.length > MAX_CONTENT) return { response: { error: 'Content too large' }, action: null };
    try {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO site_files (user_id, filename, filetype, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, filename, ext, content, now, now);
      return { response: { success: true }, action: { type: 'created', filename } };
    } catch {
      return { response: { error: 'File already exists' }, action: null };
    }
  }

  if (name === 'read_file') {
    const { filename } = args;
    if (!filename) return { response: { error: 'Filename required' }, action: null };
    const file = db.prepare('SELECT content FROM site_files WHERE user_id = ? AND filename = ?')
      .get(userId, filename) as { content: string } | undefined;
    if (!file) return { response: { error: 'File not found' }, action: null };
    return { response: { content: file.content }, action: null };
  }

  if (name === 'update_file') {
    const { filename } = args;
    const content = sanitizeContent(args.content ?? '');
    if (!filename) return { response: { error: 'Filename required' }, action: null };
    if (!content.trim()) return { response: { error: 'Content cannot be empty. You must provide the full new file content, not an empty string.' }, action: null };
    const updateExt = filename.split('.').pop() ?? '';
    const updateContentErr = validateContent(content, updateExt);
    if (updateContentErr) return { response: { error: updateContentErr }, action: null };
    if (content.length > MAX_CONTENT) return { response: { error: 'Content too large' }, action: null };
    const result = db.prepare("UPDATE site_files SET content = ?, updated_at = datetime('now') WHERE user_id = ? AND filename = ?")
      .run(content, userId, filename);
    if (!result.changes) return { response: { error: 'File not found' }, action: null };
    return { response: { success: true }, action: { type: 'updated', filename } };
  }

  if (name === 'delete_file') {
    const { filename } = args;
    if (!filename) return { response: { error: 'Filename required' }, action: null };
    const result = db.prepare('DELETE FROM site_files WHERE user_id = ? AND filename = ?').run(userId, filename);
    if (!result.changes) return { response: { error: 'File not found' }, action: null };
    return { response: { success: true }, action: { type: 'deleted', filename } };
  }

  return { response: { error: 'Unknown tool' }, action: null };
}

// When the model outputs raw JSON tool calls in its text instead of using the tool_calls field,
// parse them out so the loop can execute them (including read_file) and continue.
function extractRawToolCalls(text: string): Array<{ name: string; args: Record<string, string> }> {
  const calls: Array<{ name: string; args: Record<string, string> }> = [];
  const seen = new Set<string>();
  let pos = 0;

  while (pos < text.length) {
    const nameIdx = text.indexOf('"name"', pos);
    if (nameIdx === -1) break;

    let objStart = nameIdx - 1;
    while (objStart >= 0 && /\s/.test(text[objStart])) objStart--;
    if (objStart < 0 || text[objStart] !== '{') { pos = nameIdx + 1; continue; }

    let depth = 0, inStr = false, esc = false, objEnd = -1;
    for (let i = objStart; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) { objEnd = i + 1; break; }
    }

    pos = objEnd > objStart ? objEnd : nameIdx + 1;
    if (objEnd <= objStart) continue;

    const blob = text.slice(objStart, objEnd);
    let toolName: string | undefined;
    let rawArgs: Record<string, string> | undefined;

    try {
      const parsed = JSON.parse(blob) as Record<string, unknown>;
      toolName = parsed.name as string;
      rawArgs = parsed.arguments as Record<string, string>;
    } catch {
      const extracted = extractMalformedToolCall(blob);
      if (extracted) { toolName = extracted.name; rawArgs = extracted.args; }
    }

    if (!toolName || !rawArgs) continue;
    if (!['read_file', 'create_file', 'update_file', 'delete_file'].includes(toolName)) continue;

    const dedupeKey = `${toolName}:${rawArgs.filename ?? ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    calls.push({ name: toolName, args: rawArgs });
  }

  return calls;
}

// Fallback: extract code blocks from plain-text model responses and apply them as file writes.
// Used when the model outputs markdown instead of calling tools.
function applyCodeBlocks(text: string, userId: number, existingFiles: FileRow[]): FileAction[] {
  const actions: FileAction[] = [];
  // Permissive regex: matches any fenced code block regardless of what precedes it
  const blockRe = /```(?:\w+)?[ \t]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((m = blockRe.exec(text)) !== null) {
    const blockStart = m.index;
    let content = m[1].trimEnd();
    if (!content.trim()) continue;

    // Look up to 300 chars before this block for a filename reference
    const before = text.slice(Math.max(0, blockStart - 300), blockStart);

    let filename: string | null = null;

    // 1. Filename in first comment line inside the block
    const htmlCommentMatch = content.match(/^<!--\s*([\w.-]+\.(?:html|css|js))\s*-->/);
    const cssCommentMatch  = content.match(/^\/\*\s*([\w.-]+\.(?:html|css|js))\s*\*\//);
    const jsCommentMatch   = content.match(/^\/\/\s*([\w.-]+\.(?:html|css|js))\s*\n/);
    if (htmlCommentMatch) { filename = htmlCommentMatch[1]; content = content.slice(htmlCommentMatch[0].length).trimStart(); }
    else if (cssCommentMatch) { filename = cssCommentMatch[1]; content = content.slice(cssCommentMatch[0].length).trimStart(); }
    else if (jsCommentMatch)  { filename = jsCommentMatch[1];  content = content.slice(jsCommentMatch[0].length); }

    // 2. Filename anywhere in the preceding text (closest mention wins — scan from end)
    if (!filename) {
      const fnRe = /`?([\w-]{1,50}\.(?:html|css|js))`?/g;
      let fm: RegExpExecArray | null;
      let last: string | null = null;
      while ((fm = fnRe.exec(before)) !== null) last = fm[1];
      if (last) filename = last;
    }

    // 3. Guess from content type; prefer single existing file of that type else use a default name
    if (!filename) {
      const isHtml = /<(!DOCTYPE|html)/i.test(content);
      const isCss  = /^[\s\S]*[\w-]+\s*\{[\s\S]*\}/.test(content) && !isHtml;
      const isJs   = !isHtml && !isCss && (content.includes('function') || content.includes('=>') || content.includes('const ') || content.includes('document.'));
      const ext    = isHtml ? 'html' : isCss ? 'css' : isJs ? 'js' : null;
      if (ext) {
        const candidates = existingFiles.filter(f => f.filetype === ext);
        filename = candidates.length === 1 ? candidates[0].filename
          : ext === 'html' ? 'index.html'
          : ext === 'css'  ? 'style.css'
          : 'main.js';
      }
    }

    if (!filename || !VALID_FILENAME.test(filename)) continue;
    if (seen.has(filename)) continue; // only apply the first block per filename
    seen.add(filename);

    const op = existingFiles.some(f => f.filename === filename) ? 'update_file' : 'create_file';
    const { action } = executeTool(op, { filename, content }, userId);
    if (action) actions.push(action);
  }
  return actions;
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Site</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Welcome!</h1>
  <p>This is my personal site. Edit it in Settings → My Site.</p>
</body>
</html>`;

const DEFAULT_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1.5rem;
  background: #1e1e1e;
  color: #e0e0e0;
  line-height: 1.6;
}

h1, h2, h3 {
  color: #e07a27;
  margin-bottom: 0.5rem;
}

p { margin-bottom: 1rem; }
a { color: #e07a27; }`;

function getFiles(userId: number) {
  return db.prepare(
    'SELECT id, filename, filetype, updated_at FROM site_files WHERE user_id = ? ORDER BY filetype, filename'
  ).all(userId);
}

router.get('/status', requireAuth, (req, res) => {
  const site = db.prepare('SELECT enabled FROM user_sites WHERE user_id = ?').get(req.user!.id) as { enabled: number } | undefined;
  if (!site) return res.json({ enabled: false, files: [] });
  return res.json({ enabled: !!site.enabled, files: getFiles(req.user!.id) });
});

router.post('/enable', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM user_sites WHERE user_id = ?').get(req.user!.id);
  if (existing) {
    db.prepare('UPDATE user_sites SET enabled = 1 WHERE user_id = ?').run(req.user!.id);
  } else {
    db.prepare('INSERT INTO user_sites (user_id, enabled) VALUES (?, 1)').run(req.user!.id);
    const now = new Date().toISOString();
    db.prepare('INSERT OR IGNORE INTO site_files (user_id, filename, filetype, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user!.id, 'index.html', 'html', DEFAULT_HTML, now, now);
    db.prepare('INSERT OR IGNORE INTO site_files (user_id, filename, filetype, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user!.id, 'style.css', 'css', DEFAULT_CSS, now, now);
  }
  return res.json({ enabled: true, files: getFiles(req.user!.id) });
});

router.delete('/disable', requireAuth, (req, res) => {
  db.prepare('UPDATE user_sites SET enabled = 0 WHERE user_id = ?').run(req.user!.id);
  return res.json({ ok: true });
});

router.get('/files/:id', requireAuth, (req, res) => {
  const file = db.prepare(
    'SELECT id, filename, filetype, content, updated_at FROM site_files WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user!.id) as { id: number; filename: string; filetype: string; content: string; updated_at: string } | undefined;
  if (!file) return res.status(404).json({ error: 'Not found' });
  return res.json(file);
});

router.put('/files/:id', requireAuth, (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'Content required' });
  if (content.length > MAX_CONTENT) return res.status(400).json({ error: 'File too large (max 5 MB)' });
  const result = db.prepare(
    "UPDATE site_files SET content = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(content, req.params.id, req.user!.id);
  if (!result.changes) return res.status(404).json({ error: 'Not found' });
  return res.json({ ok: true });
});

router.post('/files', requireAuth, (req, res) => {
  const { filename, content = '' } = req.body;
  if (!filename || !VALID_FILENAME.test(filename))
    return res.status(400).json({ error: 'Invalid filename (alphanumeric, hyphens, underscores + .html/.css/.js, max 50 chars)' });
  const ext = filename.split('.').pop() as keyof typeof LIMITS;
  const { c } = db.prepare('SELECT COUNT(*) as c FROM site_files WHERE user_id = ? AND filetype = ?')
    .get(req.user!.id, ext) as { c: number };
  if (c >= LIMITS[ext])
    return res.status(400).json({ error: `Maximum ${LIMITS[ext]} .${ext} file(s) allowed` });
  if ((content as string).length > MAX_CONTENT)
    return res.status(400).json({ error: 'File too large (max 5 MB)' });
  try {
    const now = new Date().toISOString();
    const result = db.prepare(
      'INSERT INTO site_files (user_id, filename, filetype, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user!.id, filename, ext, content, now, now);
    return res.status(201).json({ id: result.lastInsertRowid, filename, filetype: ext, updated_at: now });
  } catch {
    return res.status(409).json({ error: 'A file with that name already exists' });
  }
});

router.delete('/files/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM site_files WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (!result.changes) return res.status(404).json({ error: 'Not found' });
  return res.json({ ok: true });
});

// ── AI chat ───────────────────────────────────────────────────────────────────

router.get('/ai/usage', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND date = ?').get(req.user!.id, today) as { count: number } | undefined;
  return res.json({ used: row?.count ?? 0, limit: AI_DAILY_LIMIT, remaining: AI_DAILY_LIMIT - (row?.count ?? 0) });
});

router.post('/ai/chat', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const usageRow = db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND date = ?').get(req.user!.id, today) as { count: number } | undefined;
  const used = usageRow?.count ?? 0;
  if (used >= AI_DAILY_LIMIT) {
    return res.status(429).json({ error: `Daily limit of ${AI_DAILY_LIMIT} messages reached. Try again tomorrow.` });
  }

  const { message, history = [] } = req.body as {
    message: string;
    history: Array<{ role: 'user' | 'model'; text: string }>;
  };
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  // SSE — keeps Cloudflare alive during long Ollama requests (avoids 524 timeout)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  const files = db.prepare('SELECT id, filename, filetype FROM site_files WHERE user_id = ? ORDER BY filetype, filename').all(req.user!.id) as FileRow[];
  const htmlCount = files.filter(f => f.filetype === 'html').length;
  const cssCount = files.filter(f => f.filetype === 'css').length;
  const jsCount  = files.filter(f => f.filetype === 'js').length;

  try {
    const messages: OllamaMessage[] = [
      { role: 'system', content: buildSystemPrompt(files, htmlCount, cssCount, jsCount) },
      ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: message.trim() },
    ];

    const actions: FileAction[] = [];
    let reply = '';
    const writtenFiles = new Set<string>(); // prevent the model looping on the same file

    for (let i = 0; i < 10; i++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 5 * 60 * 1000); // 5 min per call
      let resp: Response;
      try {
        resp = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, messages, tools: FILE_TOOLS, stream: false }),
          signal: ac.signal,
        });
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw new Error('Ollama timed out after 5 minutes');
        throw e;
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${await resp.text()}`);

      const data = await resp.json() as { message: OllamaMessage };
      const msg = data.message;
      messages.push(msg);

      if (!msg.tool_calls?.length) {
        const rawContent = msg.content ?? '';
        const rawCalls = extractRawToolCalls(rawContent);

        if (rawCalls.length > 0) {
          // Model put raw JSON in text instead of using tool_calls — fix the conversation
          // structure so Ollama sees a proper tool-call flow, then loop again.
          messages.pop();
          messages.push({
            role: 'assistant',
            content: '',
            tool_calls: rawCalls.map(c => ({ function: { name: c.name, arguments: c.args } })),
          } as OllamaMessage);

          for (const { name, args } of rawCalls) {
            const isWrite = ['create_file', 'update_file', 'delete_file'].includes(name);
            if (isWrite && args.filename && writtenFiles.has(args.filename)) {
              messages.push({ role: 'tool', tool_name: name, content: `${args.filename} was already updated. Move on.` });
              continue;
            }
            const { response: toolResp, action } = executeTool(name, args, req.user!.id);
            if (action) { actions.push(action); writtenFiles.add(action.filename); }
            messages.push({ role: 'tool', tool_name: name, content: JSON.stringify(toolResp) });
          }
          continue;
        }

        reply = rawContent;
        break;
      }

      for (const call of msg.tool_calls) {
        const name = call.function.name;
        const args = typeof call.function.arguments === 'string'
          ? JSON.parse(call.function.arguments) as Record<string, string>
          : call.function.arguments;

        // Skip write ops on files already handled this turn — stops the model looping
        const isWrite = ['create_file', 'update_file', 'delete_file'].includes(name);
        if (isWrite && args.filename && writtenFiles.has(args.filename)) {
          messages.push({ role: 'tool', tool_name: name, content: `${args.filename} was already updated this session. Move on to the next file.` });
          continue;
        }

        const { response: toolResp, action } = executeTool(name, args, req.user!.id);
        if (action) {
          actions.push(action);
          writtenFiles.add(action.filename);
        }
        messages.push({ role: 'tool', tool_name: name, content: JSON.stringify(toolResp) });
      }
    }

    // Fallback 1: model sent fenced code blocks as plain text
    if (actions.length === 0 && reply.includes('```')) {
      const fallback = applyCodeBlocks(reply, req.user!.id, files);
      actions.push(...fallback);
      if (fallback.length > 0) {
        reply = reply.replace(/```(?:\w+)?[ \t]*\n[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
        if (!reply) reply = `Done! Applied changes to: ${fallback.map(a => a.filename).join(', ')}.`;
      }
    }

    // Fallback 2: model sent raw JSON tool-call blobs as plain text (no code fences)
    if (actions.length === 0) {
      const { actions: jsonActions, stripped } = applyJsonToolCalls(reply, req.user!.id);
      actions.push(...jsonActions);
      if (jsonActions.length > 0) {
        reply = stripped || `Done! Applied changes to: ${jsonActions.map(a => a.filename).join(', ')}.`;
      }
    }

    if (!reply.trim() && actions.length > 0) {
      reply = `Done! Changes: ${actions.map(a => `${a.type} ${a.filename}`).join(', ')}.`;
    } else if (!reply.trim()) {
      reply = 'Done!';
    }

    // Increment usage
    db.prepare(`
      INSERT INTO ai_usage (user_id, date, count) VALUES (?, ?, 1)
      ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
    `).run(req.user!.id, today);

    // Refresh file list so client can sync
    const updatedFiles = db.prepare(
      'SELECT id, filename, filetype, updated_at FROM site_files WHERE user_id = ? ORDER BY filetype, filename'
    ).all(req.user!.id);

    clearInterval(heartbeat);
    sendEvent({ reply, actions, files: updatedFiles, remaining: AI_DAILY_LIMIT - used - 1 });
    res.end();
  } catch (err) {
    clearInterval(heartbeat);
    console.error('AI error:', err);
    const msg = err instanceof Error ? err.message : 'AI request failed';
    sendEvent({ error: msg });
    res.end();
  }
});

// Public: serve a user's site file
publicRouter.get('/:username/:filename', (req, res) => {
  const { username, filename } = req.params;
  if (!VALID_FILENAME.test(filename)) return res.status(400).send('Invalid filename');
  const user = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND is_banned = 0')
    .get(username) as { id: number } | undefined;
  if (!user) return res.status(404).send('Site not found');
  const site = db.prepare('SELECT enabled FROM user_sites WHERE user_id = ?').get(user.id) as { enabled: number } | undefined;
  if (!site?.enabled) return res.status(404).send('Site not found');
  const file = db.prepare('SELECT content, filetype FROM site_files WHERE user_id = ? AND filename = ?')
    .get(user.id, filename) as { content: string; filetype: string } | undefined;
  if (!file) return res.status(404).send('File not found');
  const mime: Record<string, string> = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
  res.setHeader('Content-Type', `${mime[file.filetype]}; charset=utf-8`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(file.content);
});

publicRouter.get('/:username', (req, res) => {
  res.redirect(`/sites/${req.params.username}/index.html`);
});

export default router;
