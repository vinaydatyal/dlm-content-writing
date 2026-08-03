const express = require('express');
const axios = require('axios');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Store active job to prevent multiple loops
let isProcessing = false;

// GET /api/bulk/:client_id
router.get('/:client_id', async (req, res) => {
  try {
    const jobs = await db.all('SELECT * FROM bulk_jobs WHERE client_id = $1 ORDER BY created_at DESC', [req.params.client_id]);
    res.json(jobs.map(j => ({ ...j, items: JSON.parse(j.items || '[]') })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bulk jobs' });
  }
});

// POST /api/bulk
router.post('/', async (req, res) => {
  const { client_id, name, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Items required' });

  try {
    // Determine the base API URL (for local self-requests)
    const port = process.env.PORT || 3001;
    const baseUrl = `http://localhost:${port}/api`;

    // Create bulk job
    const jobId = await db.insert(
      'INSERT INTO bulk_jobs (name, client_id, total, items, created_by) VALUES ($1, $2, $3, $4, $5)',
      [name || 'Bulk Job', client_id, items.length, JSON.stringify(items), req.user.id]
    );

    res.json({ success: true, job_id: jobId });

    // Kick off worker asynchronously
    processQueue(baseUrl, client_id);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create bulk job' });
  }
});

async function processQueue(baseUrl, clientId) {
  if (isProcessing) return;
  isProcessing = true;
  
  console.log('[BULK] Starting queue processor...');
  
  try {
    while (true) {
      const job = await db.get('SELECT * FROM bulk_jobs WHERE status = "pending" OR status = "processing" ORDER BY created_at ASC LIMIT 1');
      if (!job) break;
      
      if (job.status === 'pending') {
        await db.run('UPDATE bulk_jobs SET status = "processing" WHERE id = $1', [job.id]);
      }
      
      const items = JSON.parse(job.items || '[]');
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.status === 'completed' || item.status === 'failed') continue;
        
        try {
          console.log(`[BULK] Processing item: ${item.keyword}`);
          
          // 1. Create Project
          const projRes = await axios.post(`${baseUrl}/projects`, {
            client_id: clientId,
            keyword: item.keyword,
            target_url: item.target_url || '',
            content_type: item.target_url ? 'content_refresh' : 'blog_post'
          });
          const projectId = projRes.data.id;
          
          // 2. SERP Analysis
          const serpRes = await axios.post(`${baseUrl}/serp/analyze`, {
            keyword: item.keyword,
            target_url: item.target_url || '',
            content_type: item.target_url ? 'content_refresh' : 'blog_post'
          });
          
          const clientRes = await axios.get(`${baseUrl}/clients/${clientId}`);
          const clientProfile = clientRes.data;
          
          // 3. Brief
          const briefRes = await axios.post(`${baseUrl}/content/brief`, {
            keyword: item.keyword,
            serp_data: serpRes.data,
            existing_content: serpRes.data.existing_content || '',
            content_type: item.target_url ? 'content_refresh' : 'blog_post',
            client_profile: clientProfile
          });
          const brief = briefRes.data.brief;
          
          // 4. Outline
          const outlineRes = await axios.post(`${baseUrl}/content/outline`, {
            keyword: item.keyword,
            brief: brief,
            serp_data: serpRes.data
          });
          const outline = outlineRes.data.outline;
          
          // 5. Generate Content Sections Sequentially
          let fullContent = '';
          for (const section of outline) {
             const genRes = await axios.post(`${baseUrl}/content/generate`, {
               keyword: item.keyword,
               section: section,
               outline: outline,
               brief: brief,
               client_profile: clientProfile,
               existing_content: serpRes.data.existing_content || ''
             }, { responseType: 'stream' });
             
             let sectionContent = await new Promise((resolve, reject) => {
               let text = '';
               genRes.data.on('data', chunk => {
                 const lines = chunk.toString().split('\\n\\n');
                 for (const line of lines) {
                   if (line.startsWith('data: ')) {
                     try {
                       const parsed = JSON.parse(line.replace('data: ', ''));
                       if (parsed.text) text += parsed.text;
                     } catch(e) {}
                   }
                 }
               });
               genRes.data.on('end', () => resolve(text));
               genRes.data.on('error', reject);
             });
             
             fullContent += `\n\n## ${section.heading}\n\n${sectionContent}`;
          }
          
          // 6. Polish
          const polishRes = await axios.post(`${baseUrl}/content/polish`, {
             keyword: item.keyword,
             content: fullContent,
             client_profile: clientProfile,
             internal_urls: clientProfile.internal_urls || []
          });
          const polishData = polishRes.data;
          
          // 7. Save to DB
          await axios.put(`${baseUrl}/projects/${projectId}/article`, {
            content: fullContent,
            brief: brief,
            outline: outline,
            meta_title: polishData.meta_title,
            meta_description: polishData.meta_description,
            faq_schema: polishData.faq_schema,
            status: 'completed'
          });
          
          item.status = 'completed';
          await db.run('UPDATE bulk_jobs SET completed = completed + 1, items = $1 WHERE id = $2', [JSON.stringify(items), job.id]);
          
        } catch (itemErr) {
          console.error(`[BULK] Error processing item ${item.keyword}:`, itemErr.message);
          item.status = 'failed';
          await db.run('UPDATE bulk_jobs SET failed = failed + 1, items = $1 WHERE id = $2', [JSON.stringify(items), job.id]);
        }
      }
      
      await db.run('UPDATE bulk_jobs SET status = "completed" WHERE id = $1', [job.id]);
    }
  } catch (err) {
    console.error('[BULK] Queue processor crashed:', err);
  } finally {
    isProcessing = false;
  }
}

module.exports = router;
