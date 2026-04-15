import MarkdownIt from "https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/+esm";
import multimd from "https://cdn.jsdelivr.net/npm/markdown-it-multimd-table@4.2.3/+esm";
import taskLists from "https://cdn.jsdelivr.net/npm/markdown-it-task-lists@2.0.0/+esm";
import anchor from "https://cdn.jsdelivr.net/npm/markdown-it-anchor@9.0.0/+esm";
import texmath from "https://cdn.jsdelivr.net/npm/markdown-it-texmath@1.0.0/+esm";
import katex from "https://cdn.jsdelivr.net/npm/katex@0.16.9/+esm";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10.9.0/+esm";

const VAULT_KEY = "markdown-studio-vault-v2";
const THEME_KEY = "markdown-studio-theme";
/** Bumped so a stale "source-only" preference does not hide preview after upgrades. */
const VIEW_KEY = "markdown-studio-view-v2";

/** @type {Window & { hljs?: import("highlight.js").HljsApi }} */
const w = window;

function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\w\u00c0-\u024f\s-]/g, "")
    .replace(/\s+/g, "-");
}

function preprocessWikilinks(text) {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const t = target.trim();
    const lbl = label != null && String(label).trim() !== "" ? String(label).trim() : t;
    return `[${lbl}](wiki:${encodeURIComponent(t)})`;
  });
}

function escapeHtml(s) {
  return MarkdownIt.utils.escapeHtml(String(s));
}

