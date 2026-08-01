const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authenticate);

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const templates = await db.all(
      `SELECT * FROM templates ORDER BY is_default DESC, name ASC`
    );
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/templates
router.post('/', async (req, res) => {
  const { name, type, instructions } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

  try {
    const id = await db.insert(
      `INSERT INTO templates (name, type, instructions, created_by) VALUES (?, ?, ?, ?)`,
      [name, type, instructions, req.user.id]
    );
    const template = await db.get('SELECT * FROM templates WHERE id = ?', [id]);
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/templates/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, instructions } = req.body;

  try {
    const existing = await db.get('SELECT * FROM templates WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.is_default) return res.status(403).json({ error: 'Cannot modify default templates' });

    await db.run(
      `UPDATE templates SET name = ?, type = ?, instructions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, type, instructions, id]
    );
    const updated = await db.get('SELECT * FROM templates WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await db.get('SELECT * FROM templates WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.is_default) return res.status(403).json({ error: 'Cannot delete default templates' });

    await db.run('DELETE FROM templates WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
