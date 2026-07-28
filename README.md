# SEO GenHub

A full-stack, AI-powered SEO Content Automation tool designed for SEO agencies.

## Features
- **Client Manager**: Manage distinct tone, audience, and brand voice guidelines per client.
- **SERP Analysis**: Pulls top competitors and PAA questions via SerpAPI.
- **Multi-Step Generation**: Brief → Outline → Section-by-section streaming generation.
- **EEAT Polish**: Automatically generates FAQ Schema (JSON-LD), internal links, and Meta Tags.
- **Export**: Download as HTML (with schema) or DOCX.

## Local Setup

### Backend (Node.js + Express + SQLite)
1. `cd backend`
2. `npm install`
3. Create `.env` from `.env.example` and add your keys (Anthropic & SerpAPI).
4. `npm run dev`

### Frontend (React + Vite)
1. `cd frontend`
2. `npm install`
3. Create `.env` and add `VITE_API_URL=http://localhost:3001/api`
4. `npm run dev`

## Deployment

### Backend (Render)
This project is configured for [Render.com](https://render.com).
1. Create a new Web Service on Render and link your GitHub repo.
2. Select the `backend` folder as the Root Directory.
3. Render will automatically read the `render.yaml` file to provision the Node.js server and a **1GB Persistent Disk** for the SQLite database.
4. Add your `ANTHROPIC_API_KEY` and `SERP_API_KEY` in the Render dashboard.

### Frontend (Vercel)
This project is configured for [Vercel](https://vercel.com).
1. Import the project into Vercel.
2. Set the Root Directory to `frontend`.
3. Vercel will automatically use Vite to build the project and `vercel.json` to handle React Router SPA routing.
4. Add the Environment Variable `VITE_API_URL` pointing to your deployed Render backend URL.