function buildMarkdownIt() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight(str, lang) {
      if (lang === "mermaid") {
        return `<div class="mermaid">${MarkdownIt.utils.escapeHtml(str)}</div>`;
      }
      const hljs = w.hljs;
      if (hljs && lang && hljs.getLanguage(lang)) {
        try {
          return `<pre><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
        } catch (_) {
          /* fall through */
        }
      }
      if (hljs) {
        try {
          return `<pre><code class="hljs">${hljs.highlightAuto(str).value}</code></pre>`;
        } catch (_) {
          /* fall through */
        }
      }
      return `<pre><code class="hljs">${MarkdownIt.utils.escapeHtml(str)}</code></pre>`;
    },
  })
    .use(multimd)
    .use(taskLists, { enabled: true, label: true })
    .use(anchor, {
      permalink: false,
      slugify: (s) => slugify(s),
    })
    .use(texmath, {
      engine: katex,
      delimiters: "dollars",
      katexOptions: { throwOnError: false, output: "html" },
    });

  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const aIndex = tokens[idx].attrIndex("href");
    if (aIndex >= 0) {
      const href = tokens[idx].attrs[aIndex][1];
      if (href.startsWith("wiki:")) {
        const title = decodeURIComponent(href.slice(5));
        tokens[idx].attrSet("href", "#");
        tokens[idx].attrSet("class", "wikilink");
        tokens[idx].attrSet("data-wiki", title);
      } else if (/^https?:\/\//i.test(href)) {
        const ti = tokens[idx].attrIndex("target");
        if (ti < 0) tokens[idx].attrPush(["target", "_blank"]);
        else tokens[idx].attrs[ti][1] = "_blank";
        const ri = tokens[idx].attrIndex("rel");
        if (ri < 0) tokens[idx].attrPush(["rel", "noopener noreferrer"]);
      }
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

const md = buildMarkdownIt();

function inlineToPlain(inline) {
  if (!inline || inline.type !== "inline") return "";
  const walk = (tokens) => {
    let s = "";
    for (const t of tokens || []) {
      if (t.type === "text") s += t.content;
      else if (t.type === "code_inline") s += t.content;
      else if (t.type === "softbreak" || t.type === "hardbreak") s += " ";
      else if (t.children) s += walk(t.children);
    }
    return s;
  };
  return walk(inline.children || []);
}

function parseHeadingsFromMd(text) {
  const tokens = md.parse(preprocessWikilinks(text), {});
  /** @type {{ level: number; text: string; id: string }[]} */
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "heading_open") {
      const level = Number(t.tag.slice(1));
      const idIndex = t.attrIndex("id");
      const id = idIndex >= 0 ? t.attrs[idIndex][1] : "";
      const inline = tokens[i + 1];
      const textPlain = inlineToPlain(inline);
      if (id && textPlain) out.push({ level, text: textPlain, id });
    }
  }
  return out;
}

function readingMinutes(wordCount) {
  return Math.max(1, Math.round(wordCount / 200) || 0);
}

function getCaretLineCol(textarea) {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  let line = 1;
  let col = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") {
      line++;
      col = 1;
    } else col++;
  }
  return { line, col };
}

function insertAround(textarea, before, after = before) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const v = textarea.value;
  const sel = v.slice(start, end);
  const next = v.slice(0, start) + before + sel + after + v.slice(end);
  textarea.value = next;
  const np = start + before.length;
  const ne = np + sel.length;
  textarea.setSelectionRange(np, ne);
  textarea.focus();
}

function insertLinePrefix(textarea, prefix) {
  const start = textarea.selectionStart;
  const v = textarea.value;
  const lineStart = v.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = v.indexOf("\n", start);
  const end = lineEnd === -1 ? v.length : lineEnd;
  const line = v.slice(lineStart, end);
  const nextLine =
    line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line;
  textarea.value = v.slice(0, lineStart) + nextLine + v.slice(end);
  textarea.setSelectionRange(start + (nextLine.length - line.length), start + (nextLine.length - line.length));
  textarea.focus();
}

/** @typedef {{ id: string; title: string; content: string; updatedAt: number }} Doc */

/** @typedef {{ documents: Doc[]; activeId: string | null }} Vault */

function loadVault() {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    return /** @type {Vault} */ (JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

function defaultDemoContent() {
  return `# Welcome to Markdown Studio

A **local-first** editor inspired by what people use most in top Markdown tools: **live preview**, **GFM**, **diagrams**, **math**, **wiki links**, and a simple **vault**.

## Task lists

- [x] Open this note
- [ ] Try wiki links: [[Notes]]
- [ ] Export to HTML

## Math (KaTeX)

Inline $E = mc^2$ and a block:

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

## Mermaid diagram

\`\`\`mermaid
flowchart LR
  A[Write] --> B[Preview]
  B --> C[Export HTML]
\`\`\`

## Table

| Feature        | Here |
| -------------- | ---- |
| Tables (GFM)   | Yes  |
| Code highlight | Yes  |
| Wiki links \`[[…]]\` | Yes  |

## Strikethrough

~~old idea~~ **new idea**

---

Use the outline on the right, split/source/preview modes in the toolbar, and **⌘/Ctrl+S** to download the current note.
`;
}

function ensureVault() {
  let v = loadVault();
  if (!v || !Array.isArray(v.documents) || v.documents.length === 0) {
    const id = crypto.randomUUID();
    v = {
      documents: [
        {
          id,
          title: "Getting Started",
          content: defaultDemoContent(),
          updatedAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          title: "Notes",
          content: "# Notes\n\nLink here from other notes with [[Getting Started]].\n",
          updatedAt: Date.now(),
        },
      ],
      activeId: id,
    };
    saveVault(v);
  }
  return v;
}

const els = {
  app: /** @type {HTMLElement} */ (document.querySelector(".app")),
  sidebar: /** @type {HTMLElement} */ (document.querySelector(".sidebar")),
  outline: /** @type {HTMLElement} */ (document.querySelector(".outline-panel")),
  backdrop: /** @type {HTMLElement} */ (document.querySelector(".mobile-backdrop")),
  docList: /** @type {HTMLElement} */ (document.getElementById("doc-list")),
  search: /** @type {HTMLInputElement} */ (document.getElementById("doc-search")),
  editor: /** @type {HTMLTextAreaElement} */ (document.getElementById("editor")),
  preview: /** @type {HTMLElement} */ (document.getElementById("preview")),
  outlineList: /** @type {HTMLElement} */ (document.getElementById("outline-list")),
  statLn: /** @type {HTMLElement} */ (document.getElementById("stat-ln")),
  statWords: /** @type {HTMLElement} */ (document.getElementById("stat-words")),
  statRead: /** @type {HTMLElement} */ (document.getElementById("stat-read")),
  statView: /** @type {HTMLElement} */ (document.getElementById("stat-view")),
  themeBtn: /** @type {HTMLButtonElement} */ (document.getElementById("btn-theme")),
  toggleSidebar: /** @type {HTMLButtonElement} */ (document.getElementById("toggle-sidebar")),
  toggleOutline: /** @type {HTMLButtonElement} */ (document.getElementById("toggle-outline")),
};

let vault = ensureVault();
let filter = "";

function activeDoc() {
  const id = vault.activeId;
  return vault.documents.find((d) => d.id === id) || vault.documents[0];
}

function setTheme(mode) {
  const root = document.documentElement;
  if (mode === "light") root.setAttribute("data-theme", "light");
  else if (mode === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");

  const hlTheme = document.getElementById("hljs-theme");
  if (hlTheme) {
    const dark =
      mode === "dark" ||
      (mode === "system" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    hlTheme.setAttribute(
      "href",
      dark
        ? "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css"
        : "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css",
    );
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "default",
  });

  localStorage.setItem(THEME_KEY, mode);
  els.themeBtn.setAttribute("aria-label", `Theme: ${mode}`);
}

function getStoredTheme() {
  const t = localStorage.getItem(THEME_KEY);
  if (t === "light" || t === "dark" || t === "system") return t;
  return "system";
}

function cycleTheme() {
  const order = ["system", "light", "dark"];
  const cur = getStoredTheme();
  const i = order.indexOf(cur);
  setTheme(order[(i + 1) % order.length]);
}

function getViewMode() {
  const v = localStorage.getItem(VIEW_KEY);
  if (v === "source" || v === "split" || v === "preview") return v;
  return "split";
}

function setViewMode(mode) {
  localStorage.setItem(VIEW_KEY, mode);
  els.app.classList.remove("mode-source", "mode-split", "mode-preview");
  els.app.classList.add(`mode-${mode}`);
  document.querySelectorAll(".btn-view").forEach((b) => {
    const btn = /** @type {HTMLButtonElement} */ (b);
    btn.setAttribute("aria-pressed", btn.dataset.view === mode ? "true" : "false");
  });
  els.statView.textContent =
    mode === "split" ? "Split" : mode === "source" ? "Source" : "Preview";
}

function renderDocList() {
  const q = filter.trim().toLowerCase();
  const docs = vault.documents.filter((d) => !q || d.title.toLowerCase().includes(q));

  els.docList.innerHTML = "";
  for (const d of docs) {
    const row = document.createElement("div");
    row.className = "doc-item" + (d.id === vault.activeId ? " active" : "");
    row.dataset.id = d.id;
    row.innerHTML = `<span class="doc-title"></span><button type="button" class="doc-del" title="Delete note" aria-label="Delete ${d.title}">×</button>`;
    row.querySelector(".doc-title").textContent = d.title;
    row.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.closest(".doc-del")) return;
      selectDoc(d.id);
    });
    row.querySelector(".doc-del").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteDoc(d.id);
    });
    els.docList.appendChild(row);
  }
}

