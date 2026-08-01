// backend/db.js
const { Pool } = require('pg');

let pool;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    website_url TEXT,
    industry TEXT,
    target_audience TEXT,
    tone TEXT DEFAULT 'professional',
    brand_voice TEXT,
    reference_content TEXT DEFAULT '',
    niche_category TEXT DEFAULT 'general',
    banned_words TEXT DEFAULT '[]',
    competitors TEXT DEFAULT '[]',
    internal_urls TEXT DEFAULT '[]',
    color TEXT DEFAULT '#6366f1',
    author_name TEXT DEFAULT '',
    author_credentials TEXT DEFAULT '',
    author_bio TEXT DEFAULT '',
    company_credentials TEXT DEFAULT '',
    preferred_citations TEXT DEFAULT '[]',
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    client_id INTEGER,
    keyword TEXT NOT NULL,
    secondary_keywords TEXT DEFAULT '[]',
    content_type TEXT NOT NULL DEFAULT 'blog_post',
    target_url TEXT,
    target_word_count INTEGER DEFAULT 1500,
    status TEXT DEFAULT 'brief',
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    serp_data TEXT DEFAULT '{}',
    brief TEXT DEFAULT '',
    outline TEXT DEFAULT '[]',
    content TEXT DEFAULT '',
    meta_title TEXT DEFAULT '',
    meta_description TEXT DEFAULT '',
    faq_schema TEXT DEFAULT '[]',
    internal_links TEXT DEFAULT '[]',
    word_count INTEGER DEFAULT 0,
    readability_score REAL DEFAULT 0,
    keyword_density REAL DEFAULT 0,
    custom_instructions TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bulk_jobs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    total INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    items TEXT DEFAULT '[]',
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usage_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    model TEXT DEFAULT 'claude-3-5-sonnet-20241022',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    instructions TEXT,
    is_default BOOLEAN DEFAULT false,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Helper: convert ? to $1, $2 for Postgres
function toPgQuery(sql, params) {
  let i = 1;
  const pgSql = sql.replace(/\?/g, () => `$${i++}`);
  return { text: pgSql, values: params || [] };
}

async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set. A PostgreSQL connection string is required.");
  }
  
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pool.query(SCHEMA);
    await seedTemplates();
  } catch (err) {
    console.error("Failed to execute schema:", err);
  }
}

async function seedTemplates() {
  const countRes = await get('SELECT COUNT(*) as count FROM templates');
  if (parseInt(countRes.count) === 0) {
    console.log("Seeding default templates...");
    const PREDEFINED_TEMPLATES = [
      // Blog Posts
      { name: 'Standard Blog (Informational Intent)', type: 'blog_post', instructions: 'Write in a conversational but professional tone. Focus on directly answering the user query in the first 100 words.' },
      { name: 'Skyscraper Content (High Competition)', type: 'blog_post', instructions: 'Write highly comprehensive 10x content. Include statistical data, expert quotes, and format heavily with tables, lists, and bold text.' },
      { name: 'Niche Topic (Long-Tail Intent)', type: 'blog_post', instructions: 'Focus deeply on hyper-specific subtopics. Use secondary keywords naturally. Keep language highly technical and authoritative.' },
      { name: 'Listicle / Top X (Discovery Intent)', type: 'blog_post', instructions: 'Keep each item concise. Highlight the unique selling point of each item. Optimize H3 tags for quick scanning.' },
      { name: 'Step-by-Step Guide (How-To Intent)', type: 'blog_post', instructions: 'Break down every step logically. Use numbered lists where possible. Include "Prerequisites" or "What you need" sections.' },
      
      // Product Pages
      { name: 'Product Page (Commercial Intent)', type: 'product_page', instructions: 'Focus heavily on benefits rather than just features. Use persuasive copywriting and end with a strong CTA.' },
      { name: 'Product Review (Transactional Intent)', type: 'product_page', instructions: 'Be objective but persuasive. List clear pros and cons. Include a "Final Verdict" or "Who this is for" section.' },
      { name: 'Product Comparison (Decision Intent)', type: 'product_page', instructions: 'Compare objectively across multiple dimensions. Emphasize differences in pricing, usability, and target audience.' },
      
      // Location Pages
      { name: 'Local SEO (Hyper-Local Focus)', type: 'location_page', instructions: 'Mention specific neighborhoods, local landmarks, and proximity to major roads. Establish trust as a local authority.' },
      { name: 'Local SEO (Broad City Service)', type: 'location_page', instructions: 'Focus on serving the entire metropolitan area. Detail service areas and incorporate broad geographic modifiers.' },
      
      // Service Pages
      { name: 'Core Service (Conversion Focus)', type: 'service_page', instructions: 'Clearly define the problem it solves, the process, and include trust signals (testimonials/guarantees). Use a strong, conversion-focused CTA.' },
      { name: 'Service Overview (Educational Focus)', type: 'service_page', instructions: 'Educate the reader on why they need this service. Break down industry jargon and outline the long-term ROI.' },
      
      // Info Pages
      { name: 'Comprehensive Guide (Evergreen)', type: 'info_page', instructions: 'Provide in-depth, authoritative information designed to be evergreen. Use varied formatting, definitions, and extensive examples.' },
      { name: 'FAQ / Glossary Hub', type: 'info_page', instructions: 'Format as direct Questions and Answers. Keep answers concise (under 50 words per answer) to target Featured Snippets.' },
    ];
    
    for (const tpl of PREDEFINED_TEMPLATES) {
      await run(
        'INSERT INTO templates (name, type, instructions, is_default) VALUES (?, ?, ?, ?)',
        [tpl.name, tpl.type, tpl.instructions, true]
      );
    }
  }
}

async function run(sql, params = []) {
  const query = toPgQuery(sql, params);
  await pool.query(query);
}

async function get(sql, params = []) {
  const query = toPgQuery(sql, params);
  const result = await pool.query(query);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const query = toPgQuery(sql, params);
  const result = await pool.query(query);
  return result.rows;
}

async function insert(sql, params = []) {
  const query = toPgQuery(sql, params);
  // append RETURNING id to get the inserted row id
  query.text += ' RETURNING id';
  const result = await pool.query(query);
  if (result.rows && result.rows.length > 0) {
    return result.rows[0].id;
  }
  return null;
}

module.exports = { initDb, run, get, all, insert };
