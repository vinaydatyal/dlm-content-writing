# Content Writing Tool - Developer Notes

This document serves as a technical reference guide for the SEO Content Tool application, detailing its architecture, API integrations, and system quirks.

## 🏗️ Architecture Overview

The application is a split-stack JavaScript application:
- **Frontend**: React + Vite (Port 3002)
- **Backend**: Node.js + Express + SQLite (Port 3001)

### Core Technologies
- **Styling**: Vanilla CSS (`frontend/src/index.css`) with a custom modern design system (glassmorphism, dark mode, CSS variables).
- **Database**: SQLite (`backend/db.js`). Lightweight, local, file-based database (`database.sqlite`).
- **Routing**: `react-router-dom` on the frontend, Express routers on the backend.
- **Authentication**: JWT-based authentication (`backend/middleware/auth.js`).

---

## 🔍 SERP Scraper Engine (The Waterfall Strategy)

The backend features a highly resilient, three-tier "waterfall" SERP scraping engine in `backend/routes/serp.js` to avoid API costs and handle CAPTCHAs.

1. **Tier 1: Puppeteer (Live Chrome Scrape)**
   - **How it works:** Uses `puppeteer-extra` and `puppeteer-extra-plugin-stealth` to boot a headless Chrome instance and scrape Google directly.
   - **Why:** 100% free, gets real-time data directly from the DOM.
   - **Quirks:** Google DOM structures change frequently. Extracting Snippets and "People Also Ask" relies on flexible CSS selectors.

2. **Tier 2: SerpAPI Fallback**
   - **How it works:** If Puppeteer fails or hits a CAPTCHA, the code catches the error and instantly falls back to SerpAPI.
   - **Config:** Requires `SERP_API_KEY` in `backend/.env`.

3. **Tier 3: Puter AI Simulation (Last Resort)**
   - **How it works:** If SerpAPI is exhausted or fails, the system asks Puter AI to physically simulate a JSON response of a realistic SERP based on its training data. This prevents the app from crashing.

---

## 🤖 Puter AI Integration

All AI generation (Briefs, Outlines, Content Generation) uses the `@heyputer/puter.js` SDK.

### Important Quirks & Gotchas
- **Auth Initialization:** Puter is initialized using `puter.setAuthToken(process.env.PUTER_API_TOKEN);`. Note that older tutorials might say `puter.auth.setToken`, but the current SDK requires `.setAuthToken` on the root object.
- **AI Chat Call:** To chat with the AI, the correct method is `puter.ai.chat(prompt)`. Do NOT use `puter.chat`.
- **Model Selection:** Do not hardcode the model string (e.g. `{ model: 'claude-3-5-sonnet' }`). Puter occasionally updates their model strings behind the scenes. Leaving the model object out entirely allows Puter to safely use its default (and most capable) conversational model.
- **Response Structure:** Puter returns a structured object, not a raw string. To extract the text properly, use:
  ```javascript
  const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));
  ```
- **Streaming:** The `/api/content/generate` endpoint heavily uses Puter's `{ stream: true }` flag to stream content directly into the `ContentEditor.jsx` window section-by-section.

---

## 🗄️ Database & Data Models

### Client Profiles (`clients.js`)
Client profiles store SEO guardrails (Tone, Banned Words, Competitors). 
- **Gotcha:** `banned_words`, `competitors`, and `internal_urls` are stored as JSON Strings in SQLite. 
- **Fix Applied:** When fetching these from the database, ensure they are parsed using robust `try/catch` JSON parsing so `Array.prototype.join()` doesn't crash on a raw string.

### Projects & Articles
- A **Project** represents the high-level metadata (Keyword, Target Word Count).
- An **Article** row is linked 1:1 with a Project. It stores the progressive state: `serp_data` -> `brief` -> `outline` -> `content`. 
- **Status Enum:** Transitions from `setup` -> `serp` -> `brief` -> `outline` -> `writing` -> `completed`.

---

## 🔌 Other Configured APIs (Optional / Disabled)

Your `backend/.env` file is set up to support a few other APIs that are currently disabled but available for future scaling:

1. **Google Custom Search JSON API (`GOOGLE_CSE_API_KEY`)**
   - Originally intended for SERP scraping. Currently disabled in favor of Puppeteer (which doesn't require a paid API limit) and SerpAPI. 

2. **ValueSERP (`VALUESERP_API_KEY`)**
   - Set up as "Tier 2a" in the `.env` file as an alternative to SerpAPI. It behaves identically to SerpAPI and gives 100 free searches a month.

---

## 🚀 Commands & Scripts

- **Start Frontend:** `npm run dev` in `/frontend`
- **Start Backend:** `npm run dev` in `/backend` (Runs `nodemon` equivalent via `--watch`)

## 🔑 Environment Variables
Your `/backend/.env` requires:
- `JWT_SECRET` (For user sessions)
- `PUTER_API_TOKEN` (For AI generation)
- `SERP_API_KEY` (Tier 2 SERP fallback)

---

## ☁️ Deployment & Cloud Hosting (Render)

The application is fully configured for automated deployment via **Render.com**. 

### Why Render?
The backend relies heavily on **SQLite** (`database.sqlite`). Hosting providers that use serverless architectures (like Vercel) wipe their temporary filesystems after every request, meaning a local SQLite database would be deleted repeatedly. Render allows for **Persistent Disks**, making it the ideal host.

### Blueprint Automation (`render.yaml`)
We use Infrastructure-as-Code via `render.yaml` to automate deployment. 
- **Start / Build Commands:** The `package.json` in the root directory manages installing and building both the frontend and backend using `--prefix`. 
- **Free Tier Limitations:** Currently, `render.yaml` is set to `plan: free` with NO persistent disk attached. **Gotcha:** This means the SQLite database will reset to empty whenever the server spins down due to inactivity (after 15 minutes). 
- **Production Upgrade:** For a production deployment where data persists, edit `render.yaml`, change the plan from `free` to `starter`, and uncomment/add the `disk` block to mount `/data/seo_tool.db`.

### GitHub Branching
Render defaults to deploying from the `main` branch. Ensure code is pushed via `git push origin main`. If you see errors about missing `render.yaml`, ensure your branch isn't named `master` in GitHub, or configure the Render branch dropdown manually.