function selectDoc(id) {
  if (id === vault.activeId) return;
  syncActiveFromEditor();
  saveVault(vault);
  vault.activeId = id;
  saveVault(vault);
  const d = vault.documents.find((x) => x.id === id);
  if (d) els.editor.value = d.content;
  renderDocList();
  scheduleRender();
  updateStatus();
}

function newDoc() {
  syncActiveFromEditor();
  saveVault(vault);
  const id = crypto.randomUUID();
  const d = {
    id,
    title: "Untitled",
    content: "# Untitled\n\n",
    updatedAt: Date.now(),
  };
  vault.documents.push(d);
  vault.activeId = id;
  saveVault(vault);
  els.editor.value = d.content;
  renderDocList();
  scheduleRender();
  updateStatus();
  els.editor.focus();
}

function deleteDoc(id) {
  if (vault.documents.length <= 1) return;
  if (!confirm("Delete this note?")) return;
  syncActiveFromEditor();
  saveVault(vault);
  vault.documents = vault.documents.filter((d) => d.id !== id);
  if (vault.activeId === id) vault.activeId = vault.documents[0].id;
  saveVault(vault);
  const d = activeDoc();
  els.editor.value = d.content;
  renderDocList();
  scheduleRender();
  updateStatus();
}

function syncActiveFromEditor() {
  const d = activeDoc();
  if (!d) return;
  d.content = els.editor.value;
  const firstLine = d.content.split(/\r?\n/)[0] || "";
  const m = /^#+\s+(.+)$/.exec(firstLine.trim());
  if (m) d.title = m[1].trim().slice(0, 80) || d.title;
}

