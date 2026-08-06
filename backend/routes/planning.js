// backend/routes/planning.js
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
    }
  }
  return puter;
}

// ─────────────────────────────────────────────────────────────
// 1. TOPIC CLUSTERS CRUD & MANAGEMENT
// ─────────────────────────────────────────────────────────────

// GET /api/planning/clusters (List all clusters)
router.get('/clusters', async (req, res) => {
  try {
    const { client_id } = req.query;
    let clusters;
    if (client_id) {
      clusters = await db.all(
        `SELECT tc.*, c.name as client_name, c.color as client_color,
         (SELECT COUNT(*) FROM projects p WHERE p.cluster_id = tc.id) as project_count,
         (SELECT COUNT(*) FROM projects p JOIN articles a ON a.project_id = p.id WHERE p.cluster_id = tc.id AND a.status = 'completed') as completed_count
         FROM topic_clusters tc
         LEFT JOIN clients c ON tc.client_id = c.id
         WHERE tc.client_id = ?
         ORDER BY tc.created_at DESC`,
        [client_id]
      );
    } else {
      clusters = await db.all(
        `SELECT tc.*, c.name as client_name, c.color as client_color,
         (SELECT COUNT(*) FROM projects p WHERE p.cluster_id = tc.id) as project_count,
         (SELECT COUNT(*) FROM projects p JOIN articles a ON a.project_id = p.id WHERE p.cluster_id = tc.id AND a.status = 'completed') as completed_count
         FROM topic_clusters tc
         LEFT JOIN clients c ON tc.client_id = c.id
         ORDER BY tc.created_at DESC`
      );
    }

    res.json(clusters.map(c => ({
      ...c,
      cluster_topics: JSON.parse(c.cluster_topics || '[]')
    })));
  } catch (err) {
    console.error('Fetch clusters error:', err);
    res.status(500).json({ error: 'Failed to fetch topic clusters' });
  }
});

// GET /api/planning/clusters/:id
router.get('/clusters/:id', async (req, res) => {
  try {
    const cluster = await db.get(
      `SELECT tc.*, c.name as client_name, c.color as client_color, c.website_url, c.industry, c.target_audience
       FROM topic_clusters tc
       LEFT JOIN clients c ON tc.client_id = c.id
       WHERE tc.id = ?`,
      [req.params.id]
    );

    if (!cluster) return res.status(404).json({ error: 'Topic cluster not found' });

    // Fetch linked projects
    const projects = await db.all(
      `SELECT p.*, a.id as article_id, a.word_count, a.status as article_status, a.readability_score
       FROM projects p
       LEFT JOIN articles a ON a.project_id = p.id
       WHERE p.cluster_id = ?
       ORDER BY p.target_publish_date ASC, p.created_at ASC`,
      [req.params.id]
    );

    res.json({
      ...cluster,
      cluster_topics: JSON.parse(cluster.cluster_topics || '[]'),
      projects: projects.map(p => ({
        ...p,
        secondary_keywords: JSON.parse(p.secondary_keywords || '[]')
      }))
    });
  } catch (err) {
    console.error('Fetch cluster error:', err);
    res.status(500).json({ error: 'Failed to fetch topic cluster' });
  }
});

