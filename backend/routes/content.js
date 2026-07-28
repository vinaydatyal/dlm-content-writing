// backend/routes/content.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authenticate);

let puter;
async function getPuter() {
  if (!puter) {
    const mod = await import('@heyputer/puter.js');
    puter = mod.puter;
    if (process.env.PUTER_API_TOKEN) {
      puter.setAuthToken(process.env.PUTER_API_TOKEN);
    } else {
      console.warn("WARNING: PUTER_API_TOKEN is not set. API calls might fail.");
    }
  }
  return puter;
}

const YMYL_POLICIES = {
  finance: `
⚠️  YMYL FINANCE/LEGAL COMPLIANCE (Google EAT Guidelines):
- Always recommend consulting a licensed financial advisor or attorney.
- Use hedging language: "may", "could", "generally", "in many cases".
- Cite reputable sources (government sites, established institutions).
- Never make specific investment recommendations or legal guarantees.
- Disclose any limitations of the information provided.
`,
  health: `
⚠️  YMYL HEALTH/MEDICAL COMPLIANCE (Google EAT Guidelines):
- Never provide diagnosis, treatment plans, or prescriptions.
- Always include a disclaimer to consult a qualified healthcare provider.
- Rely on medical consensus and peer-reviewed research; cite sources.
- Use precise phrasing: "research suggests", "some studies show".
- Avoid absolute claims like "this cures" or "this prevents".
`,
};

function parseArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val.split(',').map(s => s.trim()); }
  }
  return [];
}

function buildClientContext(profile) {
  if (!profile) return '';
  const banned = parseArray(profile.banned_words).join(', ');
  const competitors = parseArray(profile.competitors).join(', ');
  const citations = parseArray(profile.preferred_citations);
  const ymyl = YMYL_POLICIES[profile.niche_category] || '';
  const refContent = profile.reference_content ? `
REFERENCE WRITING STYLE (match this style exactly — pacing, vocabulary, sentence structure):
---
${profile.reference_content.slice(0, 1500)}
---
CRITICAL: You MUST mimic the exact brand tone, sentence length, and vocabulary style of the reference content above.` : '';

  const internalUrls = parseArray(profile.internal_urls);
  const internalLinksBlock = internalUrls.length > 0 ? `
INTERNAL LINKS TO WEAVE INTO CONTENT (Find natural opportunities to use these URLs with relevant exact-match or LSI anchor text in Markdown format [anchor text](url)):
${internalUrls.map(u => `- ${u.url || u.keyword || u}`).join('\n')}
` : '';

  const eeatBlock = (profile.author_name || profile.company_credentials) ? `
E-E-A-T AUTHORITY SIGNALS (weave these naturally into the content):
- Author: ${profile.author_name || 'not specified'}${profile.author_credentials ? ` (${profile.author_credentials})` : ''}
- Company Authority: ${profile.company_credentials || 'not specified'}
- When making claims, attribute them to the author's experience or the company's expertise.
- Naturally include phrases like "In our experience...", "After working with [X] clients...", "${profile.author_name || 'Our team'} recommends..." where appropriate.` : '';

  const citationBlock = citations.length > 0 ? `
PREFERRED CITATION SOURCES (use these when referencing statistics or data):
${citations.map(c => `- ${c}`).join('\n')}
IMPORTANT: Every H2 section MUST include at least one specific statistic, data point, or research finding. Format as: "According to [Source], X% of..." or "Research from [Source] shows that..."` : `
CITATION REQUIREMENT: Every H2 section MUST include at least one specific statistic or data point. Use credible sources like HubSpot, Statista, McKinsey, industry reports, or peer-reviewed studies.`;

  return `
CLIENT PROFILE:
- Niche / Industry: ${profile.industry || 'General'} (Category: ${profile.niche_category || 'general'})
- Tone: ${profile.tone || 'professional'}
- Target Audience: ${profile.target_audience || 'general'}
- Brand Voice: ${profile.brand_voice || 'authoritative and helpful'}
- BANNED WORDS (NEVER use these): ${banned || 'none'}
- COMPETITOR BRANDS (NEVER mention, link to, or promote): ${competitors || 'none'}
${refContent}
${eeatBlock}
${citationBlock}
${internalLinksBlock}
${ymyl}`;
}

