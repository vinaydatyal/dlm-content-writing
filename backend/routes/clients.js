// backend/routes/clients.js
const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authenticate);

// Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await db.all('SELECT * FROM clients ORDER BY name ASC');
    res.json(clients.map(c => ({
      ...c,
      banned_words: JSON.parse(c.banned_words || '[]'),
      competitors: JSON.parse(c.competitors || '[]'),
      internal_urls: JSON.parse(c.internal_urls || '[]'),
      preferred_citations: JSON.parse(c.preferred_citations || '[]'),
      products_services: JSON.parse(c.products_services || '[]'),
      buyer_personas: JSON.parse(c.buyer_personas || '[]'),
      dos_and_donts: JSON.parse(c.dos_and_donts || '[]'),
      good_examples: JSON.parse(c.good_examples || '[]'),
      bad_examples: JSON.parse(c.bad_examples || '[]'),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    const client = await db.get('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({
      ...client,
      banned_words: JSON.parse(client.banned_words || '[]'),
      competitors: JSON.parse(client.competitors || '[]'),
      internal_urls: JSON.parse(client.internal_urls || '[]'),
      preferred_citations: JSON.parse(client.preferred_citations || '[]'),
      products_services: JSON.parse(client.products_services || '[]'),
      buyer_personas: JSON.parse(client.buyer_personas || '[]'),
      dos_and_donts: JSON.parse(client.dos_and_donts || '[]'),
      good_examples: JSON.parse(client.good_examples || '[]'),
      bad_examples: JSON.parse(client.bad_examples || '[]'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Create client
router.post('/', async (req, res) => {
  try {
    const { name, website_url, industry, target_audience, tone, brand_voice, reference_content, niche_category, banned_words, competitors, internal_urls, color, author_name, author_credentials, author_bio, company_credentials, preferred_citations, products_services, buyer_personas, dos_and_donts, good_examples, bad_examples } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required' });

    const id = await db.insert(
      `INSERT INTO clients (name, website_url, industry, target_audience, tone, brand_voice, reference_content, niche_category, banned_words, competitors, internal_urls, color, author_name, author_credentials, author_bio, company_credentials, preferred_citations, products_services, buyer_personas, dos_and_donts, good_examples, bad_examples, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        name, website_url || '', industry || '', target_audience || '',
        tone || 'professional', brand_voice || '', reference_content || '', niche_category || 'general',
        JSON.stringify(banned_words || []), JSON.stringify(competitors || []),
        JSON.stringify(internal_urls || []),
        color || '#6366f1',
        author_name || '', author_credentials || '', author_bio || '', company_credentials || '',
        JSON.stringify(preferred_citations || []),
        JSON.stringify(products_services || []), JSON.stringify(buyer_personas || []),
        JSON.stringify(dos_and_donts || []), JSON.stringify(good_examples || []), JSON.stringify(bad_examples || []),
        req.user.id
      ]
    );

    const client = await db.get('SELECT * FROM clients WHERE id = $1', [id]);
    res.status(201).json({
      ...client,
      banned_words: JSON.parse(client.banned_words || '[]'),
      competitors: JSON.parse(client.competitors || '[]'),
      internal_urls: JSON.parse(client.internal_urls || '[]'),
      preferred_citations: JSON.parse(client.preferred_citations || '[]'),
      products_services: JSON.parse(client.products_services || '[]'),
      buyer_personas: JSON.parse(client.buyer_personas || '[]'),
      dos_and_donts: JSON.parse(client.dos_and_donts || '[]'),
      good_examples: JSON.parse(client.good_examples || '[]'),
      bad_examples: JSON.parse(client.bad_examples || '[]'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM clients WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Client not found' });

    const { name, website_url, industry, target_audience, tone, brand_voice, reference_content, niche_category, banned_words, competitors, internal_urls, color, author_name, author_credentials, author_bio, company_credentials, preferred_citations, products_services, buyer_personas, dos_and_donts, good_examples, bad_examples } = req.body;
    await db.run(
      `UPDATE clients SET name=$1, website_url=$2, industry=$3, target_audience=$4, tone=$5, brand_voice=$6, reference_content=$7, niche_category=$8,
       banned_words=$9, competitors=$10, internal_urls=$11, color=$12,
       author_name=$13, author_credentials=$14, author_bio=$15, company_credentials=$16, preferred_citations=$17,
       products_services=$18, buyer_personas=$19, dos_and_donts=$20, good_examples=$21, bad_examples=$22,
       updated_at=CURRENT_TIMESTAMP WHERE id=$23`,
      [
        name, website_url || '', industry || '', target_audience || '',
        tone || 'professional', brand_voice || '', reference_content || '', niche_category || 'general',
        JSON.stringify(banned_words || []), JSON.stringify(competitors || []),
        JSON.stringify(internal_urls || []),
        color || '#6366f1',
        author_name || '', author_credentials || '', author_bio || '', company_credentials || '',
        JSON.stringify(preferred_citations || []),
        JSON.stringify(products_services || []), JSON.stringify(buyer_personas || []),
        JSON.stringify(dos_and_donts || []), JSON.stringify(good_examples || []), JSON.stringify(bad_examples || []),
        req.params.id
      ]
    );

    const client = await db.get('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    res.json({
      ...client,
      banned_words: JSON.parse(client.banned_words || '[]'),
      competitors: JSON.parse(client.competitors || '[]'),
      internal_urls: JSON.parse(client.internal_urls || '[]'),
      preferred_citations: JSON.parse(client.preferred_citations || '[]'),
      products_services: JSON.parse(client.products_services || '[]'),
      buyer_personas: JSON.parse(client.buyer_personas || '[]'),
      dos_and_donts: JSON.parse(client.dos_and_donts || '[]'),
      good_examples: JSON.parse(client.good_examples || '[]'),
      bad_examples: JSON.parse(client.bad_examples || '[]'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// POST /api/clients/:id/sitemap
// Fetch and parse sitemap
router.post('/:id/sitemap', async (req, res) => {
  const { sitemap_url } = req.body;
  if (!sitemap_url) return res.status(400).json({ error: 'sitemap_url is required' });

  try {
    const sitemapRes = await axios.get(sitemap_url);
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(sitemapRes.data);

    let urls = [];
    if (result.urlset && result.urlset.url) {
      urls = result.urlset.url.map(u => u.loc[0]);
    } else if (result.sitemapindex && result.sitemapindex.sitemap) {
      return res.status(400).json({ error: 'This is a sitemap index. Please provide a direct URL sitemap.' });
    }

    // Filter to limit and only keep valid string URLs
    urls = urls.filter(u => typeof u === 'string' && u.startsWith('http')).slice(0, 100);

    // Start background enrichment task
    enrichAndSaveUrls(req.params.id, urls);

    res.json({ urls, success: true, message: 'Sitemap parsed. Enrichment started in background.' });
  } catch (err) {
    console.error('Sitemap parse error:', err);
    res.status(500).json({ error: 'Failed to fetch or parse sitemap' });
  }
});

async function enrichAndSaveUrls(clientId, urls) {
  const enriched = [];
  console.log(`Starting background enrichment of ${urls.length} URLs for client ${clientId}`);
  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 5000 });
      const html = res.data;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : url;
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
      const description = descMatch ? descMatch[1].trim() : '';
      enriched.push({ url, title, description });
    } catch (e) {
      enriched.push({ url, title: url, description: '' });
    }
  }
  db.run('UPDATE clients SET internal_urls = $1 WHERE id = $2', [JSON.stringify(enriched), clientId]);
  console.log(`Finished enrichment for client ${clientId}`);
}

let puterClient;
async function getPuter() {
  if (!puterClient) {
    const mod = await import('@heyputer/puter.js');
    puterClient = mod.puter;
    if (process.env.PUTER_API_TOKEN) {
      puterClient.setAuthToken(process.env.PUTER_API_TOKEN);
    }
  }
  return puterClient;
}

// POST /api/clients/test-voice
// Live Brand Voice Sandbox Tester
router.post('/test-voice', async (req, res) => {
  const { name, industry, tone, brand_voice, brand_archetype, target_audience, banned_words, sample_prompt } = req.body;
  const testTopic = sample_prompt || 'Explain why investing in organic search engine optimization creates compounding revenue growth.';

  try {
    const ai = await getPuter();
    const bannedList = Array.isArray(banned_words) ? banned_words.join(', ') : (banned_words || 'None');

    const prompt = `You are a world-class copywriter and brand voice specialist for "${name || 'Our Company'}".
Industry: ${industry || 'General Business'}
Target Audience: ${target_audience || 'Prospective clients and buyers'}
Tone of Voice: ${tone || 'Professional & Authoritative'}
Brand Voice Archetype: ${brand_archetype || 'Authoritative Guide'}
Specific Voice Guidelines: "${brand_voice || 'Clear, confident, actionable, and customer-centric.'}"
Strictly Banned Words / Clichés: ${bannedList}

TEST PROMPT:
"${testTopic}"

INSTRUCTIONS:
Write a 2 to 3 paragraph sample response answering the test prompt while strictly showcasing this client's unique brand voice, vocabulary, rhythm, and tone. Do NOT use any of the banned words.
Format with clean Markdown. Output only the sample copy without preamble.`;

    const resp = await ai.ai.chat(prompt);
    const sample_output = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || '');

    res.json({ sample_output: sample_output.trim() });
  } catch (err) {
    console.error('Voice test error:', err);
    res.status(500).json({ error: 'Failed to generate voice sample: ' + err.message });
  }
});

module.exports = router;
