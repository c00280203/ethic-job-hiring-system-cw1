# Fairness by Design — Can AI Hire Fairly?

An interactive, open-source, bilingual (English / Chinese) educational website about fairness in
automated recruitment. It explains three mechanisms that make algorithmic hiring unfair —
**Bayesian cumulative advantage**, the **Matthew Effect**, and **Simpson's Paradox** — then
turns the argument into two tools: an **AI CV fairness checker** and a **CV builder** that
generates a clean, editable DOCX in the browser.

**Live site:** <https://fairnessbydesign.top>

Built for **PSP405TC · Ethics, Privacy and Artificial Intelligence in Society**
(XJTLU, Semester 1, 2026–27). Free, open source, no sign-up, nothing stored.

---

## Contents

1. [Why this site exists](#1-why-this-site-exists)
2. [The argument, in four moves](#2-the-argument-in-four-moves)
3. [What is on the page](#3-what-is-on-the-page)
4. [The CV tools](#4-the-cv-tools)
5. [Ethics and privacy by design](#5-ethics-and-privacy-by-design)
6. [How the AI is wired (and protected)](#6-how-the-ai-is-wired-and-protected)
7. [Tech stack](#7-tech-stack)
8. [Repository layout](#8-repository-layout)
9. [Run it locally](#9-run-it-locally)
10. [Deploy it](#10-deploy-it)
11. [Accessibility and bilingual design](#11-accessibility-and-bilingual-design)
12. [Team](#12-team)
13. [References](#-references)
14. [License and disclaimer](#-license-and-disclaimer)

---

## 1. Why this site exists

Recruitment is where abstract AI-ethics questions become concrete. A hiring model is not a
neutral efficiency tool: it is a rule system that decides who gets an interview, and every
weight it assigns distributes opportunity. Yet the debate is usually conducted in the
vocabulary of engineering metrics (demographic parity, equalised odds) or in the vocabulary
of law, neither of which is how a candidate experiences being screened out.

This site takes a different route. It starts from the philosophical question — *what would
fairness even mean here?* — and then shows, with interactive models rather than assertions,
how small statistical effects compound into structural disadvantage. Finally it hands the
visitor the tools to inspect their own situation: what a machine might see in *their* CV,
and how to write one that is both honest and harder to misread.

Four ethical traditions run underneath the whole site (utilitarian, deontological, virtue,
and Confucian), because they disagree about what fairness *is*, and that disagreement is the
point rather than an obstacle.

## 2. The argument, in four moves

| # | Section | Question it answers | Interaction |
|---|---|---|---|
| 01 | **The pool is never neutral** | How does a small early advantage become near-certainty? | Adjust a prior and per-round evidence strength; watch the posterior curve bend upward |
| 02 | **Rules manufacture "talent"** | Why does advantage persist once inside the pool? | Compare two candidates under a "neutral" rule; see the gap widen across selection rounds |
| 03 | **Numbers can lie both ways** | How can measurement hide or invert a real disparity? | Rebuild the 1973 Berkeley admissions table and watch the aggregate trend flip when data are stratified |
| 04 | **Governance by design** | If the gap cannot be erased, what can be done? | A three-level checklist (technical / expressive / institutional) with live progress |

The first two sections are the mechanism; the third is the epistemology; the fourth is the
remedy. All four are built as small simulations driven by real parameters, not as
decorative illustrations — there is not a single static image in this repository.

## 3. What is on the page

- **Hero** — thesis statement and two entry points ("Start exploring" / "Check my CV").
- **01 Bayesian cumulative advantage** — an interactive posterior-updating model. Each
  positive signal raises the posterior probability of the next success, so early advantage
  becomes self-reinforcing rather than merely lucky.
- **02 The Matthew Effect** — two candidates, one rule, repeated rounds. Institutional rules
  quietly reward accumulated advantage and then read it back as natural talent. Anchored in
  the relative-age effect in Canadian youth hockey.
- **03 Simpson's Paradox** — the Berkeley 1973 admissions data rebuilt as an interactive
  table: 44% of men and 35% of women admitted in aggregate, while most departments slightly
  favoured women. Presentation, the section argues, is part of fairness.
- **04 Governance by design** — captions and alternative assessment channels, human review,
  published stratified rates with base rates and uncertainty, and an appeal route that a
  candidate can actually find.
- **05 CV fairness checker** — see below.
- **06 CV builder** — see below.

## 4. The CV tools

### 05 · CV fairness checker

Upload a PDF / DOCX / TXT or paste text. **Parsing happens entirely in the browser**
(pdf.js and mammoth), the text is de-identified client-side, and only then is it sent to the
model. The checker asks one question: *how might an automated screening system misread this
CV?* It reports 4–6 findings across five lenses, each with a risk level, what a biased screen
would conclude, and a concrete counterfactual suggestion:

1. **Keyword-match gaming** — a broad career with few matching keywords loses to a CV tuned
   to the job description.
2. **Proxy variables** — wording that stands in for a protected attribute (gender, age,
   family status, religion, health) and triggers unfair down-weighting.
3. **Non-linear paths** — career breaks, self-taught skills, career changes that naive models
   read as instability.
4. **Privacy and format** — sensitive data still present, or layout that parsers fail on.
5. **Counterfactual advice** — "what would have changed the outcome", per finding.

The output is deliberately *about the screen, not the person*: the system prompt forbids
judging the candidate and requires dignity-preserving language.

### 06 · CV builder

A guided form (career objective, work experience with repeatable entries, education,
activities, hobbies) produces a live preview and an **editable DOCX** with a photo
placeholder on the left and a right-aligned contact block for name, gender, phone, email and
address. The DOCX is generated **client-side with no dependencies**: a hand-written ZIP
writer (STORED entries + CRC-32) plus a pure OOXML template module, so nothing is uploaded
anywhere.

Every free-text field has an **✨ AI polish** action: one compact, truthful rewrite that keeps
the user's facts and strips proxy wording. Polite refusals and an undo toast keep the writer
in control.

## 5. Ethics and privacy by design

| Principle | How it is implemented |
|---|---|
| **Free and open** | MIT licensed, no accounts, no paywall, no ads |
| **Nothing stored** | No database, no cookies, no analytics, no logging of CV content |
| **Local-first parsing** | PDF/DOCX extraction runs in the browser; the file never leaves the device |
| **Data minimisation** | Only de-identified text is sent; hard caps of 15,000 characters (CV), 500 (question), 800 (polish) |
| **Transparency** | Prompts, lenses and rate limits are in `lib/ai-core.js` and readable by anyone |
| **Contestability** | Every finding must include a counterfactual the candidate could act on |
| **No false authority** | The assistant refuses off-topic requests and never claims to be a licensed adviser |

Data flow, stated plainly:

```
your file  →  parsed in your browser  →  de-identified text  →  our proxy  →  DeepSeek API
   (never uploaded)                        (the only thing sent)      (key stays server-side)
```

Nothing is written to disk at any point on the server; the proxy is stateless.

## 6. How the AI is wired (and protected)

All model traffic goes through a single platform-agnostic core, `lib/ai-core.js`, which is
wrapped twice so the same logic runs on two platforms:

- `api/ai.js` — Vercel serverless function (CommonJS wrapper)
- `edge-functions/api/ai.js` — Tencent EdgeOne Pages edge function (ESM, route `/api/ai`)
- `server.js` — local development server that serves the static site *and* the same route

The **DeepSeek API key never appears in this repository**. It lives only in a platform
environment variable, and the proxy enforces:

1. **CORS allow-list** (`ALLOWED_ORIGINS`) — other sites cannot spend your quota
2. **Per-IP rate limiting** — 12 requests / 10 minutes, shared across the three modes
3. **Hard input caps** — 15,000 / 500 / 800 characters
4. **Strict system prompts and capped output tokens** — no general-purpose chat abuse
5. **No key material in any error message or log**

Three modes: `cv` (bias audit, JSON schema enforced), `ask` (topic-bounded Q&A), `polish`
(single-field rewrite). Even if you copy this repository, you get no key.

## 7. Tech stack

- **Vanilla JavaScript**, no framework, no build step, no bundler
- **Hand-written CSS** (system font stack, monochrome + one accent), no CSS framework
- **Zero-dependency DOCX generation** (ZIP writer + OOXML template)
- **pdf.js** and **mammoth.js** vendored locally for in-browser parsing
- **DeepSeek `deepseek-chat`** via a server-side proxy
- **Deployment**: Vercel (global) and Tencent EdgeOne Pages (mainland China reachability)

## 8. Repository layout

```
fairness-by-design/
├── index.html                 # all content and sections
├── css/style.css              # visual system (minimal, monochrome + one accent)
├── js/i18n.js                 # English / Chinese dictionary and language toggle
├── js/main.js                 # Bayes / Matthew / Simpson / governance interactives
├── js/cv.js                   # CV upload, local parsing, AI calls, result rendering
├── js/builder.js              # CV builder: form → live preview → DOCX
├── js/docx-zip.js             # dependency-free ZIP writer (STORED + CRC-32)
├── js/docx-template.js        # pure OOXML document builder
├── api/ai.js                  # Vercel serverless proxy (thin wrapper)
├── edge-functions/api/ai.js   # EdgeOne Pages edge function (route /api/ai)
├── lib/ai-core.js             # shared proxy logic: prompts, limits, rate limiting
├── server.js                  # local dev server (static site + /api/ai)
├── vendor/                    # pdf.js, mammoth.js (third-party, see references)
├── vercel.json                # explicit static builds + /api/ai route + security headers
└── .env.example               # environment variable template
```

## 9. Run it locally

```bash
cp .env.example .env      # then put your own DeepSeek key in .env
node server.js            # http://localhost:3000 — full site + working AI
```

`.env` is git-ignored and is never needed in production.

```
DEEPSEEK_API_KEY=sk-...
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

Opening `index.html` directly from the filesystem also works for the static content; the page
detects the missing API and tells you to run the local server for AI features.

## 10. Deploy it

**Vercel** (site + API in one project)

1. Import the repository, framework preset **Other**, no build command
2. Add `DEEPSEEK_API_KEY`, and optionally `ALLOWED_ORIGINS` (comma-separated)
3. Deploy

`vercel.json` declares the static assets explicitly and maps `/api/ai` to the function, so
the project is never mistaken for a Node application.

**Tencent EdgeOne Pages** (better reachability from mainland China)

1. Import the repository, framework **Other**, no build command
2. `edge-functions/` is detected and mapped to `/api/ai` automatically
3. Add `DEEPSEEK_API_KEY` as an environment variable, then deploy

> `*.vercel.app` is DNS-polluted in mainland China. A custom domain (or EdgeOne) is required
> for stable access there. The production site uses a custom domain pointing at Vercel.

**Safety net:** set a monthly spending limit on the DeepSeek platform.

## 11. Accessibility and bilingual design

- Full English / Chinese parity — every string, including AI responses, follows the active language
- Keyboard-reachable controls, visible focus states, `prefers-reduced-motion` respected
- Semantic headings and a linear reading order that works without the interactive layer
- No colour-only meaning: risk levels carry text labels, not just red/amber/green

## 12. Team

| Name | Student ID |
|---|---|
| Zihan Wang | 2693668 |
| Yibo Xu | 2686327 |
| Zhuoyi Ye | 2686467 |

Module: **PSP405TC Ethics, Privacy and Artificial Intelligence in Society**, XJTLU,
Semester 1, 2026–27.

---

## ✦ References

Two kinds of sources sit behind this site: the **scholarly literature** that the argument
rests on, and the **technical documentation** that the implementation rests on. Everything
below was actually consulted; nothing is cited for decoration.

Every entry was checked against the publisher, the DOI record, or an authoritative index
before publication; DOIs and stable URLs are given wherever they exist. Item numbers are
this README's own — the accompanying essay uses a separate numbering. Where a claim rests
on secondary reporting rather than a primary document, that is stated explicitly rather
than implied.

### A. Core literature on algorithmic bias and fairness metrics

These underpin sections 02–04 and the fairness lenses in the CV checker.

1. S. Barocas and A. D. Selbst, "Big data's disparate impact," *California Law Review*,
   vol. 104, no. 3, pp. 671–732, 2016. — how data mining inherits and launders historical
   discrimination.
2. M. Hardt, E. Price, and N. Srebro, "Equality of opportunity in supervised learning,"
   in *Advances in Neural Information Processing Systems 29* (NeurIPS), 2016,
   pp. 3315–3323. — equalised odds; why "fairness" needs a chosen criterion.
3. C. Dwork, M. Hardt, T. Pitassi, O. Reingold, and R. Zemel, "Fairness through awareness,"
   in *Proc. 3rd Innovations in Theoretical Computer Science Conference (ITCS)*, 2012,
   pp. 214–226, doi:10.1145/2090236.2090255. — individual fairness and the limits of
   group-level parity.
4. J. M. Kleinberg, S. Mullainathan, and M. Raghavan, "Inherent trade-offs in the fair
   determination of risk scores," arXiv:1609.05807, 2016. — the impossibility result the
   governance section responds to.
5. S. Wachter, B. Mittelstadt, and C. Russell, "Counterfactual explanations without opening
   the black box: Automated decisions and the GDPR," *Harvard Journal of Law & Technology*,
   vol. 31, no. 2, pp. 841–887, 2018. — the basis for the "what would have changed the
   outcome" advice format.

### B. The three mechanisms

6. R. K. Merton, "The Matthew Effect in Science," *Science*, vol. 159, no. 3810, pp. 56–63,
   1968, doi:10.1126/science.159.3810.56. — the original statement of cumulative advantage
   that section 02 dramatises.
7. E. H. Simpson, "The interpretation of interaction in contingency tables," *Journal of the
   Royal Statistical Society: Series B*, vol. 13, no. 2, pp. 238–241, 1951,
   doi:10.1111/j.2517-6161.1951.tb00088.x. — the original statement of the paradox rebuilt
   in section 03.
8. T. Bayes, "An essay towards solving a problem in the doctrine of chances," *Philosophical
   Transactions of the Royal Society of London*, vol. 53, pp. 370–418, 1763. — the posterior
   update model behind section 01.
9. R. H. Barnsley, A. H. Thompson, and P. E. Barnsley, "Hockey success and birthdate: The
   relative age effect," *CAHPER Journal*, vol. 51, no. 8, pp. 23–28, 1985. — the empirical
   illustration used in section 02.

### C. Empirical cases and data

10. P. J. Bickel, E. A. Hammel, and J. W. O'Connell, "Sex bias in graduate admissions: Data
    from Berkeley," *Science*, vol. 187, no. 4175, pp. 398–404, 7 Feb. 1975,
    doi:10.1126/science.187.4175.398. — the dataset rebuilt as the interactive table in
    section 03: 8,442 male applicants admitted at 44%, 4,321 female applicants at 35%,
    while the six largest departments admitted women at equal or higher rates.
11. J. Dastin (Reuters), "Amazon ditched AI recruiting tool that favored men for technical
    jobs," *The Guardian*, 10 Oct. 2018.
    <https://www.theguardian.com/technology/2018/oct/10/amazon-hiring-ai-gender-bias-recruiting-engine>
    — the canonical industry case of a screening model trained on biased history.
12. ACLU of Colorado, discrimination complaint filed with the Colorado Civil Rights Division
    and the U.S. Equal Employment Opportunity Commission against Intuit and its vendor
    HireVue, on behalf of a deaf Indigenous employee ("D.K."), March 2025; reported in
    *Virginia Lawyers Weekly*, 15 Apr. 2025. — the case discussed in §4.4 of the accompanying
    essay, which dates the interview to 2024 and cites it through a secondary source
    (item 32 below). It is the basis for the "captions, alternative channels, human review"
    recommendation. Cited here as reported; the complaint itself is the primary document.

### D. Law, regulation and governance frameworks

13. European Parliament and Council, "Regulation (EU) 2016/679 (General Data Protection
    Regulation)," *Official Journal of the European Union*, L 119, 4 May 2016. — data
    minimisation and retention.
14. High-Level Expert Group on AI, "Ethics Guidelines for Trustworthy AI," European
    Commission, Brussels, Apr. 2019. — the seven requirements referenced in section 04.
15. U.S. Congress, "Americans with Disabilities Act of 1990," 42 U.S.C. §12101 et seq. —
    reasonable accommodation.
16. New York City, "Local Law 144 of 2021: Automated Employment Decision Tools," 2021. —
    bias audits and candidate notice.
17. European Parliament and Council, "Regulation (EU) 2024/1689 (Artificial Intelligence
    Act)," *Official Journal of the European Union*, L, 12 Jul. 2024. — recruitment as a
    high-risk use.
18. Standing Committee of the NPC, "Personal Information Protection Law of the People's
    Republic of China," 2021. — the Chinese regime referenced alongside GDPR.

### E. Ethics textbooks and course materials

19. B. C. Stahl, D. Schroeder, and R. Rodrigues, *Ethics of Artificial Intelligence: Case
    Studies and Options for Addressing Ethical Challenges*. Cham, Switzerland: Springer,
    2023, doi:10.1007/978-3-031-17040-9. — the case-study method used throughout.
20. S. Baase and T. Henry, *A Gift of Fire: Social, Legal, and Ethical Issues for Computing
    Technology*, 5th ed. Pearson, 2017. — background on employment, discrimination and
    professional responsibility.
21. J. Fjeld, N. Achten, H. Hilligoss, A. Nagy, and M. Srikumar, "Principled Artificial
    Intelligence: Mapping Consensus in Ethical and Rights-Based Approaches to Principles
    for AI," Berkman Klein Center Research Publication No. 2020-1, Harvard University,
    15 Jan. 2020. <https://cyber.harvard.edu/publication/2020/principled-ai> — the eight
    recurring themes it identifies (privacy; accountability; safety and security;
    transparency and explainability; fairness and non-discrimination; human control of
    technology; professional responsibility; promotion of human values), which structure
    the governance checklist.
22. *PSP405TC Module Handbook* and *Module Specification*, XJTLU, 2026–27 (internal teaching
    materials) — module framing and assessment criteria.

### F. Technical documentation and open-source components

23. DeepSeek, *API Documentation* (chat completions, `deepseek-chat`), 2026.
    <https://api-docs.deepseek.com/>
24. Mozilla, *PDF.js* — Apache License 2.0. <https://mozilla.github.io/pdf.js/>
25. M. Williamson, *Mammoth.js* — BSD-2-Clause, DOCX → HTML conversion.
    <https://github.com/mwilliamson/mammoth.js>
26. Ecma International, *ECMA-376: Office Open XML File Formats* — the OOXML structure
    emitted by `js/docx-template.js`.
    <https://ecma-international.org/publications-and-standards/standards/ecma-376/>
27. IETF, *RFC 1951: DEFLATE Compressed Data Format Specification* — the compression and
    integrity basis of the hand-written ZIP writer in `js/docx-zip.js`.
    <https://www.rfc-editor.org/rfc/rfc1951>

### G. Other web sources cited in the accompanying essay

These were used for context and illustration rather than as scholarly evidence; they are
listed for completeness because the essay cites them.

28. N. Wilson, "Google DeepMind hires Cambridge academic for new 'Philosopher' role,"
    *Varsity*, 25 Apr. 2026. <https://www.varsity.co.uk/news/31572>
29. Anthropic, "Claude's Constitution," 2026. <https://www.anthropic.com/constitution>
    (the page carries no publication date; the accompanying essay dates it January 2026)
30. "Patrick Collison," *Wikipedia*, accessed Oct. 2026.
    <https://en.wikipedia.org/wiki/Patrick_Collison>
31. CSDN Blog, "AI interview systems: technical analysis and a 2026 review of the top five
    products" (in Chinese), 21 Aug. 2026.
    <https://blog.csdn.net/weixin_31100517/article/details/163965392> — an industry overview
    and vendor comparison; used for background, not as verified evidence.
32. Toutiao (DEI channel), report on the Workday AI recruitment discrimination case
    (in Chinese), 17 Jun. 2025. <https://www.toutiao.com/article/7516457593280234034/>
    — the essay's source for the HireVue/Intuit complaint in item 12; the article's own
    sourcing is secondary (it cites Reuters and other outlets).

### How to cite this site

```
Wang, Z., Xu, Y., & Ye, Z. (2026). Fairness by Design: Can AI Hire Fairly?
An interactive explainer on algorithmic fairness in automated recruitment.
https://fairnessbydesign.top
```

---

## License and disclaimer

Source code released under the **MIT License**. The written content is shared for
educational use with attribution.

The CV checker is an **educational demonstration**, not professional career, legal or
medical advice. It predicts how a screening system *might* misread a CV; it does not score
the person. Please do not upload documents containing sensitive personal data — the site
stores nothing, but the analysis is only as meaningful as the text you choose to share.

Every visual on this page is interactive code. There are no images in this repository.
