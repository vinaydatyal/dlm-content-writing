// backend/db.js
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'seo_tool.db');
const dataDir = path.dirname(DB_PATH);

let db;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    products_services TEXT DEFAULT '[]',
    buyer_personas TEXT DEFAULT '[]',
    dos_and_donts TEXT DEFAULT '[]',
    good_examples TEXT DEFAULT '[]',
    bad_examples TEXT DEFAULT '[]',
    color TEXT DEFAULT '#6366f1',
    author_name TEXT DEFAULT '',
    author_credentials TEXT DEFAULT '',
    author_bio TEXT DEFAULT '',
    company_credentials TEXT DEFAULT '',
    preferred_citations TEXT DEFAULT '[]',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    keyword TEXT NOT NULL,
    secondary_keywords TEXT DEFAULT '[]',
    content_type TEXT NOT NULL DEFAULT 'blog_post',
    target_url TEXT,
    target_word_count INTEGER DEFAULT 1500,
    status TEXT DEFAULT 'brief',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bulk_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    items TEXT DEFAULT '[]',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    model TEXT DEFAULT 'claude-3-5-sonnet-20241022',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    instructions TEXT,
    target_word_count INTEGER DEFAULT 1500,
    tone_of_voice TEXT DEFAULT 'Professional',
    formatting_rules TEXT DEFAULT '',
    is_default BOOLEAN DEFAULT false,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS topic_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    pillar_keyword TEXT NOT NULL,
    pillar_title TEXT,
    search_intent TEXT DEFAULT 'informational',
    target_word_count INTEGER DEFAULT 3000,
    cluster_topics TEXT DEFAULT '[]',
    status TEXT DEFAULT 'planned',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

