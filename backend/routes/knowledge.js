const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authenticate);

// Configure multer for file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// GET /api/knowledge/:client_id
// List knowledge base documents for a client
router.get('/:client_id', async (req, res) => {
  try {
    const docs = await db.all(
      'SELECT id, title, created_at, length(content) as size FROM knowledge_base WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.client_id]
    );
    res.json(docs);
  } catch (err) {
    console.error('Error fetching knowledge base:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/knowledge/:client_id/text
// Add text document directly
router.post('/:client_id/text', async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

  try {
    const id = await db.insert(
      'INSERT INTO knowledge_base (client_id, title, content) VALUES ($1, $2, $3)',
      [req.params.client_id, title, content]
    );
    res.json({ id, title, success: true });
  } catch (err) {
    console.error('Error adding text doc:', err);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

// POST /api/knowledge/:client_id/upload
// Upload a file (txt, md, pdf)
router.post('/:client_id/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    let content = '';
    const title = req.file.originalname;

    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      content = pdfData.text;
    } else {
      // Assume text-based (txt, md, csv)
      content = req.file.buffer.toString('utf-8');
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from file' });
    }

    const id = await db.insert(
      'INSERT INTO knowledge_base (client_id, title, content) VALUES ($1, $2, $3)',
      [req.params.client_id, title, content]
    );
    
    res.json({ id, title, success: true });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// DELETE /api/knowledge/:id
// Delete a document
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM knowledge_base WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting doc:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