// POST /api/planning/clusters
router.post('/clusters', async (req, res) => {
  try {
    const { client_id, pillar_keyword, pillar_title, search_intent, target_word_count, cluster_topics, status } = req.body;
    if (!pillar_keyword) return res.status(400).json({ error: 'Pillar keyword is required' });

    const id = await db.insert(
      `INSERT INTO topic_clusters (client_id, pillar_keyword, pillar_title, search_intent, target_word_count, cluster_topics, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id || null,
        pillar_keyword.trim(),
        pillar_title || pillar_keyword.trim(),
        search_intent || 'informational',
        target_word_count || 3000,
        JSON.stringify(cluster_topics || []),
        status || 'planned',
        req.user.id
      ]
    );

    const created = await db.get('SELECT * FROM topic_clusters WHERE id = ?', [id]);
    res.status(201).json({
      ...created,
      cluster_topics: JSON.parse(created.cluster_topics || '[]')
    });
  } catch (err) {
    console.error('Create cluster error:', err);
    res.status(500).json({ error: 'Failed to create topic cluster' });
  }
});

// PUT /api/planning/clusters/:id
router.put('/clusters/:id', async (req, res) => {
  try {
    const { client_id, pillar_keyword, pillar_title, search_intent, target_word_count, cluster_topics, status } = req.body;
    await db.run(
      `UPDATE topic_clusters SET
       client_id = COALESCE(?, client_id),
       pillar_keyword = COALESCE(?, pillar_keyword),
       pillar_title = COALESCE(?, pillar_title),
       search_intent = COALESCE(?, search_intent),
       target_word_count = COALESCE(?, target_word_count),
       cluster_topics = COALESCE(?, cluster_topics),
       status = COALESCE(?, status),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        client_id !== undefined ? client_id : null,
        pillar_keyword || null,
        pillar_title || null,
        search_intent || null,
        target_word_count || null,
        cluster_topics ? JSON.stringify(cluster_topics) : null,
        status || null,
        req.params.id
      ]
    );

    const updated = await db.get('SELECT * FROM topic_clusters WHERE id = ?', [req.params.id]);
    res.json({
      ...updated,
      cluster_topics: JSON.parse(updated.cluster_topics || '[]')
    });
  } catch (err) {
    console.error('Update cluster error:', err);
    res.status(500).json({ error: 'Failed to update topic cluster' });
  }
});

