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

async function buildClientContext(profile) {
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
INTERNAL LINKS TO WEAVE INTO CONTENT (Find natural opportunities to use these URLs. We have provided a Semantic Map of the pages below. Use the most relevant ones with contextual anchor text in Markdown format [anchor text](url)):
${internalUrls.map(u => {
    if (typeof u === 'string') return `- ${u}`;
    if (u.url) return `- URL: ${u.url}\n  Title: ${u.title || 'N/A'}\n  Description: ${u.description || 'N/A'}`;
    return `- ${u.keyword || u}`;
  }).join('\n')}
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

  const products = parseArray(profile.products_services);
  const productsBlock = products.length > 0 ? `
PRODUCTS & SERVICES OFFERED (When discussing solutions, explicitly reference these specific products and features, rather than generic alternatives):
${products.map(p => `- Product/Service: ${p.name || p}\n  Description: ${p.description || 'N/A'}\n  Value Proposition: ${p.uvp || 'N/A'}`).join('\n')}
` : '';

  const personas = parseArray(profile.buyer_personas);
  const personasBlock = personas.length > 0 ? `
TARGET BUYER PERSONAS (Write directly to these specific personas, addressing their anxieties and goals):
${personas.map(p => `- Persona: ${p.name || p}\n  Pain Points: ${p.pain_points || 'N/A'}\n  Goals: ${p.goals || 'N/A'}\n  Common Objections: ${p.objections || 'N/A'}`).join('\n')}
` : '';

  const dosAndDonts = parseArray(profile.dos_and_donts);
  const dosAndDontsBlock = dosAndDonts.length > 0 ? `
DO'S AND DON'TS (BRAND VOICE MAPPING):
${dosAndDonts.map(d => `- INSTEAD OF SAYING "${d.bad_phrase}", SAY "${d.good_phrase}" (Context: ${d.context})`).join('\n')}
CRITICAL RULE: You MUST strictly adhere to these vocabulary mappings.
` : '';

  const goodExamples = parseArray(profile.good_examples);
  const badExamples = parseArray(profile.bad_examples);
  const examplesBlock = (goodExamples.length > 0 || badExamples.length > 0) ? `
FEW-SHOT TONE EXAMPLES:
${goodExamples.length > 0 ? `👍 GOOD EXAMPLES (Emulate this tone and style):\n${goodExamples.map(e => `"""\n${e.content || e}\n"""`).join('\n')}\n` : ''}
${badExamples.length > 0 ? `👎 BAD EXAMPLES (NEVER write like this):\n${badExamples.map(e => `"""\n${e.content || e}\n"""`).join('\n')}\n` : ''}
` : '';

  let kbBlock = '';
  if (profile.id) {
    try {
      const kbDocs = await db.all('SELECT title, content FROM knowledge_base WHERE client_id = $1', [profile.id]);
      if (kbDocs && kbDocs.length > 0) {
        kbBlock = `\nKNOWLEDGE BASE (FACTUAL REFERENCE):\n` + 
          kbDocs.map(d => `--- DOCUMENT: ${d.title} ---\n${d.content.slice(0, 3000)}\n----------------------`).join('\n') +
          `\nCRITICAL INSTRUCTION: Use the above Knowledge Base to pull exact facts, details, and context.`;
      }
    } catch (err) {
      console.error('Failed to load knowledge base:', err);
    }
  }

  return `
CLIENT PROFILE:
- Niche / Industry: ${profile.industry || 'General'} (Category: ${profile.niche_category || 'general'})
- Tone: ${profile.tone || 'professional'}
- Target Audience: ${profile.target_audience || 'general'}
- Brand Voice: ${profile.brand_voice || 'authoritative and helpful'}
- BANNED WORDS (NEVER use these): ${banned || 'none'}
- COMPETITOR BRANDS (NEVER mention, link to, or promote): ${competitors || 'none'}
${refContent}
${productsBlock}
${personasBlock}
${dosAndDontsBlock}
${examplesBlock}
${eeatBlock}
${citationBlock}
${internalLinksBlock}
${ymyl}
${kbBlock}`;
}

