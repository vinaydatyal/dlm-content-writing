// backend/routes/serp.js
const express = require('express');
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to avoid basic bot detection
puppeteer.use(StealthPlugin());

const router = express.Router();
router.use(authenticate);

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,800',
      ],
      ignoreHTTPSErrors: true,
    });
  }
  return browserInstance;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: Live Chrome Scraping (Puppeteer)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchPuppeteerSERP(keyword) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers to look like a real user
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&hl=en&gl=us`;
    
    // Go to Google and wait for the results container to load
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check for CAPTCHA (simplified check)
    const pageTitle = await page.title();
    if (pageTitle.includes('Sorry') || await page.$('form[action="CaptchaRedirect"]')) {
      throw new Error("CAPTCHA_DETECTED");
    }

    // Attempt to dismiss cookie consent (common on headless browsers)
    try {
      // puppeteer pseudo-selector for text
      const acceptBtn = await page.$('button::-p-text(Accept all)');
      if (acceptBtn) {
        await acceptBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch(e) {
      // Ignore if no cookie banner
    }

    // Wait for the main search results div
    try {
      await page.waitForSelector('#search', { timeout: 10000 });
    } catch (e) {
      const title = await page.title();
      throw new Error(`Selector '#search' not found. Page title: "${title}". Google might be showing a CAPTCHA or blocking this IP.`);
    }

    // Extract data directly from the DOM
    const serpData = await page.evaluate((keyword) => {
      // 1. Organic Results
      const results = [];
      const resultElements = document.querySelectorAll('div.g');
      
      let position = 1;
      resultElements.forEach((el) => {
        const titleEl = el.querySelector('h3');
        const linkEl = el.querySelector('a');
        
        // Snippet is tricky as Google changes classes, but it's usually inside data-sncf="x" or specific spans
        let snippet = '';
        const textNodes = Array.from(el.querySelectorAll('div'))
          .map(d => d.innerText || '')
          .filter(t => t.length > 50 && !t.includes('http'));
        
        if (textNodes.length > 0) {
           snippet = textNodes[textNodes.length - 1]; 
        } else {
           const snippetEl = el.querySelector('div[style*="-webkit-line-clamp"]');
           if (snippetEl) snippet = snippetEl.innerText;
        }

        if (titleEl && linkEl && linkEl.href && !linkEl.href.includes('google.com')) {
          results.push({
            position: position++,
            title: titleEl.innerText,
            url: linkEl.href,
            snippet: snippet.replace(/\n/g, ' ').substring(0, 200).trim()
          });
        }
      });

      // 2. People Also Ask
      const paa = [];
      const paaElements = document.querySelectorAll('.related-question-pair');
      paaElements.forEach(el => {
        const textEl = el.querySelector('div[role="button"], span');
        if (textEl && textEl.innerText) {
          paa.push(textEl.innerText.trim());
        }
      });
      if (paa.length === 0) {
        document.querySelectorAll('div[data-abe] span').forEach(el => {
           if(el.innerText && el.innerText.includes('?')) paa.push(el.innerText.trim());
        });
      }

      // 3. Related Searches
      const related = [];
      document.querySelectorAll('div.s75CSd, div[data-text-ad="1"] ~ div a div').forEach(el => {
        if (el.innerText) related.push(el.innerText.trim());
      });

      return {
        keyword,
        source: 'puppeteer_chrome',
        top_results: results.slice(0, 10),
        people_also_ask: paa.slice(0, 8),
        related_searches: related.slice(0, 8),
        serp_features: [],
        content_gaps: [],
      };
    }, keyword);

    serpData.avg_word_count = 1200 + Math.floor(Math.random() * 800);
    return serpData;

  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: SerpApi (serpapi.com) - Highly Reliable
// ─────────────────────────────────────────────────────────────────────────────
async function fetchSerpApi(keyword) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error('SERP_API_KEY not configured');
  }

  const response = await axios.get('https://serpapi.com/search', {
    params: {
      engine: 'google',
      q: keyword,
      api_key: apiKey,
      num: 10,
    },
    timeout: 20000,
  });

  const data = response.data;
  const organic = data.organic_results || [];

  if (!organic.length) {
    throw new Error('No organic results returned from SerpApi');
  }

  const paa = (data.related_questions || []).map(q => q.question);
  const related = (data.related_searches || []).map(r => r.query);

  return {
    keyword,
    source: 'serpapi',
    top_results: organic.slice(0, 10).map((r, i) => ({
      position: r.position || i + 1,
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    })),
    people_also_ask: paa.slice(0, 8),
    related_searches: related.slice(0, 8),
    avg_word_count: 1200 + Math.floor(Math.random() * 800),
    serp_features: [],
    content_gaps: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: Google Custom Search API (Fallback)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGoogleCSE(keyword) {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID || process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!apiKey || !cx) {
    throw new Error('GOOGLE_CSE_API_KEY or GOOGLE_CSE_ID not configured properly');
  }

  const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
    params: {
      key: apiKey,
      cx: cx,
      q: keyword,
      num: 10,
    },
    timeout: 15000,
  });

  const results = response.data.items || [];

  if (!results.length) {
    throw new Error('No results returned from Google Custom Search');
  }

  return {
    keyword,
    source: 'google_cse',
    top_results: results.slice(0, 10).map((r, i) => ({
      position: i + 1,
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    })),
    people_also_ask: [], // CSE doesn't provide this easily
    related_searches: [],
    avg_word_count: 1200 + Math.floor(Math.random() * 800),
    serp_features: [],
    content_gaps: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ROUTE: Puppeteer -> SerpApi -> Google CSE
// ─────────────────────────────────────────────────────────────────────────────
router.post('/analyze', async (req, res) => {
  const { keyword, location, language, target_url, content_type } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  let existing_content = '';
  if (content_type === 'content_refresh' && target_url) {
    console.log(`[SERP] Scraping existing content for refresh: ${target_url}`);
    existing_content = await scrapeExistingContent(target_url);
  }

  const formatResult = (resObj) => {
    if (existing_content) resObj.existing_content = existing_content;
    return resObj;
  };

  // Tier 1: Puppeteer Live Scrape
  try {
    console.log(`[SERP] Tier 1: Launching live Chrome for: "${keyword}"...`);
    const result = await fetchPuppeteerSERP(keyword);
    
    if (result && result.top_results && result.top_results.length > 0) {
      console.log(`[SERP] Chrome scrape successful. Got ${result.top_results.length} results.`);
      return res.json(formatResult(result));
    } else {
       throw new Error("No results found in DOM");
    }
  } catch (err) {
    console.warn(`[SERP] Chrome scraping failed: ${err.message}. Falling back to SerpApi...`);
    
    // Tier 2: SerpApi
    try {
       console.log(`[SERP] Tier 2: Attempting SerpApi for: "${keyword}"...`);
       const serpApiResult = await fetchSerpApi(keyword);
       console.log(`[SERP] SerpApi successful.`);
       return res.json(formatResult(serpApiResult));
    } catch(serpApiErr) {
       console.warn(`[SERP] SerpApi Fallback failed: ${serpApiErr.message}. Falling back to Google CSE...`);
       
       // Tier 3: Google CSE
       try {
          console.log(`[SERP] Tier 3: Attempting Google CSE for: "${keyword}"...`);
          const cseResult = await fetchGoogleCSE(keyword);
          console.log(`[SERP] Google CSE successful.`);
          return res.json(formatResult(cseResult));
       } catch(cseErr) {
          console.error(`[SERP] Google CSE Fallback failed as well: ${cseErr.message}`);
          
          let cseErrorMsg = cseErr.message;
          if (cseErr.response && cseErr.response.status === 403) {
            cseErrorMsg = "403 Forbidden. Your Google API key is invalid, lacks permissions for the Custom Search API, or has IP/referrer restrictions blocking Render.";
          }
          
          return res.status(500).json({ 
            error: `All SERP data sources failed.`,
            details: {
              puppeteer: err.message,
              serpApi: serpApiErr.message,
              cse: cseErrorMsg
            }
          });
       }
    }
  }
});

async function scrapeExistingContent(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const content = await page.evaluate(() => {
      // Remove scripts, styles, nav, footer
      document.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
      return document.body.innerText;
    });
    return content;
  } catch (e) {
    console.error("Failed to scrape target url:", e);
    return "";
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

module.exports = router;
