// backend/routes/projects.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authenticate);

// Get all projects (optionally filter by client)
router.get('/', (req, res) => {
  try {
    const { client_id } = req.query;
    let projects;
    if (client_id) {
      projects = db.all(
        `SELECT p.*, c.name as client_name, c.color as client_color,
         a.id as article_id, a.word_count, a.status as article_status
         FROM projects p
         LEFT JOIN clients c ON p.client_id = c.id
         LEFT JOIN articles a ON a.project_id = p.id
         WHERE p.client_id = ?
         ORDER BY p.created_at DESC`,
        [client_id]
      );
    } else {
      projects = db.all(
        `SELECT p.*, c.name as client_name, c.color as client_color,
         a.id as article_id, a.word_count, a.status as article_status
         FROM projects p
         LEFT JOIN clients c ON p.client_id = c.id
         LEFT JOIN articles a ON a.project_id = p.id
         ORDER BY p.created_at DESC`
      );
    }
    res.json(projects.map(p => ({
      ...p,
      secondary_keywords: JSON.parse(p.secondary_keywords || '[]'),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', (req, res) => {
  try {
    const project = db.get(
      `SELECT p.*, c.name as client_name, c.color as client_color, c.internal_urls
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({
      ...project,
      secondary_keywords: JSON.parse(project.secondary_keywords || '[]'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const { client_id, keyword, title, secondary_keywords, content_type, target_url, target_word_count } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

    const id = db.insert(
      `INSERT INTO projects (client_id, keyword, secondary_keywords, content_type, target_url, target_word_count, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id || null, keyword,
        JSON.stringify(secondary_keywords || []),
        content_type || 'blog_post',
        target_url || '', target_word_count || 1500,
        req.user.id
      ]
    );

    // Create empty article, optionally saving working title
    db.insert(
      'INSERT INTO articles (project_id, meta_title) VALUES (?, ?)',
      [id, title || '']
    );

    const project = db.get('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json({
      ...project,
      secondary_keywords: JSON.parse(project.secondary_keywords || '[]'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.run('UPDATE projects SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Get article for project
router.get('/:id/article', (req, res) => {
  try {
    const article = db.get('SELECT * FROM articles WHERE project_id = ?', [req.params.id]);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json({
      ...article,
      outline: JSON.parse(article.outline || '[]'),
      faq_schema: JSON.parse(article.faq_schema || '[]'),
      internal_links: JSON.parse(article.internal_links || '[]'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Update article content
router.put('/:id/article', (req, res) => {
  try {
    const article = db.get('SELECT id FROM articles WHERE project_id = ?', [req.params.id]);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const { content, brief, outline, meta_title, meta_description, faq_schema, internal_links, word_count, readability_score, keyword_density, custom_instructions, status } = req.body;

    db.run(
      `UPDATE articles SET content=COALESCE(?,content), brief=COALESCE(?,brief), outline=COALESCE(?,outline),
       meta_title=COALESCE(?,meta_title), meta_description=COALESCE(?,meta_description),
       faq_schema=COALESCE(?,faq_schema), internal_links=COALESCE(?,internal_links),
       word_count=COALESCE(?,word_count), readability_score=COALESCE(?,readability_score),
       keyword_density=COALESCE(?,keyword_density), custom_instructions=COALESCE(?,custom_instructions), status=COALESCE(?,status),
       updated_at=CURRENT_TIMESTAMP WHERE project_id=?`,
      [
        content || null, brief || null,
        outline ? JSON.stringify(outline) : null,
        meta_title || null, meta_description || null,
        faq_schema ? JSON.stringify(faq_schema) : null,
        internal_links ? JSON.stringify(internal_links) : null,
        word_count || null, readability_score || null,
        keyword_density || null, custom_instructions || null, status || null,
        req.params.id
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

module.exports = router;