// ─────────────────────────────────────────
// POST /api/content/brief
// Generate strategic SEO brief from SERP data
// ─────────────────────────────────────────
router.post('/brief', async (req, res) => {
  const { keyword, title, serp_data, content_type, client_profile, target_word_count, manual_research, existing_content, tone_of_voice, formatting_rules } = req.body;
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

    const clientContext = await buildClientContext(client_profile);
    const manualResearchContext = manual_research ? `\nUSER'S MANUAL RESEARCH & CRITICAL INSTRUCTIONS:\n${manual_research}\n` : '';
    const existingContentContext = existing_content ? `\nEXISTING CONTENT TO REFRESH (Analyze this and find gaps compared to the SERP. We are rewriting this, NOT starting from scratch):\n${existing_content.slice(0, 5000)}\n` : '';

    const prompt = `You are an expert SEO content strategist. Create a comprehensive SEO content brief for the following:

KEYWORD: "${keyword}"
WORKING TITLE: "${title || 'Recommend a good title based on the keyword'}"
CONTENT TYPE: ${content_type || 'blog post'}
TARGET WORD COUNT: ~${target_word_count || 1500} words

${serpContext}
${clientContext}
${manualResearchContext}
${existingContentContext}

Generate a strategic SEO brief that includes:
1. **Search Intent Analysis** - What is the user trying to accomplish?
2. **Content Angle** - Unique angle that differentiates from current top results
3. **Target Audience** - Who is this for, and what do they need?
4. **Primary Keyword Usage** - How to naturally use the keyword
5. **Semantic Keywords & LSI Terms** - 10-15 related terms to naturally include
6. **Key Questions to Answer** - Based on PAA and search intent
7. **Competitor Gaps** - What are top results missing? ${existing_content ? 'Also, what is the EXISTING CONTENT missing compared to the SERP?' : ''}
8. **EEAT Signals** - How to demonstrate expertise and trustworthiness
9. **Tone & Style Guidelines** - How to write this content ${tone_of_voice ? `(Must strictly adhere to this tone: ${tone_of_voice})` : ''}
10. **Content Structure Notes** - Recommended format (listicle, guide, how-to, etc.) ${existing_content ? '(Note: Preserve the core essence of the existing content but expand and refresh it.)' : ''} ${formatting_rules ? `\nMust strictly follow these formatting rules: ${formatting_rules}` : ''}

Format as a clean, structured brief that a writer can follow. Do NOT include any preamble, postamble, conversational filler, or intro text like "Here is the brief". Start immediately with the brief content.`;

    const resp = await ai.ai.chat(prompt);
    const brief = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));
    const tokensUsed = 500; // Puter doesn't always expose token usage perfectly, mocking a standard count

    await db.run(
      'INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
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

Return ONLY valid JSON array, no other text. Absolutely NO preamble, markdown formatting around the JSON, or conversational filler. Start exactly with '[' and end exactly with ']'.`;

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
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
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

    let parsedInstructions = null;
    try {
      parsedInstructions = custom_instructions ? JSON.parse(custom_instructions) : null;
    } catch (e) {
      // It's a plain string
    }

    const clientContext = await buildClientContext(client_profile);

    const outlineContext = outline && outline.length > 0
      ? `\nFULL ARTICLE OUTLINE:\n${outline.map(s => `${s.type.toUpperCase()}: ${s.heading}`).join('\n')}`
      : '';

    const writerPrompt = `You are an expert SEO content writer. Write the content for this specific section of an article.

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

Write ONLY the content for this section. Do NOT include the heading. Be specific, informative, and engaging.

${parsedInstructions ? `
CUSTOM INSTRUCTIONS FOR THIS ARTICLE:
Instructions: ${parsedInstructions.instructions || custom_instructions}
${parsedInstructions.tone_of_voice ? `Tone of Voice: ${parsedInstructions.tone_of_voice}` : ''}
${parsedInstructions.formatting_rules ? `Formatting Rules: ${parsedInstructions.formatting_rules}` : ''}
` : custom_instructions ? `\nCUSTOM INSTRUCTIONS FOR THIS ARTICLE:\n${custom_instructions}\n` : ''}`;

    // 1. Writer Agent generates the first draft invisibly
    const writerResp = await ai.ai.chat(writerPrompt);
    const draftText = typeof writerResp === 'string' ? writerResp : (writerResp?.text || writerResp?.message?.content || '');

    // 2. Editor Agent revises the draft and streams to the client
    const editorPrompt = `You are a strict, world-class human editor and brand compliance officer. 
Your job is to revise the following AI-generated draft so it perfectly matches the client's brand voice, reads like a human wrote it, and fixes any AI tropes.

CLIENT BRAND GUIDELINES & CONTEXT:
${clientContext}

CRITICAL RULES FOR REVISION:
1. **Humanize Rhythm:** Mix very short punchy sentences (3-6 words) with longer explanatory ones. Use contractions ("don't", "it's").
2. **Remove AI Tropes:** Delete "Moreover", "Furthermore", "In today's landscape", "Crucial", "Testament", "Delve", "Tapestry", etc.
3. **Never start two consecutive sentences with the same word.**
4. **Preserve formatting:** Keep any markdown (bullet points, bold text).
5. **Brand Strictness:** Ensure NO BANNED WORDS were used. Ensure any "Do's and Don'ts" mapping is respected.

REVISE THIS DRAFT:
${draftText}

Return ONLY the fully revised content. No preamble, no postamble. Start immediately with the text.`;

    const stream = await ai.ai.chat(editorPrompt, { stream: true });

    for await (const chunk of stream) {
      const text = typeof chunk === 'string' ? chunk : (chunk?.text || '');
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }


    const totalTokens = 500;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
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

Return ONLY valid JSON. Absolutely NO preamble, markdown formatting around the JSON, or conversational filler. Start exactly with '{' and end exactly with '}'.`;

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
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
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

Return ONLY the full rewritten article in markdown. No preamble, no explanation, no conversational filler. Start immediately with the rewritten text.`;

    const stream = await ai.ai.chat(prompt, { stream: true });

    for await (const chunk of stream) {
      const text = typeof chunk === 'string' ? chunk : (chunk?.text || '');
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
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
router.get('/usage', async (req, res) => {
  try {
    const stats = await db.all(
      `SELECT action, SUM(tokens_used) as tokens, COUNT(*) as count
       FROM usage_log WHERE user_id = $1 GROUP BY action`,
      [req.user.id]
    );
    const total = await db.get(
      'SELECT SUM(tokens_used) as total_tokens, COUNT(*) as total_calls FROM usage_log WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ by_action: stats, ...total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// ─────────────────────────────────────────
// POST /api/content/fact-check
// Automated Brand Hallucination Check
// ─────────────────────────────────────────
router.post('/fact-check', async (req, res) => {
  const { content, client_profile } = req.body;
  if (!content || !client_profile) return res.status(400).json({ error: 'Content and client profile are required' });

  try {
    const ai = await getPuter();
    const clientContext = await buildClientContext(client_profile);

    const prompt = `You are a strict brand compliance officer and fact-checker. Review the following article against the Client Profile provided.

${clientContext}

ARTICLE TO REVIEW:
${content}

Your job is to strictly check for the following:
1. **Product/Service Hallucinations:** Did the AI invent any products, features, or services that are NOT listed in the "PRODUCTS & SERVICES OFFERED" section?
2. **Banned Words/Competitors:** Did the AI use any words from the BANNED WORDS list or mention any COMPETITOR BRANDS?
3. **Do's and Don'ts Violations:** Did the AI use any "Bad Phrases" instead of the recommended "Good Phrases"?
4. **Tone Drift:** Does the article severely violate the requested tone or brand voice?

Return a JSON object with this exact structure:
{
  "passed": boolean, // true if there are no major violations, false if there are hallucinations or banned words used
  "violations": [
    "List of specific violations found, including quotes from the text if possible."
  ],
  "recommendations": [
    "Specific instructions on how to fix the violations."
  ]
}

Return ONLY valid JSON. Absolutely NO preamble, markdown formatting around the JSON, or conversational filler. Start exactly with '{' and end exactly with '}'.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let checkData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      checkData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      checkData = {
        passed: true,
        violations: ["Failed to parse compliance check response."],
        recommendations: []
      };
    }

    const tokensUsed = 400;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
      [req.user.id, 'fact_check', tokensUsed]);

    res.json({ ...checkData, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Fact check error:', err);
    res.status(500).json({ error: 'Failed to run fact check: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/content/hooks
// Generate A/B Hook variations
// ─────────────────────────────────────────
router.post('/hooks', async (req, res) => {
  const { keyword, brief, client_profile } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    const ai = await getPuter();
    const clientContext = await buildClientContext(client_profile);

    const prompt = `You are a master copywriter. The user is about to write an article for the keyword: "${keyword}".
    
${clientContext}

BRIEF: ${brief || 'Write a compelling article.'}

Generate 3 entirely different, highly engaging H1 Titles and introductory paragraphs (hooks). 
Variation 1: Data/Statistic driven (start with a shocking fact or number)
Variation 2: Story/Empathy driven (focus deeply on the buyer persona's pain point)
Variation 3: Question/Curiosity led (challenge a common misconception)

Return a JSON array of 3 objects exactly like this:
[
  { "type": "Data-Driven", "title": "...", "hook": "..." },
  { "type": "Empathy-Driven", "title": "...", "hook": "..." },
  { "type": "Curiosity-Led", "title": "...", "hook": "..." }
]

Return ONLY valid JSON. No preamble, no markdown formatting around the JSON.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let hooksData;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      hooksData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      hooksData = [
        { type: "Error", title: "Failed to parse hooks", hook: "Please try again." }
      ];
    }

    const tokensUsed = 300;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
      [req.user.id, 'generate_hooks', tokensUsed]);

    res.json({ hooks: hooksData, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Hooks error:', err);
    res.status(500).json({ error: 'Failed to generate hooks: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/content/gap-analysis
// Compare current outline with SERP data to find content gaps
// ─────────────────────────────────────────
router.post('/gap-analysis', async (req, res) => {
  const { keyword, outline, serp_data } = req.body;
  if (!keyword || !outline) return res.status(400).json({ error: 'Keyword and outline are required' });

  try {
    const ai = await getPuter();
    
    let competitorsContext = '';
    if (serp_data && serp_data.top_results) {
      competitorsContext = serp_data.top_results.slice(0, 3).map((r, i) => 
        `Competitor ${i+1} (${r.title}):\n${r.snippet || r.url}\n`
      ).join('\n\n');
    }

    const currentOutlineStr = outline.map(s => `${s.type.toUpperCase()}: ${s.heading}`).join('\n');

    const prompt = `You are a master SEO strategist. I am writing an article about "${keyword}".
    
MY CURRENT OUTLINE:
${currentOutlineStr}

COMPETITOR DATA (Top ranking pages for this keyword):
${competitorsContext || (serp_data && serp_data.people_also_ask ? serp_data.people_also_ask.join('\n') : 'Analyze based on general best practices for this keyword.')}

Identify 3 to 5 "Content Gaps" — specific, highly-relevant subtopics or questions that my competitors cover (or that users strongly want to know) but are MISSING from my current outline.

Return a JSON array of objects representing these missing sections, in this exact format:
[
  {
    "heading": "The suggested missing heading",
    "type": "h2",
    "notes": "Brief explanation of why this section is important to add, based on competitor analysis.",
    "target_words": 150
  }
]

Return ONLY valid JSON. No preamble, no markdown formatting around the JSON.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let gaps;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      gaps = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      gaps = [];
    }

    const tokensUsed = 300;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
      [req.user.id, 'gap_analysis', tokensUsed]);

    res.json({ gaps, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Gap analysis error:', err);
    res.status(500).json({ error: 'Failed to run gap analysis: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/content/nlp-terms
// Generate 25-35 Surfer-style NLP entities & term frequency targets
// ─────────────────────────────────────────
router.post('/nlp-terms', async (req, res) => {
  const { keyword, serp_data, target_word_count = 1500 } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    const ai = await getPuter();
    const paa = serp_data?.people_also_ask?.join(', ') || '';
    const related = serp_data?.related_searches?.join(', ') || '';
    const competitors = (serp_data?.top_results || []).map(r => r.title).join(', ');

    const prompt = `You are a world-class SEO content optimization engine like Surfer SEO and Frase.io.
Target Keyword: "${keyword}"
Target Word Count: ${target_word_count} words
SERP Competitor Titles: ${competitors || 'None provided'}
People Also Ask: ${paa || 'None provided'}
Related Searches: ${related || 'None provided'}

Generate a comprehensive list of 25 to 32 essential NLP semantic terms, entities, and keyword phrases that top-ranking pages MUST include for this topic.

Categorize each term into one of three categories:
1. "topical": Core semantic concepts, technical terminology, and high-relevance industry entities.
2. "headings": Critical keyword phrases recommended to appear in H2/H3 subheadings.
3. "questions": Key question triggers or conversational search phrases.

For each term, calculate realistic and statistically sound frequency targets (min_count and max_count) based on a total target word count of ${target_word_count} words (e.g. min 2, max 6 for core terms; min 1, max 3 for secondary terms; min 1, max 2 for heading terms).

Return ONLY a valid JSON array of objects in this exact format:
[
  {
    "term": "example entity",
    "category": "topical",
    "min_count": 3,
    "max_count": 7,
    "importance": "high"
  },
  {
    "term": "how to optimize workflow",
    "category": "headings",
    "min_count": 1,
    "max_count": 2,
    "importance": "medium"
  },
  {
    "term": "what are the key benefits",
    "category": "questions",
    "min_count": 1,
    "max_count": 3,
    "importance": "medium"
  }
]

Return ONLY the raw JSON array. No markdown codeblocks, no conversational text.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let nlp_terms = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      nlp_terms = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      // Fallback NLP terms if AI parsing fails
      nlp_terms = [
        { term: keyword, category: 'topical', min_count: 4, max_count: 10, importance: 'high' },
        { term: 'best practices', category: 'topical', min_count: 2, max_count: 5, importance: 'high' },
        { term: 'step-by-step guide', category: 'headings', min_count: 1, max_count: 2, importance: 'medium' },
        { term: 'key benefits', category: 'headings', min_count: 1, max_count: 3, importance: 'medium' },
        { term: 'how does it work', category: 'questions', min_count: 1, max_count: 2, importance: 'medium' }
      ];
    }

    // Ensure valid structure
    nlp_terms = (Array.isArray(nlp_terms) ? nlp_terms : []).map(t => ({
      term: String(t.term || '').trim(),
      category: ['topical', 'headings', 'questions'].includes(t.category) ? t.category : 'topical',
      min_count: Math.max(1, parseInt(t.min_count, 10) || 1),
      max_count: Math.max(2, parseInt(t.max_count, 10) || 4),
      importance: t.importance || 'medium'
    })).filter(t => t.term.length > 0);

    const tokensUsed = 400;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
      [req.user.id, 'nlp_terms', tokensUsed]);

    res.json({ nlp_terms, tokens_used: tokensUsed });
  } catch (err) {
    console.error('NLP terms generation error:', err);
    res.status(500).json({ error: 'Failed to generate NLP terms: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/content/research-vault
// Generate Frase-style verified stats, findings, and citation cards
// ─────────────────────────────────────────
router.post('/research-vault', async (req, res) => {
  const { keyword, serp_data } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    const ai = await getPuter();
    const paa = serp_data?.people_also_ask?.join(', ') || '';
    const competitors = (serp_data?.top_results || []).map(r => `${r.title} (${r.url})`).join('\n');

    const prompt = `You are an expert research analyst and SEO content researcher (like Frase.io Research Vault).
Target Keyword: "${keyword}"
Top SERP Context:
${competitors || 'General industry research'}
People Also Ask: ${paa || 'N/A'}

Provide 6 to 9 authoritative, factual data points, industry benchmark statistics, key research findings, and expert quotes relevant to this topic that a writer can cite to build high E-E-A-T authority.

Format as a JSON array of objects:
[
  {
    "id": 1,
    "type": "statistic", // "statistic" | "finding" | "quote"
    "title": "Short descriptive highlight",
    "stat": "Exact statistic or quote statement with numbers (e.g., 73% of B2B marketers state...)",
    "context": "Why this data point is important and where to weave it into the article.",
    "source_name": "Credible Institution or Authority (e.g. Gartner, HubSpot, Forrester, McKinsey, Statista)",
    "source_url": "https://credible-source-domain.com/research-report"
  }
]

Return ONLY the raw JSON array. No markdown code blocks, no other text.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let research_items = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      research_items = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      research_items = [];
    }

    const tokensUsed = 350;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
      [req.user.id, 'research_vault', tokensUsed]);

    res.json({ research_items, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Research vault error:', err);
    res.status(500).json({ error: 'Failed to generate research items: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/content/inline-ai
// Floating inline selection assistant (Expand, Shorten, Add Stats, Humanize, Rephrase, Custom)
// ─────────────────────────────────────────
router.post('/inline-ai', async (req, res) => {
  const { text, action, custom_prompt, keyword, client_id } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Selected text is required' });

  try {
    const ai = await getPuter();
    let clientContext = '';
    if (client_id) {
      try {
        const client = await db.get('SELECT * FROM clients WHERE id = $1', [client_id]);
        if (client) clientContext = await buildClientContext(client);
      } catch (e) {
        console.warn('Client context error for inline AI:', e);
      }
    }

    let instruction = '';
    switch (action) {
      case 'expand':
        instruction = 'Expand and elaborate on the following selected text. Provide more technical clarity, real-world examples, and actionable depth while maintaining great pacing. Keep it tightly relevant.';
        break;
      case 'shorten':
        instruction = 'Make the following selected text concise, sharp, and impactful. Remove all filler, fluff, and unnecessary passive voice while preserving the core message.';
        break;
      case 'add_stats':
        instruction = 'Enrich the following selected text by naturally incorporating relevant industry statistics, data benchmarks, or specific percentages with realistic source attributions.';
        break;
      case 'humanize':
        instruction = 'Rewrite the following text to sound completely natural, engaging, and human-written. Eliminate all AI clichés (such as "in conclusion", "vital role", "tapestry", "dive deep", "furthermore", "moreover"). Use active voice and smooth conversational transitions.';
        break;
      case 'rephrase':
        instruction = 'Paraphrase and rephrase the following selected text to improve flow, cadence, and authoritative tone.';
        break;
      case 'custom':
      default:
        instruction = custom_prompt || 'Improve and refine the following text.';
        break;
    }

    const prompt = `You are a precision inline editor for a high-end SEO content tool.
Target Article Keyword: "${keyword || 'General'}"
${clientContext ? `Brand Guidelines:\n${clientContext}` : ''}

INSTRUCTION: ${instruction}

ORIGINAL SELECTED TEXT:
"""
${text}
"""

CRITICAL RULES:
1. Return ONLY the rewritten replacement text.
2. Maintain valid Markdown formatting (bold, links, lists) if present in the original text.
3. Do NOT include quotes around the output.
4. Do NOT include explanations, preambles, or conversational replies like "Here is the revised text:".`;

    const resp = await ai.ai.chat(prompt);
    let revised_text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || '');
    revised_text = revised_text.replace(/^["'`]|["'`]$/g, '').trim();

    const tokensUsed = 250;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
      [req.user.id, 'inline_ai', tokensUsed]);

    res.json({ revised_text, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Inline AI error:', err);
    res.status(500).json({ error: 'Failed to process inline AI: ' + err.message });
  }
});

module.exports = router;