const saveVaultDebounced = debounce(() => {
  saveVault(vault);
}, 500);

async function renderPreviewNow() {
  if (!els.preview || !els.editor) return;
  try {
    renderDocList();
    const raw = els.editor.value;
    let html;
    try {
      html = md.render(preprocessWikilinks(raw));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      els.preview.innerHTML = `<div class="markdown-body"><p><strong>Markdown render error</strong></p><pre class="hljs" style="padding:1rem;border-radius:8px">${escapeHtml(msg)}</pre></div>`;
      updateStatus();
      return;
    }
    els.preview.innerHTML = `<div class="markdown-body">${html}</div>`;
    try {
      await mermaid.run({ querySelector: "#preview .mermaid" });
    } catch (_) {
      /* invalid diagram syntax */
    }
    try {
      renderOutline(raw);
    } catch (_) {
      els.outlineList.innerHTML =
        '<li class="outline-empty" style="color:var(--danger);font-size:13px;padding:0.4rem">Could not build outline</li>';
    }
    updateStatus();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    els.preview.innerHTML = `<div class="markdown-body"><p><strong>Preview error</strong></p><pre class="hljs" style="padding:1rem;border-radius:8px">${escapeHtml(msg)}</pre></div>`;
  }
}

const scheduleRender = debounce(() => {
  void renderPreviewNow();
}, 120);

function renderOutline(text) {
  const heads = parseHeadingsFromMd(text);
  els.outlineList.innerHTML = "";
  if (!heads.length) {
    els.outlineList.innerHTML =
      '<li class="outline-empty" style="color:var(--text-muted);font-size:13px;padding:0.4rem">No headings yet</li>';
    return;
  }
  for (const h of heads) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.textContent = h.text;
    a.className = `outline-h${h.level}`;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const el = els.preview.querySelector(`#${CSS.escape(h.id)}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    li.appendChild(a);
    els.outlineList.appendChild(li);
  }
}

function updateStatus() {
  const content = els.editor.value;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const { line, col } = getCaretLineCol(els.editor);
  els.statLn.textContent = `Ln ${line}, Col ${col}`;
  els.statWords.textContent = `${words} words`;
  els.statRead.textContent = `~${readingMinutes(words)} min read`;
}

function openDocByTitle(title) {
  const t = title.trim().toLowerCase();
  const found = vault.documents.find((d) => d.title.toLowerCase() === t);
  if (found) {
    selectDoc(found.id);
    return;
  }
  if (confirm(`No note titled "${title}". Create it?`)) {
    syncActiveFromEditor();
    saveVault(vault);
    const id = crypto.randomUUID();
    const d = {
      id,
      title,
      content: `# ${title}\n\n`,
      updatedAt: Date.now(),
    };
    vault.documents.push(d);
    vault.activeId = id;
    saveVault(vault);
    els.editor.value = d.content;
    renderDocList();
    scheduleRender();
    updateStatus();
  }
}

function openFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".md,.markdown,.txt";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      syncActiveFromEditor();
      saveVault(vault);
      const text = String(reader.result || "");
      const id = crypto.randomUUID();
      const base = file.name.replace(/\.[^/.]+$/, "") || "Imported";
      const d = {
        id,
        title: base.slice(0, 80),
        content: text,
        updatedAt: Date.now(),
      };
      vault.documents.push(d);
      vault.activeId = id;
      saveVault(vault);
      els.editor.value = d.content;
      renderDocList();
      scheduleRender();
      updateStatus();
    };
    reader.readAsText(file);
  };
  input.click();
}

