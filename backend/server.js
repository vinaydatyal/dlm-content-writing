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
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/bulk', require('./routes/bulk'));
app.use('/api/planning', require('./routes/planning'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard stats
app.get('/api/stats', require('./middleware/auth').authenticate, async (req, res) => {
  try {
    const db = require('./db');
    const [
      clientsRes, 
      projectsRes, 
      articlesRes, 
      weekRes, 
      wordsRes, 
      tokensRes, 
      recentRes,
      statusCounts,
      typeCounts,
      topClients,
      clustersRes,
      plannedRes,
      recentClusters
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM clients'),
      db.get('SELECT COUNT(*) as count FROM projects'),
      db.get('SELECT COUNT(*) as count FROM articles'),
      db.get("SELECT COUNT(*) as count FROM articles WHERE created_at >= datetime('now', '-7 days')"),
      db.get('SELECT COALESCE(SUM(word_count), 0) as total FROM articles'),
      db.get('SELECT COALESCE(SUM(tokens_used), 0) as total FROM usage_log WHERE user_id = ?', [req.user.id]),
      db.all(
        `SELECT p.*, c.name as client_name, c.color as client_color, a.word_count, a.status as article_status, a.id as article_id
         FROM projects p
         LEFT JOIN clients c ON p.client_id = c.id
         LEFT JOIN articles a ON a.project_id = p.id
         ORDER BY p.created_at DESC LIMIT 10`
      ),
      db.all('SELECT status, COUNT(*) as count FROM projects GROUP BY status'),
      db.all('SELECT content_type, COUNT(*) as count FROM projects GROUP BY content_type'),
      db.all(
        `SELECT c.id, c.name, c.color, COUNT(p.id) as project_count
         FROM clients c
         LEFT JOIN projects p ON p.client_id = c.id
         GROUP BY c.id ORDER BY project_count DESC LIMIT 5`
      ),
      db.get('SELECT COUNT(*) as count FROM topic_clusters').catch(() => ({ count: 0 })),
      db.get("SELECT COUNT(*) as count FROM projects WHERE status = 'planned'").catch(() => ({ count: 0 })),
      db.all(
        `SELECT tc.*, c.name as client_name, c.color as client_color 
         FROM topic_clusters tc 
         LEFT JOIN clients c ON tc.client_id = c.id 
         ORDER BY tc.created_at DESC LIMIT 4`
      ).catch(() => [])
    ]);

    const statusMap = { brief: 0, outline: 0, draft: 0, review: 0, completed: 0, planned: 0 };
    (statusCounts || []).forEach(row => {
      if (row.status && statusMap[row.status] !== undefined) {
        statusMap[row.status] = parseInt(row.count || 0, 10);
      }
    });

    const typeMap = {};
    (typeCounts || []).forEach(row => {
      if (row.content_type) {
        typeMap[row.content_type] = parseInt(row.count || 0, 10);
      }
    });

    const totalWords = parseInt(wordsRes?.total || 0, 10);
    // Average agency writing speed ~ 400 words per hour
    const hoursSaved = Math.round((totalWords / 400) * 10) / 10;

    const stats = {
      total_clients: parseInt(clientsRes?.count || 0, 10),
      total_projects: parseInt(projectsRes?.count || 0, 10),
      total_articles: parseInt(articlesRes?.count || 0, 10),
      articles_this_week: parseInt(weekRes?.count || 0, 10),
      total_clusters: parseInt(clustersRes?.count || 0, 10),
      planned_projects: parseInt(plannedRes?.count || 0, 10),
      total_words: totalWords,
      hours_saved: hoursSaved,
      tokens_used: parseInt(tokensRes?.total || 0, 10),
      status_breakdown: statusMap,
      type_breakdown: typeMap,
      top_clients: topClients || [],
      recent_clusters: (recentClusters || []).map(cl => ({
        ...cl,
        cluster_topics: cl.cluster_topics ? (typeof cl.cluster_topics === 'string' ? JSON.parse(cl.cluster_topics) : cl.cluster_topics) : []
      })),
      recent_projects: recentRes || [],
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
