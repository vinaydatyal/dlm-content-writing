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

async function seedTemplates() {
  const countRes = get('SELECT COUNT(*) as count FROM templates');
  if (parseInt(countRes.count) === 0) {
    console.log("Seeding default templates...");
    const PREDEFINED_TEMPLATES = [
      { name: 'Standard Blog (Informational Intent)', type: 'blog_post', instructions: 'Focus on directly answering the user query in the first 100 words.', target_word_count: 1500, tone_of_voice: 'Conversational but professional', formatting_rules: 'Use short paragraphs, bullet points, and clear H2s.' },
      { name: 'Skyscraper Content (High Competition)', type: 'blog_post', instructions: 'Write highly comprehensive 10x content. Include statistical data and expert quotes.', target_word_count: 2500, tone_of_voice: 'Authoritative and data-driven', formatting_rules: 'Format heavily with tables, lists, bold text, and nested H3s.' },
      { name: 'Product Page (Commercial Intent)', type: 'product_page', instructions: 'Focus heavily on benefits rather than just features. End with a strong CTA.', target_word_count: 800, tone_of_voice: 'Persuasive and engaging', formatting_rules: 'Use short punchy sentences, highlight key benefits in bold.' }
    ];
    
    for (const tpl of PREDEFINED_TEMPLATES) {
      run('INSERT INTO templates (name, type, instructions, target_word_count, tone_of_voice, formatting_rules, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [tpl.name, tpl.type, tpl.instructions, tpl.target_word_count, tpl.tone_of_voice, tpl.formatting_rules, true]);
    }
  }
}

module.exports = { initDb, getDb, run, get, all, insert, saveDb };