// DELETE /api/planning/clusters/:id
router.delete('/clusters/:id', async (req, res) => {
  try {
    // Unlink projects from this cluster (keep projects alive)
    await db.run('UPDATE projects SET cluster_id = NULL WHERE cluster_id = ?', [req.params.id]);
    await db.run('DELETE FROM topic_clusters WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete cluster error:', err);
    res.status(500).json({ error: 'Failed to delete topic cluster' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. AI TOPIC CLUSTER GENERATOR & INTERNAL LINKING BLUEPRINT
// ─────────────────────────────────────────────────────────────

// POST /api/planning/generate-cluster
router.post('/generate-cluster', async (req, res) => {
  const { pillar_keyword, client_id, niche, target_audience } = req.body;
  if (!pillar_keyword) return res.status(400).json({ error: 'Pillar keyword is required' });

  try {
    let clientContext = '';
    if (client_id) {
      const client = await db.get('SELECT * FROM clients WHERE id = ?', [client_id]);
      if (client) {
        clientContext = `
Client Brand: ${client.name}
Industry: ${client.industry || niche || 'General'}
Target Audience: ${client.target_audience || target_audience || 'B2B/B2C'}
Key Products/Services: ${client.products_services || '[]'}
`;
      }
    }

    const ai = await getPuter();
    const prompt = `You are a world-class SEO Content Strategist and Topical Authority Architect.
You need to design a comprehensive Topic Cluster (Hub and Spoke model) anchored around the core Pillar Keyword: "${pillar_keyword}".

${clientContext}

REQUIREMENTS:
1. Define the 10x Pillar Guide (Master comprehensive resource, ~2500-3500 words).
2. Generate 6 to 8 highly targeted Supporting Cluster Spoke Topics that cover specific sub-intents, how-tos, comparisons, pain points, or buyer queries.
3. For EACH spoke topic, provide:
   - "title": Standout click-worthy SEO title
   - "keyword": Target long-tail keyword
   - "search_intent": "informational" | "commercial" | "transactional" | "navigational"
   - "target_words": 1200 - 2200
   - "difficulty": "Low" | "Medium" | "High"
   - "opportunity": "High" | "Medium" | "Quick Win"
   - "angle": 1-2 sentence core angle/unique value proposition
   - "internal_linking":
       - "to_pillar_anchor": Exact contextual anchor text to link UP to the Pillar Guide.
       - "cross_spoke_recommendation": How this article should link to another sibling spoke in this cluster.
       - "cross_spoke_anchor": Anchor text for the sibling link.

FORMAT REQUIREMENT:
Return ONLY a valid JSON object in this exact schema:
{
  "pillar": {
    "keyword": "${pillar_keyword}",
    "title": "Comprehensive Title for the Master Pillar Guide",
    "search_intent": "informational",
    "target_words": 3000,
    "angle": "Exhaustive, definitive guide covering foundational concepts through advanced strategies.",
    "role": "Central Authority Hub (Pillar)"
  },
  "cluster_topics": [
    {
      "id": "spoke-1",
      "title": "...",
      "keyword": "...",
      "search_intent": "informational",
      "target_words": 1500,
      "difficulty": "Low",
      "opportunity": "Quick Win",
      "angle": "...",
      "internal_linking": {
        "to_pillar_anchor": "...",
        "cross_spoke_recommendation": "...",
        "cross_spoke_anchor": "..."
      }
    }
  ]
}

Return ONLY the raw JSON object. No markdown formatting, no other commentary.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let clusterData = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      clusterData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch (parseErr) {
      console.warn('AI Cluster parse failed, creating structured fallback', parseErr);
      clusterData = {
        pillar: {
          keyword: pillar_keyword,
          title: `The Ultimate Master Guide to ${pillar_keyword}`,
          search_intent: 'informational',
          target_words: 3000,
          angle: `Definitive authority pillar guide on ${pillar_keyword} from fundamentals to advanced implementation.`,
          role: 'Central Authority Hub (Pillar)'
        },
        cluster_topics: [
          {
            id: 'spoke-1',
            title: `${pillar_keyword} Best Practices for 2026`,
            keyword: `${pillar_keyword} best practices`,
            search_intent: 'informational',
            target_words: 1600,
            difficulty: 'Low',
            opportunity: 'Quick Win',
            angle: 'Proven frameworks and actionable tips for execution.',
            internal_linking: {
              to_pillar_anchor: `complete master guide on ${pillar_keyword}`,
              cross_spoke_recommendation: `tools for ${pillar_keyword}`,
              cross_spoke_anchor: `top ${pillar_keyword} tools`
            }
          },
          {
            id: 'spoke-2',
            title: `Step-by-Step ${pillar_keyword} Implementation Checklist`,
            keyword: `how to do ${pillar_keyword}`,
            search_intent: 'informational',
            target_words: 1800,
            difficulty: 'Medium',
            opportunity: 'High',
            angle: 'Practical step-by-step tutorial with checklists.',
            internal_linking: {
              to_pillar_anchor: `foundations of ${pillar_keyword}`,
              cross_spoke_recommendation: 'common mistakes to avoid',
              cross_spoke_anchor: 'avoiding key errors'
            }
          },
          {
            id: 'spoke-3',
            title: `Top 10 Tools & Software for ${pillar_keyword}`,
            keyword: `best ${pillar_keyword} tools`,
            search_intent: 'commercial',
            target_words: 2000,
            difficulty: 'Medium',
            opportunity: 'High',
            angle: 'Curated tool review with pros, cons, and pricing.',
            internal_linking: {
              to_pillar_anchor: `strategic ${pillar_keyword} roadmap`,
              cross_spoke_recommendation: 'best practices guide',
              cross_spoke_anchor: 'effective implementation strategies'
            }
          },
          {
            id: 'spoke-4',
            title: `7 Costly ${pillar_keyword} Mistakes (And How to Avoid Them)`,
            keyword: `${pillar_keyword} mistakes`,
            search_intent: 'informational',
            target_words: 1400,
            difficulty: 'Low',
            opportunity: 'Quick Win',
            angle: 'Troubleshooting guide highlighting high-risk pitfalls.',
            internal_linking: {
              to_pillar_anchor: `master guide to ${pillar_keyword}`,
              cross_spoke_recommendation: 'implementation checklist',
              cross_spoke_anchor: 'following our verified checklist'
            }
          }
        ]
      };
    }

    const tokensUsed = 600;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
      [req.user.id, 'generate_topic_cluster', tokensUsed]);

    res.json({ cluster: clusterData, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Cluster generation error:', err);
    res.status(500).json({ error: 'Failed to generate topic cluster: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. BATCH SCHEDULE CLUSTER TO CONTENT CALENDAR
// ─────────────────────────────────────────────────────────────

// POST /api/planning/batch-schedule-cluster
router.post('/batch-schedule-cluster', async (req, res) => {
  const { cluster_id, start_date, cadence, client_id, include_pillar } = req.body;
  if (!cluster_id) return res.status(400).json({ error: 'cluster_id is required' });

  try {
    const cluster = await db.get('SELECT * FROM topic_clusters WHERE id = ?', [cluster_id]);
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

    const topics = JSON.parse(cluster.cluster_topics || '[]');
    const itemsToSchedule = [];

    // Include Pillar first if requested
    if (include_pillar !== false) {
      itemsToSchedule.push({
        keyword: cluster.pillar_keyword,
        title: cluster.pillar_title || cluster.pillar_keyword,
        content_type: 'info_page',
        target_word_count: cluster.target_word_count || 3000,
        notes: `[Pillar Page Anchor] Hub for topic cluster: ${cluster.pillar_keyword}`
      });
    }

    // Add Spoke topics
    topics.forEach(t => {
      itemsToSchedule.push({
        keyword: t.keyword || t.title,
        title: t.title,
        content_type: t.search_intent === 'commercial' ? 'product_page' : 'blog_post',
        target_word_count: t.target_words || 1500,
        notes: `[Cluster Spoke] Links to Pillar via: "${t.internal_linking?.to_pillar_anchor || cluster.pillar_keyword}"`
      });
    });

    // Calculate dates based on start_date and cadence
    let baseDate = start_date ? new Date(start_date) : new Date();
    const intervalDays = cadence === 'twice_weekly' ? 3.5 : cadence === 'biweekly' ? 14 : 7; // default weekly

    const createdProjects = [];

    for (let i = 0; i < itemsToSchedule.length; i++) {
      const item = itemsToSchedule[i];
      const pubDate = new Date(baseDate.getTime() + (i * intervalDays * 24 * 60 * 60 * 1000));
      const formattedDate = `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')}`;

      const projId = await db.insert(
        `INSERT INTO projects (client_id, cluster_id, keyword, content_type, target_word_count, target_publish_date, planned_notes, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          client_id || cluster.client_id || null,
          cluster.id,
          item.keyword,
          item.content_type,
          item.target_word_count,
          formattedDate,
          item.notes,
          'planned',
          req.user.id
        ]
      );

      // Create linked article with meta_title
      await db.insert('INSERT INTO articles (project_id, meta_title) VALUES (?, ?)', [projId, item.title]);

      createdProjects.push({ id: projId, keyword: item.keyword, publish_date: formattedDate });
    }

    // Update cluster status to active
    await db.run("UPDATE topic_clusters SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [cluster.id]);

    res.json({
      success: true,
      scheduled_count: createdProjects.length,
      projects: createdProjects
    });
  } catch (err) {
    console.error('Batch schedule cluster error:', err);
    res.status(500).json({ error: 'Failed to batch schedule cluster' });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. COMPETITOR CONTENT GAP MINING ENGINE
// ─────────────────────────────────────────────────────────────

// POST /api/planning/competitor-gaps
router.post('/competitor-gaps', async (req, res) => {
  const { seed_topic, competitor_urls, client_id } = req.body;
  if (!seed_topic && !client_id) {
    return res.status(400).json({ error: 'Seed topic or Client is required' });
  }

  try {
    let clientData = null;
    if (client_id) {
      clientData = await db.get('SELECT * FROM clients WHERE id = ?', [client_id]);
    }

    const brandName = clientData?.name || 'Your Website';
    const industry = clientData?.industry || 'General';
    const competitors = competitor_urls || (clientData?.competitors ? JSON.parse(clientData.competitors || '[]').join(', ') : 'Top Industry Competitors');

    const ai = await getPuter();
    const prompt = `You are a premier SEO Competitive Intelligence Analyst and Content Gap Strategist.
Target Niche / Topic: "${seed_topic || industry}"
Client Brand: "${brandName}"
Competitors to Mine: ${competitors}

Perform an exhaustive Competitor Content Gap Audit to discover high-value keyword and content opportunities that competitors are ranking for or dominating, which ${brandName} should target to capture search market share.

Provide 3 distinct categories of Content Gaps:
1. "missing_topics": High-volume, primary informational & commercial keywords where competitors rank on Page 1, but we have ZERO content.
2. "weak_coverage_gaps": Topics where competitors have thin, outdated, or poorly structured content, making it an easy target for an authoritative 10x Skyscraper guide.
3. "paa_question_gaps": High-intent "People Also Ask" search queries & Featured Snippet questions where position zero is up for grabs.

For each gap item, provide:
- "title": Suggested article headline
- "keyword": Primary target search query
- "search_intent": "informational" | "commercial" | "transactional"
- "gap_type": "missing_topic" | "weak_coverage" | "paa_question"
- "opportunity_score": "High" | "Medium" | "Quick Win"
- "est_search_volume": "e.g. 2.4k/mo"
- "competitor_url": "Competitor domain or ranking example"
- "why_target": "Clear rationale on how targeting this gap creates a strategic ranking advantage."
- "suggested_words": 1500 - 2500

FORMAT REQUIREMENT:
Return ONLY a valid JSON object:
{
  "summary": {
    "total_gaps_found": 8,
    "high_opportunity_count": 5,
    "quick_win_count": 3
  },
  "gaps": [
    {
      "id": "gap-1",
      "title": "...",
      "keyword": "...",
      "search_intent": "informational",
      "gap_type": "missing_topic",
      "opportunity_score": "High",
      "est_search_volume": "1.8k/mo",
      "competitor_url": "competitor.com/ranking-article",
      "why_target": "...",
      "suggested_words": 1800
    }
  ]
}

Return ONLY raw JSON. No markdown backticks.`;

    const resp = await ai.ai.chat(prompt);
    const text = typeof resp === 'string' ? resp : (resp?.text || resp?.message?.content || JSON.stringify(resp));

    let result = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      result = {
        summary: { total_gaps_found: 4, high_opportunity_count: 3, quick_win_count: 1 },
        gaps: [
          {
            id: 'gap-1',
            title: `Complete Guide to ${seed_topic || 'Industry'} Implementation`,
            keyword: `${seed_topic || 'industry'} implementation guide`,
            search_intent: 'informational',
            gap_type: 'missing_topic',
            opportunity_score: 'High',
            est_search_volume: '2.1k/mo',
            competitor_url: 'top-competitor.com/guide',
            why_target: 'Competitors have established high topical authority; creating a superior guide will capture commercial intent.',
            suggested_words: 2200
          },
          {
            id: 'gap-2',
            title: `${seed_topic || 'Industry'} Pricing & Cost Breakdown 2026`,
            keyword: `${seed_topic || 'industry'} cost`,
            search_intent: 'commercial',
            gap_type: 'weak_coverage',
            opportunity_score: 'Quick Win',
            est_search_volume: '1.4k/mo',
            competitor_url: 'competitor.com/pricing-overview',
            why_target: 'Competitor content is outdated from 2023 with broken pricing tables.',
            suggested_words: 1600
          }
        ]
      };
    }

    const tokensUsed = 500;
    await db.run('INSERT INTO usage_log (user_id, action, tokens_used) VALUES ($1, $2, $3)',
      [req.user.id, 'competitor_gap_mining', tokensUsed]);

    res.json({ data: result, tokens_used: tokensUsed });
  } catch (err) {
    console.error('Competitor gap mining error:', err);
    res.status(500).json({ error: 'Failed to mine competitor gaps: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. CONVERT GAP ITEM TO SCHEDULED PROJECT OR INSTANT DRAFT
// ─────────────────────────────────────────────────────────────

// POST /api/planning/convert-gap-to-project
router.post('/convert-gap-to-project', async (req, res) => {
  const { keyword, title, client_id, cluster_id, content_type, target_word_count, target_publish_date, notes, status } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    const projId = await db.insert(
      `INSERT INTO projects (client_id, cluster_id, keyword, content_type, target_word_count, target_publish_date, planned_notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id || null,
        cluster_id || null,
        keyword.trim(),
        content_type || 'blog_post',
        target_word_count || 1500,
        target_publish_date || '',
        notes || 'Converted from Competitor Gap Analysis',
        status || 'planned',
        req.user.id
      ]
    );

    // Create article record
    await db.insert('INSERT INTO articles (project_id, meta_title) VALUES (?, ?)', [projId, title || keyword]);

    const createdProject = await db.get('SELECT * FROM projects WHERE id = ?', [projId]);
    res.status(201).json({
      success: true,
      project: createdProject
    });
  } catch (err) {
    console.error('Convert gap to project error:', err);
    res.status(500).json({ error: 'Failed to convert gap to project' });
  }
});

module.exports = router;
