// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ──────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/serp', require('./routes/serp'));
app.use('/api/content', require('./routes/content'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/export', require('./routes/export'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard stats
app.get('/api/stats', require('./middleware/auth').authenticate, async (req, res) => {
  try {
    const db = require('./db');
    const [clientsRes, projectsRes, articlesRes, weekRes, wordsRes, tokensRes, recentRes] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM clients'),
      db.get('SELECT COUNT(*) as count FROM projects'),
      db.get('SELECT COUNT(*) as count FROM articles'),
      db.get("SELECT COUNT(*) as count FROM articles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"),
      db.get('SELECT COALESCE(SUM(word_count), 0) as total FROM articles'),
      db.get('SELECT COALESCE(SUM(tokens_used), 0) as total FROM usage_log WHERE user_id = $1', [req.user.id]),
      db.all(
        `SELECT p.*, c.name as client_name, c.color as client_color, a.word_count, a.status as article_status
         FROM projects p
         LEFT JOIN clients c ON p.client_id = c.id
         LEFT JOIN articles a ON a.project_id = p.id
         ORDER BY p.created_at DESC LIMIT 5`
      )
    ]);

    const stats = {
      total_clients: parseInt(clientsRes.count || 0, 10),
      total_projects: parseInt(projectsRes.count || 0, 10),
      total_articles: parseInt(articlesRes.count || 0, 10),
      articles_this_week: parseInt(weekRes.count || 0, 10),
      total_words: parseInt(wordsRes.total || 0, 10),
      tokens_used: parseInt(tokensRes.total || 0, 10),
      recent_projects: recentRes,
    };
    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Serve frontend statically
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  } else {
    next();
  }
});

// ─── Start ────────────────────────────────
async function start() {
  try {
    await initDb();
    console.log('✅ Database initialized');

    app.listen(PORT, () => {
      console.log(`🚀 SEO Content Tool API running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
