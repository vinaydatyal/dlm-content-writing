// backend/routes/clients.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authenticate);

// Get all clients
router.get('/', (req, res) => {
  try {
    const clients = db.all('SELECT * FROM clients ORDER BY name ASC');
    res.json(clients.map(c => ({
      ...c,
      banned_words: JSON.parse(c.banned_words || '[]'),
      competitors: JSON.parse(c.competitors || '[]'),
      internal_urls: JSON.parse(c.internal_urls || '[]'),
      preferred_citations: JSON.parse(c.preferred_citations || '[]'),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get single client
router.get('/:id', (req, res) => {
  try {
    const client = db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({
      ...client,
      banned_words: JSON.parse(client.banned_words || '[]'),
      competitors: JSON.parse(client.competitors || '[]'),
      internal_urls: JSON.parse(client.internal_urls || '[]'),
      preferred_citations: JSON.parse(client.preferred_citations || '[]'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Create client
router.post('/', (req, res) => {
  try {
    const { name, website_url, industry, target_audience, tone, brand_voice, reference_content, niche_category, banned_words, competitors, internal_urls, color, author_name, author_credentials, author_bio, company_credentials, preferred_citations } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required' });

    const id = db.insert(
      `INSERT INTO clients (name, website_url, industry, target_audience, tone, brand_voice, reference_content, niche_category, banned_words, competitors, internal_urls, color, author_name, author_credentials, author_bio, company_credentials, preferred_citations, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, website_url || '', industry || '', target_audience || '',
        tone || 'professional', brand_voice || '', reference_content || '', niche_category || 'general',
        JSON.stringify(banned_words || []), JSON.stringify(competitors || []),
        JSON.stringify(internal_urls || []),
        color || '#6366f1',
        author_name || '', author_credentials || '', author_bio || '', company_credentials || '',
        JSON.stringify(preferred_citations || []),
        req.user.id
      ]
    );

    const client = db.get('SELECT * FROM clients WHERE id = ?', [id]);
    res.status(201).json({
      ...client,
      banned_words: JSON.parse(client.banned_words || '[]'),
      competitors: JSON.parse(client.competitors || '[]'),
      internal_urls: JSON.parse(client.internal_urls || '[]'),
      preferred_citations: JSON.parse(client.preferred_citations || '[]'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', (req, res) => {
  try {
    const existing = db.get('SELECT id FROM clients WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Client not found' });

    const { name, website_url, industry, target_audience, tone, brand_voice, reference_content, niche_category, banned_words, competitors, internal_urls, color, author_name, author_credentials, author_bio, company_credentials, preferred_citations } = req.body;
    db.run(
      `UPDATE clients SET name=?, website_url=?, industry=?, target_audience=?, tone=?, brand_voice=?, reference_content=?, niche_category=?,
       banned_words=?, competitors=?, internal_urls=?, color=?,
       author_name=?, author_credentials=?, author_bio=?, company_credentials=?, preferred_citations=?,
       updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [
        name, website_url || '', industry || '', target_audience || '',
        tone || 'professional', brand_voice || '', reference_content || '', niche_category || 'general',
        JSON.stringify(banned_words || []), JSON.stringify(competitors || []),
        JSON.stringify(internal_urls || []),
        color || '#6366f1',
        author_name || '', author_credentials || '', author_bio || '', company_credentials || '',
        JSON.stringify(preferred_citations || []),
        req.params.id
      ]
    );

    const client = db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json({
      ...client,
      banned_words: JSON.parse(client.banned_words || '[]'),
      competitors: JSON.parse(client.competitors || '[]'),
      internal_urls: JSON.parse(client.internal_urls || '[]'),
      preferred_citations: JSON.parse(client.preferred_citations || '[]'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
router.delete('/:id', (req, res) => {
  try {
    db.run('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