function downloadMarkdown() {
  syncActiveFromEditor();
  saveVault(vault);
  const d = activeDoc();
  if (!d) return;
  const blob = new Blob([els.editor.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${d.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "note"}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportHtml() {
  syncActiveFromEditor();
  saveVault(vault);
  const raw = els.editor.value;
  const bodyHtml = md.render(preprocessWikilinks(raw));
  const title = activeDoc()?.title || "Document";
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${MarkdownIt.utils.escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.0/github-markdown.min.css">
  <style>
    body { margin: 0; background: #fff; }
    .markdown-body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 2rem; }
  </style>
</head>
<body>
  <div class="markdown-body">${bodyHtml}</div>
</body>
</html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9-_]+/gi, "-") || "export"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function wirePreview() {
  els.preview.addEventListener("click", (e) => {
    const a = /** @type {HTMLElement | null} */ (e.target.closest("a.wikilink"));
    if (!a) return;
    e.preventDefault();
    const t = a.getAttribute("data-wiki");
    if (t) openDocByTitle(t);
  });
}

function wireFormat() {
  const afterFmt = () => {
    syncActiveFromEditor();
    saveVaultDebounced();
    scheduleRender();
  };
  document.getElementById("fmt-bold").addEventListener("click", () => {
    insertAround(els.editor, "**", "**");
    afterFmt();
  });
  document.getElementById("fmt-italic").addEventListener("click", () => {
    insertAround(els.editor, "*", "*");
    afterFmt();
  });
  document.getElementById("fmt-code").addEventListener("click", () => {
    insertAround(els.editor, "`", "`");
    afterFmt();
  });
  document.getElementById("fmt-link").addEventListener("click", () => {
    insertAround(els.editor, "[", "](url)");
    afterFmt();
  });
  document.getElementById("fmt-h1").addEventListener("click", () => {
    insertLinePrefix(els.editor, "# ");
    afterFmt();
  });
  document.getElementById("fmt-ul").addEventListener("click", () => {
    insertLinePrefix(els.editor, "- ");
    afterFmt();
  });
  document.getElementById("fmt-quote").addEventListener("click", () => {
    insertLinePrefix(els.editor, "> ");
    afterFmt();
  });
}

function wireViewButtons() {
  document.querySelectorAll(".btn-view").forEach((b) => {
    b.addEventListener("click", () => {
      const mode = /** @type {string} */ (b.getAttribute("data-view"));
      setViewMode(mode);
    });
  });
}

function wireMobile() {
  els.toggleSidebar.addEventListener("click", () => {
    els.app.classList.toggle("sidebar-open");
    els.app.classList.remove("outline-open");
  });
  els.toggleOutline.addEventListener("click", () => {
    els.app.classList.toggle("outline-open");
    els.app.classList.remove("sidebar-open");
  });
  els.backdrop.addEventListener("click", () => {
    els.app.classList.remove("sidebar-open", "outline-open");
  });
}

els.search.addEventListener("input", () => {
  filter = els.search.value;
  renderDocList();
});

els.editor.addEventListener("input", () => {
  syncActiveFromEditor();
  saveVaultDebounced();
  scheduleRender();
});

els.editor.addEventListener("click", updateStatus);
els.editor.addEventListener("keyup", updateStatus);
els.editor.addEventListener("select", updateStatus);

document.getElementById("btn-new").addEventListener("click", newDoc);
document.getElementById("btn-open").addEventListener("click", openFile);
document.getElementById("btn-save").addEventListener("click", downloadMarkdown);
document.getElementById("btn-export-html").addEventListener("click", exportHtml);
els.themeBtn.addEventListener("click", cycleTheme);

document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === "s") {
    e.preventDefault();
    downloadMarkdown();
  }
  if (mod && e.key.toLowerCase() === "b") {
    e.preventDefault();
    insertAround(els.editor, "**", "**");
    syncActiveFromEditor();
    saveVaultDebounced();
    scheduleRender();
  }
});

window.addEventListener("beforeunload", () => {
  syncActiveFromEditor();
  saveVault(vault);
});

window.newDocument = newDoc;
window.openDocument = openFile;
window.saveDocument = downloadMarkdown;
window.exportDocument = exportHtml;

function init() {
  if (!els.app || !els.preview || !els.editor) {
    return;
  }

  els.themeBtn.setAttribute("aria-label", "Cycle theme");
  setTheme(getStoredTheme());
  setViewMode(getViewMode());

  const d = activeDoc();
  els.editor.value = d.content;

  wirePreview();
  wireFormat();
  wireViewButtons();
  wireMobile();

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getStoredTheme() === "system") setTheme("system");
    });
  }

  void renderPreviewNow();
}

init();