async function initDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA);

  // Migrations for existing DB
  const addCol = (table, col, def) => {
    try { db.run(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT DEFAULT "${def}"`); } catch (e) {}
  };

  addCol('clients', 'reference_content', '');
  addCol('clients', 'niche_category', 'general');
  addCol('clients', 'competitors', '[]');
  addCol('articles', 'custom_instructions', '');
  addCol('clients', 'author_name', '');
  addCol('clients', 'author_credentials', '');
  addCol('clients', 'author_bio', '');
  addCol('clients', 'company_credentials', '');
  addCol('clients', 'preferred_citations', '[]');
  addCol('clients', 'products_services', '[]');
  addCol('clients', 'buyer_personas', '[]');
  addCol('clients', 'dos_and_donts', '[]');
  addCol('clients', 'good_examples', '[]');
  addCol('clients', 'bad_examples', '[]');
  addCol('clients', 'brand_archetype', 'authoritative');
  addCol('projects', 'target_publish_date', '');
  addCol('projects', 'planned_notes', '');
  addCol('projects', 'cluster_id', '');
  
  addCol('templates', 'target_word_count', '1500');
  addCol('templates', 'tone_of_voice', 'Professional');
  addCol('templates', 'formatting_rules', '');

  saveDb();
  await seedTemplates();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Save on process exit
process.on('exit', saveDb);
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

function getDb() {
  return db;
}

// Helper: convert Postgres $1, $2 to SQLite ?
function convertQuery(sql) {
  return sql.replace(/\$\d+/g, '?');
}

// Helper: run a statement and save
function run(sql, params = []) {
  db.run(convertQuery(sql), params);
  saveDb();
}

// Helper: get one row
function get(sql, params = []) {
  const stmt = db.prepare(convertQuery(sql));
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// Helper: get all rows
function all(sql, params = []) {
  const stmt = db.prepare(convertQuery(sql));
  const rows = [];
  stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: insert and return lastID
function insert(sql, params = []) {
  db.run(convertQuery(sql), params);
  const result = db.exec('SELECT last_insert_rowid() as id');
  saveDb();
  if (result && result[0] && result[0].values[0]) {
    return result[0].values[0][0];
  }
  return null;
}

const PREDEFINED_TEMPLATES = [
  {
    name: 'Standard Blog (Informational Intent)',
    type: 'blog_post',
    instructions: 'Directly answer the primary user query within the first 100 words to target Google Featured Snippet (Position Zero). Break down core concepts logically with clear H2 headings, real-world examples, and actionable takeaways.',
    target_word_count: 1500,
    tone_of_voice: 'Conversational, authoritative, and helpful',
    formatting_rules: 'Use 2-3 sentence short paragraphs, bulleted lists for scannability, bold key concepts, and structured H2/H3 hierarchy.'
  },
  {
    name: 'Skyscraper 10x Pillar Guide (High Competition)',
    type: 'blog_post',
    instructions: 'Create an exhaustive, definitive master guide that out-ranks top 10 SERP competitors. Cover foundational definitions, advanced strategies, historical context, step-by-step frameworks, data-backed insights, and future trends.',
    target_word_count: 3000,
    tone_of_voice: 'Deeply authoritative, data-driven, and thought-leadership oriented',
    formatting_rules: 'Include comparison tables, statistical callout blocks, nested H3/H4 sub-sections, definition boxes, and comprehensive FAQ section.'
  },
  {
    name: 'Head-to-Head Comparison & "VS" Breakdown',
    type: 'blog_post',
    instructions: 'Deliver an objective, balanced head-to-head evaluation between competitors or alternatives. Break down Core Features, Pricing, Ease of Use, Customer Support, and Pros & Cons. Provide a "Winner by Category" breakdown and definitive final recommendation by persona.',
    target_word_count: 2000,
    tone_of_voice: 'Objective, analytical, unbiased, and advisory',
    formatting_rules: 'Use feature comparison tables, pros/cons bulleted lists, verdict scorecards, and clear recommendation callouts.'
  },
  {
    name: 'Curated Round-Up & Listicle ("Top X for Y")',
    type: 'blog_post',
    instructions: 'Curate a standout list of top tools, services, or strategies. For each item: quick summary badge, who it is best for, standout features, pricing tier, and key trade-off/limitation. Open with evaluation methodology and quick comparison table.',
    target_word_count: 2200,
    tone_of_voice: 'Engaging, energetic, fast-paced, and highly practical',
    formatting_rules: 'Quick-take overview table at top, numbered H2 sections for each item, "Best For" taglines, and key feature bullet points.'
  },
  {
    name: 'Step-by-Step How-To Tutorial',
    type: 'blog_post',
    instructions: 'Guide the reader through solving a specific problem or achieving a goal from start to finish. Include Prerequisites/Tools Needed, sequential numbered steps with clear instructions, common pitfalls/troubleshooting tips, and verification checklists.',
    target_word_count: 1800,
    tone_of_voice: 'Instructive, supportive, clear, and action-oriented',
    formatting_rules: 'Numbered step headings (Step 1, Step 2), highlighted warning/tip blockquotes, checklist summary at the end, and FAQ.'
  },
  {
    name: 'Content Refresh & SEO Optimizer (Surfer/Frase Mode)',
    type: 'content_refresh',
    instructions: 'Audit and overhaul existing ranking content to reclaim lost traffic and rank for new SERP entities. Identify competitor content gaps, update outdated statistics with current data, incorporate missing NLP entities, and improve overall E-E-A-T depth without losing existing keyword rankings.',
    target_word_count: 2000,
    tone_of_voice: 'Modern, authoritative, polished, and fresh',
    formatting_rules: 'Integrate new H2/H3 subtopics to fill competitor gaps, embed statistical citations with sources, and maintain readable 2-3 sentence paragraphs.'
  },
  {
    name: 'Commercial Product Page (High Conversion)',
    type: 'product_page',
    instructions: 'Craft persuasive commercial copy tailored to high buyer intent. Lead with emotional hooks and core value propositions, articulate specific pain points, showcase product features translated directly into customer benefits, tackle common objections, and conclude with high-converting Call-to-Actions (CTAs).',
    target_word_count: 1000,
    tone_of_voice: 'Persuasive, customer-centric, punchy, and confident',
    formatting_rules: 'Bold value propositions, short punchy benefit bullet points, testimonial/social proof placeholders, and prominent CTA anchors.'
  },
  {
    name: 'Local SEO & Service Location Page',
    type: 'location_page',
    instructions: 'Target localized search intent for city/region-specific services. Highlight local presence, response time, service area coverage, licensed expertise, emergency availability, and localized customer testimonials. Answer location-specific FAQs.',
    target_word_count: 1200,
    tone_of_voice: 'Trustworthy, approachable, professional, and community-focused',
    formatting_rules: 'Local landmark & service area bullet points, clear contact info CTA blocks, local review quotes, and localized schema-ready FAQ.'
  },
  {
    name: 'B2B Enterprise Service Landing Page',
    type: 'service_page',
    instructions: 'Structure an authoritative B2B service offering. Explain the strategic methodology/process (Discovery, Strategy, Execution, Reporting), tangible business deliverables, target ROI, client qualification criteria, and case study proof points.',
    target_word_count: 1500,
    tone_of_voice: 'Corporate, executive, consultative, and results-driven',
    formatting_rules: 'Process phase breakdown (Phase 1, Phase 2, Phase 3), deliverable summary tables, executive summary callouts, and schedule-a-call CTAs.'
  },
  {
    name: 'Topic Cluster Anchor & Pillar Page',
    type: 'info_page',
    instructions: 'Create a foundational educational pillar designed to anchor a topic cluster and distribute internal page authority. Define core concepts thoroughly, map out all sub-disciplines, and provide contextual anchor links to spoke articles throughout the guide.',
    target_word_count: 2500,
    tone_of_voice: 'Educational, academic yet accessible, structured, and comprehensive',
    formatting_rules: 'Table of contents anchor layout, glossary definition callout boxes, internal link anchor place-markers, and comprehensive reference citations.'
  }
];

async function seedTemplates() {
  console.log("Checking and syncing default templates...");
  for (const tpl of PREDEFINED_TEMPLATES) {
    const existing = get('SELECT id FROM templates WHERE name = ?', [tpl.name]);
    if (!existing) {
      run('INSERT INTO templates (name, type, instructions, target_word_count, tone_of_voice, formatting_rules, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [tpl.name, tpl.type, tpl.instructions, tpl.target_word_count, tpl.tone_of_voice, tpl.formatting_rules, true]);
    }
  }
}

module.exports = { initDb, getDb, run, get, all, insert, saveDb, PREDEFINED_TEMPLATES };