// ─────────────────────────────────────────
// POST /api/content/brief
// Generate strategic SEO brief from SERP data
// ─────────────────────────────────────────
router.post('/brief', async (req, res) => {
  const { keyword, title, serp_data, content_type, client_profile, target_word_count } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    const ai = await getPuter();
    const serpContext = serp_data ? `
TOP SERP RESULTS:
${(serp_data.top_results || []).slice(0, 5).map(r => `- ${r.title} (${r.url})`).join('\n')}

PEOPLE ALSO ASK:
${(serp_data.people_also_ask || []).map(q => `- ${q}`).join('\n')}

RELATED SEARCHES:
${(serp_data.related_searches || []).map(s => `- ${s}`).join('\n')}

AVERAGE WORD COUNT: ~${serp_data.avg_word_count || 1500} words

${serp_data.content_gaps && serp_data.content_gaps.length > 0 ? `COMPETITOR CONTENT GAPS (Topics competitors cover comprehensively that MUST be included):\n${serp_data.content_gaps.map(g => `- ${g}`).join('\n')}\n` : ''}
` : '';

    const clientContext = buildClientContext(client_profile);

    const prompt = `You are an expert SEO content strategist. Create a comprehensive SEO content brief for the following:

KEYWORD: "${keyword}"
WORKING TITLE: "${title || 'Recommend a good title based on the keyword'}"
CONTENT TYPE: ${content_type || 'blog post'}
TARGET WORD COUNT: ~${target_word_count || 1500} words

${serpContext}
${clientContext}

Generate a strategic SEO brief that includes:
1. **Search Intent Analysis** - What is the user trying to accomplish?
2. **Content Angle** - Unique angle that differentiates from current top results
3. **Target Audience** - Who is this for, and what do they need?
4. **Primary Keyword Usage** - How to naturally use the keyword
5. **Semantic Keywords & LSI Terms** - 10-15 related terms to naturally include
6. **Key Questions to Answer** - Based on PAA and search intent
7. **Competitor Gaps** - What are top results missing?
8. **EEAT Signals** - How to demonstrate expertise and trustworthiness
9. **Tone & Style Guidelines** - How to write this content
10. **Content Structure Notes** - Recommended format (listicle, guide, how-to, etc.)

Format as a clean, structured brief that a writer can follow.`;

    const resp = await ai.ai.chat(prompt);
    const brief = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));
    const tokensUsed = 500; // Puter doesn't always expose token usage perfectly, mocking a standard count

    db.run(
      'INSERT INTO usage_log (user_id, action, tokens_used) VALUES (?, ?, ?)',
      [req.user.id, 'generate_brief', tokensUsed]
    );

    res.json({ brief, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Brief generation error:', err);
    res.status(500).json({ error: 'Failed to generate brief: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/content/outline
// Generate article outline from brief
// ─────────────────────────────────────────
router.post('/outline', async (req, res) => {
  const { keyword, title, brief, content_type, target_word_count, serp_data } = req.body;
  if (!keyword || !brief) return res.status(400).json({ error: 'Keyword and brief are required' });

  try {
    const ai = await getPuter();

    const prompt = `You are an expert SEO content architect. Based on the following brief, create a detailed article outline.

KEYWORD: "${keyword}"
WORKING TITLE: "${title || 'Please recommend and generate a compelling H1 title'}"
CONTENT TYPE: ${content_type || 'blog post'}
TARGET WORD COUNT: ~${target_word_count || 1500} words

CONTENT BRIEF:
${brief}

${serp_data ? `PAA QUESTIONS TO COVER:\n${(serp_data.people_also_ask || []).slice(0, 5).map(q => `- ${q}`).join('\n')}` : ''}

Create a JSON array representing the article outline. Each section should have:
- "type": "h1", "h2", or "h3"
- "heading": the actual heading text
- "notes": brief content notes for this section
- "target_words": estimated word count for this section
- "keywords_to_include": array of 2-4 keywords/phrases to naturally include

The outline must:
1. Include a compelling H1 title (include primary keyword naturally)
2. Have 4-8 H2 sections covering the topic comprehensively
3. Include H3 subsections where appropriate
4. Have an introduction and conclusion
5. Include an FAQ section if applicable

Return ONLY valid JSON array, no other text.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let outline;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      outline = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      outline = parseOutlineFallback(text);
    }

    const tokensUsed = 300;
    db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES (?, ?, ?)',
      [req.user.id, 'generate_outline', tokensUsed]);

    res.json({ outline, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Outline generation error:', err);
    res.status(500).json({ error: 'Failed to generate outline: ' + err.message });
  }
});

function parseOutlineFallback(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const outline = [];
  lines.forEach(line => {
    if (line.startsWith('# ')) {
      outline.push({ type: 'h1', heading: line.replace('# ', ''), notes: '', target_words: 100, keywords_to_include: [] });
    } else if (line.startsWith('## ')) {
      outline.push({ type: 'h2', heading: line.replace('## ', ''), notes: '', target_words: 200, keywords_to_include: [] });
    } else if (line.startsWith('### ')) {
      outline.push({ type: 'h3', heading: line.replace('### ', ''), notes: '', target_words: 150, keywords_to_include: [] });
    }
  });
  return outline;
}

// ─────────────────────────────────────────
// POST /api/content/generate (Streaming)
// Generate content for a specific section
// ─────────────────────────────────────────
router.post('/generate', async (req, res) => {
  const { keyword, section, outline, brief, client_profile, existing_content, custom_instructions } = req.body;
  if (!keyword || !section) return res.status(400).json({ error: 'Keyword and section are required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const ai = await getPuter();

    const clientContext = buildClientContext(client_profile);

    const outlineContext = outline && outline.length > 0
      ? `\nFULL ARTICLE OUTLINE:\n${outline.map(s => `${s.type.toUpperCase()}: ${s.heading}`).join('\n')}`
      : '';

    const prompt = `You are an expert SEO content writer. Write the content for this specific section of an article.

PRIMARY KEYWORD: "${keyword}"
${clientContext}
${outlineContext}

BRIEF SUMMARY: ${brief ? brief.substring(0, 500) + '...' : 'Write comprehensive, helpful content.'}

NOW WRITE THIS SECTION:
Type: ${section.type}
Heading: ${section.heading}
Notes: ${section.notes || 'Write comprehensive content for this section'}
Target Words: ~${section.target_words || 200} words
Include these naturally: ${(section.keywords_to_include || []).join(', ')}

${existing_content ? `PREVIOUSLY WRITTEN CONTENT (for context and continuity):\n${existing_content.substring(existing_content.length - 1000)}` : ''}

Write ONLY the content for this section. Do NOT include the heading. Write in a flowing, natural, human style that reads well. Use markdown formatting where appropriate (bullet points, bold for key terms). Be specific, informative, and engaging. Avoid fluff and filler phrases.

CRITICAL RULES:
1. If this is an H2 section, you MUST include at least one specific statistic, data point, or study finding.
2. ANTI-AI TROPES — YOU MUST NOT USE THESE WORDS/PHRASES:
   - "In today's digital landscape" | "Ultimately" | "Delve" | "Tapestry"
   - "Moreover" | "Furthermore" | "Crucial" | "Testament" | "Navigating" | "Unlock"
3. Vary your sentence structure. Mix short punchy sentences with longer explanatory ones.
4. Never start two consecutive sentences with the same word.

${custom_instructions ? `\nCUSTOM INSTRUCTIONS FOR THIS ARTICLE:\n${custom_instructions}\n` : ''}`;

    const stream = await ai.ai.chat(prompt, { stream: true });

    for await (const chunk of stream) {
      const text = typeof chunk === 'string' ? chunk : (chunk?.text || '');
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    const totalTokens = 500;
    db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES (?, ?, ?)',
      [req.user.id, 'generate_section', totalTokens]);

    res.write(`data: ${JSON.stringify({ done: true, tokens_used: totalTokens })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Content generation error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ─────────────────────────────────────────
// POST /api/content/polish
// Full polish pass: meta, FAQ, internal links, EEAT
// ─────────────────────────────────────────
router.post('/polish', async (req, res) => {
  const { keyword, content, client_profile, internal_urls } = req.body;
  if (!keyword || !content) return res.status(400).json({ error: 'Keyword and content are required' });

  try {
    const ai = await getPuter();

    const prompt = `You are an expert SEO editor. Polish and finalize this article. Return a JSON object with:

1. "meta_title": SEO-optimized title tag (50-60 characters, include keyword)
2. "meta_description": Compelling meta description (150-160 characters, include keyword + CTA)
3. "faq_schema": Array of {question, answer} pairs (5-8 questions covering PAA and user intent)
4. "internal_link_suggestions": Array of {anchor_text, suggested_url, context} - where to add internal links
5. "eeat_suggestions": Array of strings - specific improvements to demonstrate expertise/authority
6. "readability_notes": Brief notes on readability improvements
7. "featured_snippet": A single, concise paragraph (40-60 words) that directly answers the primary query "${keyword}" in a way optimized for Google's Featured Snippet (Position Zero). Be direct, factual, start with a clear definition or answer.
8. "article_schema": A JSON-LD object of @type "Article" with fields: headline, description, datePublished (use today: ${new Date().toISOString().split('T')[0]}), author (@type Person with name), publisher (@type Organization with name).

KEYWORD: "${keyword}"
CLIENT WEBSITE URLS (for internal linking): ${JSON.stringify(internal_urls || [])}

ARTICLE CONTENT:
${content.substring(0, 4000)}

Return ONLY valid JSON.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let polishData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      polishData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      polishData = {
        meta_title: `${keyword} - Complete Guide`,
        meta_description: `Learn everything about ${keyword}. Comprehensive guide with tips, strategies, and best practices.`,
        faq_schema: [],
        internal_link_suggestions: [],
        eeat_suggestions: ['Add expert quotes', 'Include statistics with sources'],
        readability_notes: 'Content looks good',
        featured_snippet: '',
        article_schema: null,
      };
    }

    const tokensUsed = 300;
    db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES (?, ?, ?)',
      [req.user.id, 'polish_content', tokensUsed]);

    res.json({ ...polishData, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Polish error:', err);
    res.status(500).json({ error: 'Failed to polish content: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/content/humanize (Streaming)
// Rewrite the article for human-sounding prose
// ─────────────────────────────────────────
router.post('/humanize', async (req, res) => {
  const { content, custom_instructions } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const ai = await getPuter();

    const prompt = `You are a world-class human editor and ghostwriter. Your job is to rewrite the following AI-generated article so it sounds like it was written by a smart, experienced human — not a language model.

REWRITING RULES (follow ALL of these strictly):
1. **Vary sentence rhythm drastically.** Mix very short sentences (3–6 words) with longer, more detailed ones. Avoid uniform sentence length.
2. **Use contractions naturally.** "don't", "it's", "you'll", "we've" — these make text feel human.
3. **Add personality.** Where appropriate, include a light opinion, a mild caveat, or a knowing aside — e.g., "(and yes, this actually matters more than most people realize)".
4. **Remove all robotic transition phrases.** Delete "Moreover", "Furthermore", "It is important to note", "In conclusion", "Ultimately", etc.
5. **Break up long paragraphs.** No paragraph should exceed 4 sentences.
6. **Preserve all factual content, statistics, headings, markdown formatting, and internal links.** Do NOT add or remove facts.
7. **Do NOT change headings (# ## ###).** Only rewrite body text.
8. **Preserve the total word count** — do not significantly shorten or lengthen the content.

${custom_instructions ? `ADDITIONAL TONE INSTRUCTIONS:\n${custom_instructions}\n` : ''}

ARTICLE TO REWRITE:
${content}

Return ONLY the full rewritten article in markdown. No preamble, no explanation.`;

    const stream = await ai.ai.chat(prompt, { stream: true });

    for await (const chunk of stream) {
      const text = typeof chunk === 'string' ? chunk : (chunk?.text || '');
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES (?, ?, ?)',
      [req.user.id, 'humanize', 600]);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Humanize error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ─────────────────────────────────────────
// GET /api/content/usage
// Get usage stats for current user
// ─────────────────────────────────────────
router.get('/usage', (req, res) => {
  try {
    const stats = db.all(
      `SELECT action, SUM(tokens_used) as tokens, COUNT(*) as count
       FROM usage_log WHERE user_id = ? GROUP BY action`,
      [req.user.id]
    );
    const total = db.get(
      'SELECT SUM(tokens_used) as total_tokens, COUNT(*) as total_calls FROM usage_log WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ by_action: stats, ...total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

module.exports = router;
