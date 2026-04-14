# Markdown Studio

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20macOS%20%7C%20Linux-blue?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Framework-Vanilla%20JS-orange?style=for-the-badge" alt="Framework">
</p>

<p align="center">
  <strong>📝 A beautiful, lightning-fast Markdown editor for the modern web</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#usage">Usage</a> •
  <a href="#keyboard-shortcuts">Shortcuts</a> •
  <a href="#markdown-syntax">Markdown Syntax</a>
</p>

---

## ✨ Features

- **🎨 Live Preview** - See your markdown rendered in real-time as you type
- **🌙 Dark Mode** - Automatic dark/light theme based on your system preferences
- **📤 Export Options** - Export to HTML with beautiful styling
- **📁 File Operations** - Open and save markdown files locally
- **⚡ Fast** - Pure vanilla JavaScript, no dependencies
- **📱 Responsive** - Works beautifully on desktop and mobile
- **🎯 Apple Design** - Clean, native-feeling interface

---

## 🚀 Quick Start

### Option 1: Open Directly (Easiest)

```bash
# Simply open in your browser
open web/index.html
```

### Option 2: Local Server (Recommended)

```bash
# Using Python
cd web && python3 -m http.server 8080

# Using Node.js
npx serve web

# Using PHP
cd web && php -S localhost:8080
```

Then open [http://localhost:8080](http://localhost:8080)

---

## 📸 Screenshots

### Light Mode
![Markdown Studio - Light Mode](screenshots/light-mode.png)

### Dark Mode
![Markdown Studio - Dark Mode](screenshots/dark-mode.png)

### Split View Editor
![Markdown Studio - Editor](screenshots/editor.png)

### Code Highlighting
![Markdown Studio - Code](screenshots/code.png)

---

## 🎯 Usage

### Writing Markdown

1. **Type in the left pane** - Your markdown code goes here
2. **See the preview on the right** - Instantly rendered HTML
3. **Changes are real-time** - No need to refresh or click anything

### Opening a File

1. Click the **Open** button in the toolbar
2. Select a `.md`, `.markdown`, or `.txt` file
3. Your file loads instantly in the editor

### Saving Your Work

1. Click the **Save** button in the toolbar
2. Your browser will download the file as `document.md`

### Exporting to HTML

1. Click the **Export** button
2. Choose format (HTML recommended)
3. Your beautifully styled HTML document downloads

---

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Document | (Click "New" button) |
| Open File | (Click "Open" button) |
| Save File | (Click "Save" button) |
| Export | (Click "Export" button) |

---

## 📖 Markdown Syntax

Markdown Studio supports standard markdown syntax plus GitHub Flavored Markdown (GFM).

### Headers

```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

### Text Formatting

```markdown
**Bold text**
*Italic text*
~~Strikethrough~~
`Inline code`
```

### Lists

```markdown
- Unordered item
- Another item
  - Nested item

1. Ordered item
2. Second item
   1. Nested ordered
```

### Links & Images

```markdown
[Link text](https://example.com)
![Alt text](image-url.png)
```

### Code Blocks

````markdown
```javascript
function hello() {
  console.log("Hello!");
}
```
````

### Blockquotes

```markdown
> This is a blockquote.
> It can span multiple lines.
```

### Tables

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### Horizontal Rules

```markdown
---
```

---

## 🛠️ Technical Details

### Built With

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS variables
- **JavaScript** - Pure vanilla JS, zero dependencies
- **No Build Step** - Just open and use

### Browser Support

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

### Performance

- First paint: < 100ms
- No external dependencies
- Total size: < 15KB
- Works offline

---

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

This project is MIT licensed.

---

<p align="center">
  Made with ❤️ for the markdown community
</p>
