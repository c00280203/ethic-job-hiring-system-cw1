# Fairness by Design — Can AI Hire Fairly?

An interactive, open-source, bilingual (EN/中文) educational website about fairness in
automated AI recruitment — Bayesian cumulative advantage, the Matthew Effect and
Simpson's Paradox — ending with a **free CV fairness checker** powered by AI.

Built for **PSP405TC · Ethics, Privacy and Artificial Intelligence in Society**
(XJTLU, Semester 1, 2026–27).

## ✦ Principles

- **100% free & open source** — MIT licensed
- **No sign-up, no tracking, nothing stored** — CV files are parsed *locally in your
  browser*; only the extracted text is analysed, never saved
- **Transparent** — the full source code, the prompts and the fairness lenses are public

## ✦ Structure

```
fairness-by-design/
├── index.html          # all content & sections
├── css/style.css       # visual style (minimal, monochrome + one accent)
├── js/i18n.js          # EN / 中文 dictionary + language toggle
├── js/main.js          # Bayes / Matthew / Simpson / Governance interactives
├── js/cv.js            # CV upload, local parsing, AI calls
├── js/builder.js       # CV Builder: form → live preview → DOCX
├── js/docx-zip.js      # dependency-free ZIP writer (STORED + CRC-32)
├── js/docx-template.js # pure OOXML template builder (testable)
├── api/ai.js           # Vercel serverless proxy (thin wrapper)
├── lib/ai-core.js      # shared proxy logic (rate limit, prompts, caps)
├── server.js           # local dev server (static site + /api/ai)
└── vercel.json         # security headers
```

No images: every visual on the page is an interactive widget.

## ✦ How the AI key is protected (important)

The DeepSeek API key is **never** in this repository. It lives only in a Vercel
**environment variable**, and all AI traffic goes through our serverless proxy
(`api/ai.js`), which enforces:

1. **CORS allow-list** (`ALLOWED_ORIGINS`) — other websites cannot spend your quota
2. **Per-IP rate limiting** — 8 requests / 10 minutes
3. **Hard input caps** — CV ≤ 6,000 chars, questions ≤ 500 chars
4. **Strict system prompts + capped output tokens** — no general-purpose chat abuse
5. **No key in any error message or log**

Even if someone copies this repo, they get no key.

## ✦ Deploy it yourself

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "Fairness by Design"
git remote add origin https://github.com/<you>/fairness-by-design.git
git push -u origin main
```

### 2. Deploy to Vercel (frontend + API together)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
2. Framework preset: **Other** (plain static — zero build settings needed)
3. **Environment Variables** → add:
   - `DEEPSEEK_API_KEY` = your DeepSeek key ([platform.deepseek.com](https://platform.deepseek.com) → API Keys)
   - `ALLOWED_ORIGINS` = `https://<you>.github.io,https://<your-project>.vercel.app`
4. **Deploy**

> Tip: also set a **monthly spending limit** on the DeepSeek platform as a final safety net.

### 3. (Optional) Host the frontend on GitHub Pages instead

GitHub Pages serves only static files, so point the frontend at your Vercel API:
add this line to `index.html` before the `<script>` tags:

```html
<script>window.FBD_API_BASE = "https://<your-project>.vercel.app";</script>
```

## ✦ Local development

```bash
cp .env.example .env   # then put your real key in .env
node server.js         # http://localhost:3000 — full site + working AI
```

For local secrets, create a `.env` file (git-ignored):

```
DEEPSEEK_API_KEY=sk-...
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

## ✦ Team

Zihan Wang (2693668) · Yibo Xu (2686327) · Zhuoyi Ye (2686467)

Data sources: Bickel, Hammel & O'Connell, *Science* (1975); Barnsley, Thompson &
Barnsley, *CAHPER Journal* (1985).

**Disclaimer** — the CV checker is an educational demonstration, not professional
career or legal advice.
