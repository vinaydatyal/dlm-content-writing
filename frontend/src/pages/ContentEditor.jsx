import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { 
  Play, Download, Settings, RefreshCw, FileText, CheckCircle, AlertTriangle, 
  Sparkles, Undo2, BarChart3, Trash2, Plus, ShieldCheck, Eye, Edit3, Search,
  ChevronDown, ChevronRight, BookOpen, Users, Compass, Zap, HelpCircle, 
  ExternalLink, Copy, List, Heading1, Heading2, Heading3, Bold, Italic, 
  Quote, Table, Wand2, Scissors, TrendingUp, Check, Layers, Award
} from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper: Escape string for safe RegExp
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── SEO Scoring Utilities ───
function calcKeywordDensity(content, keyword) {
  if (!content || !keyword) return 0;
  const words = content.toLowerCase().split(/\s+/).filter(Boolean);
  const kw = keyword.toLowerCase();
  const escaped = escapeRegex(kw);
  const count = (content.toLowerCase().match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length;
  return words.length > 0 ? Number(((count / words.length) * 100).toFixed(1)) : 0;
}

function calcReadability(text) {
  if (!text || text.length < 50) return { score: 0, grade: 'N/A' };
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
  const words = text.split(/\s+/).filter(Boolean);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  if (sentences.length === 0 || words.length === 0) return { score: 0, grade: 'N/A' };
  const fk = 206.835 - (1.015 * (words.length / sentences.length)) - (84.6 * (syllables / words.length));
  const score = Math.max(0, Math.min(100, Math.round(fk)));
  let grade;
  if (score >= 80) grade = 'Very Easy';
  else if (score >= 70) grade = 'Easy';
  else if (score >= 60) grade = 'Standard';
  else if (score >= 50) grade = 'Moderate';
  else if (score >= 30) grade = 'Difficult';
  else grade = 'Very Hard';
  return { score, grade };
}

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

// ─── Circular Score Gauge Component ───
function ScoreGauge({ score, size = 80, strokeWidth = 8, label = 'Content Score' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let color = '#EF4444'; // Red
  if (score >= 75) color = '#10B981'; // Green
  else if (score >= 50) color = '#F59E0B'; // Yellow

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size > 70 ? '1.3rem' : '0.9rem',
          color: color
        }}>
          {score}
          {size > 70 && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ 100</span>}
        </div>
      </div>
      {label && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>}
    </div>
  );
}

export default function ContentEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [project, setProject] = useState(null);
  const [article, setArticle] = useState(null);
  const [clientProfile, setClientProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingSection, setGeneratingSection] = useState(null);
  const [polishing, setPolishing] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  
  // Tabs: 'editor' | 'nlp' | 'competitors' | 'research' | 'score' | 'hooks' | 'polish' | 'fact-check'
  const [activeTab, setActiveTab] = useState('editor');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [contentHistory, setContentHistory] = useState([]);
  const [projectInstructions, setProjectInstructions] = useState('');
  
  // Compliance & Quality State
  const [factChecking, setFactChecking] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState(null);
  const [generatingHooks, setGeneratingHooks] = useState(false);
  const [hooks, setHooks] = useState(null);
  const [checkingOriginality, setCheckingOriginality] = useState(false);
  const [originalityResult, setOriginalityResult] = useState(null);

  // ─── Surfer & Frase State ───
  const [nlpTerms, setNlpTerms] = useState([]);
  const [loadingNlp, setLoadingNlp] = useState(false);
  const [nlpFilter, setNlpFilter] = useState('all'); // 'all' | 'topical' | 'headings' | 'questions' | 'missing'
  const [nlpSearch, setNlpSearch] = useState('');

  const [competitors, setCompetitors] = useState([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [expandedCompetitor, setExpandedCompetitor] = useState(0);

  const [researchItems, setResearchItems] = useState([]);
  const [loadingResearch, setLoadingResearch] = useState(false);

  // Inline AI selection state
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const [showInlineAI, setShowInlineAI] = useState(false);
  const [customInlinePrompt, setCustomInlinePrompt] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);

  const contentRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [projRes, artRes] = await Promise.all([
        axios.get(`${API_URL}/projects/${projectId}`, { headers }),
        axios.get(`${API_URL}/projects/${projectId}/article`, { headers })
      ]);
      
      const art = artRes.data;

      const safeParseJSON = (val, fallback) => {
        if (!val) return fallback;
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val); } catch { return fallback; }
      };

      art.outline = safeParseJSON(art.outline, []);
      art.faq_schema = safeParseJSON(art.faq_schema, []);
      art.article_schema = safeParseJSON(art.article_schema, null);
      
      // Parse SERP data
      const serpData = safeParseJSON(art.serp_data, {});
      art.parsed_serp = serpData;

      // Extract existing NLP terms if cached
      if (serpData.nlp_terms && Array.isArray(serpData.nlp_terms)) {
        setNlpTerms(serpData.nlp_terms);
      }

      setProject(projRes.data);
      setArticle(art);
      setProjectInstructions(art.custom_instructions || '');

      if (projRes.data.client_id) {
        try {
          const clientRes = await axios.get(`${API_URL}/clients/${projRes.data.client_id}`, { headers });
          setClientProfile(clientRes.data);
        } catch {}
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Save & History ───
  const saveArticle = async (updates) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/projects/${projectId}/article`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArticle(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('Failed to save', err);
    }
  };

  const pushHistory = (label) => {
    if (article?.content) {
      setContentHistory(prev => [...prev.slice(-9), { label, content: article.content, timestamp: new Date().toISOString() }]);
    }
  };

  const handleUndo = () => {
    if (contentHistory.length === 0) return;
    const last = contentHistory[contentHistory.length - 1];
    setContentHistory(prev => prev.slice(0, -1));
    saveArticle({ content: last.content });
    addToast(`Restored: ${last.label}`, 'info');
  };

  // ─── 1. NLP Semantic Engine ───
  const handleFetchNLPTerms = async () => {
    if (!project?.keyword) return;
    setLoadingNlp(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/nlp-terms`, {
        keyword: project.keyword,
        serp_data: article?.parsed_serp || {},
        target_word_count: project.target_word_count || 1500
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data.nlp_terms) {
        setNlpTerms(res.data.nlp_terms);
        const updatedSerp = { ...(article.parsed_serp || {}), nlp_terms: res.data.nlp_terms };
        saveArticle({ serp_data: JSON.stringify(updatedSerp) });
        addToast(`Extracted ${res.data.nlp_terms.length} NLP entities!`, 'success');
      }
    } catch (err) {
      addToast('Failed to extract NLP terms', 'error');
    } finally {
      setLoadingNlp(false);
    }
  };

  // Calculate live term occurrences
  const analyzedNlpTerms = useMemo(() => {
    if (!nlpTerms || nlpTerms.length === 0) return [];
    const content = (article?.content || '').toLowerCase();
    
    // Extract heading text only
    const headingMatches = (article?.content || '').match(/^#{1,3}\s+(.+)$/gm) || [];
    const headingText = headingMatches.join(' ').toLowerCase();

    return nlpTerms.map(item => {
      const termLower = item.term.toLowerCase();
      const escaped = escapeRegex(termLower);
      
      let count = 0;
      try {
        const matches = content.match(new RegExp(`\\b${escaped}\\b`, 'g'));
        count = matches ? matches.length : 0;
      } catch {
        count = content.split(termLower).length - 1;
      }

      // Check if found in headings for headings category
      let inHeading = false;
      if (item.category === 'headings') {
        inHeading = headingText.includes(termLower);
      }

      let status = 'under'; // 'optimal' | 'under' | 'over'
      if (count >= item.min_count && count <= item.max_count) {
        status = 'optimal';
      } else if (count > item.max_count) {
        status = 'over';
      }

      return {
        ...item,
        current_count: count,
        in_heading: inHeading,
        status
      };
    });
  }, [nlpTerms, article?.content]);

  // Filtered NLP Terms
  const filteredNlpTerms = useMemo(() => {
    return analyzedNlpTerms.filter(item => {
      if (nlpSearch && !item.term.toLowerCase().includes(nlpSearch.toLowerCase())) {
        return false;
      }
      if (nlpFilter === 'all') return true;
      if (nlpFilter === 'missing') return item.status === 'under';
      return item.category === nlpFilter;
    });
  }, [analyzedNlpTerms, nlpFilter, nlpSearch]);

  // ─── 2. Competitor SERP Explorer ───
  const handleFetchCompetitors = async () => {
    if (!project?.keyword) return;
    setLoadingCompetitors(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/serp/competitor-outlines`, {
        keyword: project.keyword,
        serp_data: article?.parsed_serp || {}
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data.competitors) {
        setCompetitors(res.data.competitors);
      }
    } catch (err) {
      addToast('Failed to fetch competitor outlines', 'error');
    } finally {
      setLoadingCompetitors(false);
    }
  };

  const handleImportCompetitorHeading = (headingObj) => {
    const newSection = {
      type: headingObj.type || 'h2',
      heading: headingObj.heading,
      target_words: 250,
      notes: 'Imported from top competitor outline'
    };
    const updatedOutline = [...(article.outline || []), newSection];
    setArticle(prev => ({ ...prev, outline: updatedOutline }));
    saveArticle({ outline: updatedOutline });
    addToast(`Added "${headingObj.heading}" to your outline!`, 'success');
  };

  // ─── 3. Research & Statistics Vault ───
  const handleFetchResearchVault = async () => {
    if (!project?.keyword) return;
    setLoadingResearch(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/research-vault`, {
        keyword: project.keyword,
        serp_data: article?.parsed_serp || {}
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data.research_items) {
        setResearchItems(res.data.research_items);
      }
    } catch (err) {
      addToast('Failed to fetch research vault', 'error');
    } finally {
      setLoadingResearch(false);
    }
  };

  const handleInsertCitation = (item) => {
    const citationMarkdown = `\n\n> **Key Statistic:** "${item.stat}" — *Source: [${item.source_name}](${item.source_url})*\n\n`;
    insertTextAtCursor(citationMarkdown);
    addToast('Inserted research citation into article!', 'success');
  };

  // ─── 4. Dynamic 0-100 Live Content Score Algorithm ───
  const contentScoreBreakdown = useMemo(() => {
    const content = article?.content || '';
    const words = content.split(/\s+/).filter(Boolean).length;
    const targetWords = project?.target_word_count || 1500;

    // 1. Structure Score (Max 25)
    let structureScore = 0;
    const wordRatio = targetWords > 0 ? Math.min(1.2, words / targetWords) : 0;
    structureScore += Math.round(wordRatio * 15); // up to 15 pts
    const h2Count = (content.match(/^##\s+.+$/gm) || []).length;
    const h3Count = (content.match(/^###\s+.+$/gm) || []).length;
    if (h2Count >= 3) structureScore += 5;
    else structureScore += h2Count * 1.5;
    if (h3Count >= 2) structureScore += 5;
    else structureScore += h3Count * 2.5;
    structureScore = Math.min(25, Math.round(structureScore));

    // 2. NLP Entity Coverage (Max 40)
    let nlpScore = 0;
    if (analyzedNlpTerms.length > 0) {
      const optimalCount = analyzedNlpTerms.filter(t => t.status === 'optimal').length;
      const partialCount = analyzedNlpTerms.filter(t => t.status === 'over' || (t.status === 'under' && t.current_count > 0)).length;
      nlpScore = Math.round(((optimalCount + (partialCount * 0.5)) / analyzedNlpTerms.length) * 40);
    } else {
      // Fallback: Primary density & secondary keyword coverage
      const density = calcKeywordDensity(content, project?.keyword);
      if (density >= 0.5 && density <= 2.5) nlpScore += 20;
      else if (density > 0) nlpScore += 10;
      const secKeywords = (article?.outline || []).flatMap(s => s.keywords_to_include || []);
      const foundSec = secKeywords.filter(kw => content.toLowerCase().includes(kw.toLowerCase())).length;
      if (secKeywords.length > 0) nlpScore += Math.round((foundSec / secKeywords.length) * 20);
    }
    nlpScore = Math.min(40, Math.round(nlpScore));

    // 3. Headings & Title Score (Max 15)
    let headingScore = 0;
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && project?.keyword && h1Match[1].toLowerCase().includes(project.keyword.toLowerCase())) {
      headingScore += 5;
    } else if (h1Match) {
      headingScore += 2;
    }
    const headingNlp = analyzedNlpTerms.filter(t => t.category === 'headings');
    if (headingNlp.length > 0) {
      const foundHeadings = headingNlp.filter(t => t.in_heading || t.current_count > 0).length;
      headingScore += Math.round((foundHeadings / headingNlp.length) * 10);
    } else if (h2Count >= 3) {
      headingScore += 10;
    }
    headingScore = Math.min(15, Math.round(headingScore));

    // 4. Readability Score (Max 10)
    let readabilityScore = 0;
    const readability = calcReadability(content);
    if (readability.score >= 60) readabilityScore = 10;
    else if (readability.score >= 45) readabilityScore = 7;
    else if (readability.score >= 30) readabilityScore = 4;
    else readabilityScore = 2;

    // 5. Meta & Schema (Max 10)
    let metaScore = 0;
    if (article?.meta_title && article.meta_title.length >= 30) metaScore += 4;
    if (article?.meta_description && article.meta_description.length >= 80) metaScore += 4;
    if (article?.faq_schema && article.faq_schema.length > 0) metaScore += 2;

    const totalScore = Math.min(100, Math.max(0, structureScore + nlpScore + headingScore + readabilityScore + metaScore));

    return {
      totalScore,
      structureScore,
      nlpScore,
      headingScore,
      readabilityScore,
      metaScore,
      h2Count,
      h3Count,
      words,
      targetWords,
      readability
    };
  }, [article?.content, article?.meta_title, article?.meta_description, article?.faq_schema, analyzedNlpTerms, project]);

  // ─── 5. Inline AI Writing Assistant ───
  const handleEditorSelect = () => {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (end - start > 4) {
      const text = el.value.substring(start, end);
      setSelectedText(text);
      setSelectionRange({ start, end });
      setShowInlineAI(true);
    } else {
      setShowInlineAI(false);
    }
  };

  const handleExecuteInlineAI = async (action, customPrompt) => {
    if (!selectedText || inlineLoading) return;
    setInlineLoading(true);
    pushHistory(`Inline AI: ${action}`);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/inline-ai`, {
        text: selectedText,
        action,
        custom_prompt: customPrompt,
        keyword: project?.keyword,
        client_id: project?.client_id
      }, { headers: { Authorization: `Bearer ${token}` } });

      const replacement = res.data.revised_text;
      if (replacement) {
        const fullContent = article?.content || '';
        const newContent = fullContent.substring(0, selectionRange.start) + replacement + fullContent.substring(selectionRange.end);
        setArticle(prev => ({ ...prev, content: newContent }));
        saveArticle({ content: newContent });
        setShowInlineAI(false);
        setSelectedText('');
        addToast('Inline edit applied!', 'success');
      }
    } catch (err) {
      addToast('Inline AI failed to process', 'error');
    } finally {
      setInlineLoading(false);
    }
  };

  // ─── Editor Formatting Toolbar Helpers ───
  const insertFormatting = (prefix, suffix = '') => {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const full = el.value;
    const selected = full.substring(start, end) || 'text';
    const replacement = `${prefix}${selected}${suffix}`;
    const newContent = full.substring(0, start) + replacement + full.substring(end);
    setArticle(prev => ({ ...prev, content: newContent }));
    saveArticle({ content: newContent });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  const insertTextAtCursor = (textToInsert) => {
    const el = contentRef.current;
    const full = article?.content || '';
    if (!el) {
      const newContent = full + textToInsert;
      setArticle(prev => ({ ...prev, content: newContent }));
      saveArticle({ content: newContent });
      return;
    }
    const start = el.selectionStart || full.length;
    const end = el.selectionEnd || full.length;
    const newContent = full.substring(0, start) + textToInsert + full.substring(end);
    setArticle(prev => ({ ...prev, content: newContent }));
    saveArticle({ content: newContent });
  };

  // ─── Section Generation ───
  const handleGenerateSection = async (section, index) => {
    if (generatingSection !== null) return;
    const isRegen = article.content?.includes(section.heading);
    if (isRegen) pushHistory(`Before re-generate: ${section.heading}`);

    setGeneratingSection(index);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/content/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          keyword: project.keyword,
          section,
          outline: article.outline,
          brief: article.brief,
          existing_content: article.content,
          custom_instructions: projectInstructions || null,
          client_profile: projectInstructions ? null : clientProfile
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let newContent = `\n\n${section.type === 'h1' ? '#' : section.type === 'h2' ? '##' : '###'} ${section.heading}\n\n`;
      setArticle(prev => ({ ...prev, content: (prev.content || '') + newContent }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n\n')) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              newContent += data.text;
              setArticle(prev => ({ 
                ...prev, 
                content: prev.content.slice(0, prev.content.length - data.text.length) + data.text 
              }));
            }
          }
        }
      }

      await saveArticle({ content: article.content + newContent });
    } catch (err) {
      addToast('Failed to generate section', 'error');
    } finally {
      setGeneratingSection(null);
    }
  };

  const handlePolish = async () => {
    setPolishing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/polish`, {
        keyword: project.keyword,
        content: article.content,
        internal_urls: project.internal_urls ? JSON.parse(project.internal_urls) : []
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      await saveArticle({
        meta_title: res.data.meta_title,
        meta_description: res.data.meta_description,
        faq_schema: res.data.faq_schema,
        featured_snippet: res.data.featured_snippet,
        article_schema: res.data.article_schema,
        status: 'completed'
      });
      setActiveTab('polish');
      addToast('Article successfully polished with Meta & Schema!', 'success');
    } catch (err) {
      addToast('Failed to polish content', 'error');
    } finally {
      setPolishing(false);
    }
  };

  const handleHumanize = async () => {
    if (!article.content) return;
    if (!confirm('Rewrite the article with active voice and human pacing? Your current content will be backed up in history.')) return;
    pushHistory('Before Humanize');
    setHumanizing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/content/humanize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: article.content, custom_instructions: projectInstructions || undefined })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let humanized = '';
      setArticle(prev => ({ ...prev, content: '' }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n\n')) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              humanized += data.text;
              setArticle(prev => ({ ...prev, content: humanized }));
            }
            if (data.done) {
              await saveArticle({ content: humanized });
            }
          }
        }
      }
      addToast('Humanize complete!', 'success');
    } catch (err) {
      addToast('Failed to humanize content', 'error');
    } finally {
      setHumanizing(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/export/${format}`, {
        title: project.keyword,
        keyword: project.keyword,
        content: article.content,
        meta_title: article.meta_title,
        meta_description: article.meta_description,
        faq_schema: article.faq_schema,
        article_schema: article.article_schema
      }, { 
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob' 
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${project.keyword.replace(/\s+/g, '-').toLowerCase()}.${format}`);
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      addToast('Exported successfully', 'success');
    } catch (err) {
      addToast('Failed to export', 'error');
    }
  };

  const handleFactCheck = async () => {
    if (!article.content || !clientProfile) {
      addToast('Content and Client Profile are required.', 'error');
      return;
    }
    setFactChecking(true);
    setActiveTab('fact-check');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/fact-check`, {
        content: article.content,
        client_profile: clientProfile
      }, { headers: { Authorization: `Bearer ${token}` } });
      setFactCheckResult(res.data);
    } catch (err) {
      addToast('Failed to run compliance check', 'error');
    } finally {
      setFactChecking(false);
    }
  };

  const handleCheckOriginality = async () => {
    if (!article.content) return;
    setCheckingOriginality(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/originality-check`, {
        content: article.content
      }, { headers: { Authorization: `Bearer ${token}` } });
      setOriginalityResult(res.data);
    } catch (err) {
      addToast('Failed to check originality', 'error');
    } finally {
      setCheckingOriginality(false);
    }
  };

  const handleGenerateHooks = async () => {
    setGeneratingHooks(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/hooks`, {
        keyword: project.keyword,
        brief: article.brief,
        client_profile: clientProfile
      }, { headers: { Authorization: `Bearer ${token}` } });
      setHooks(res.data.hooks);
    } catch (err) {
      addToast('Failed to generate hooks', 'error');
    } finally {
      setGeneratingHooks(false);
    }
  };

  const addOutlineSection = () => {
    const newOutline = [...(article.outline || []), { type: 'h2', heading: 'New Section', target_words: 200, notes: '' }];
    setArticle(prev => ({ ...prev, outline: newOutline }));
    saveArticle({ outline: newOutline });
  };

  const removeOutlineSection = (index) => {
    if (!confirm('Remove this section?')) return;
    const newOutline = article.outline.filter((_, i) => i !== index);
    setArticle(prev => ({ ...prev, outline: newOutline }));
    saveArticle({ outline: newOutline });
  };

  if (loading) return (
    <div className="animate-fade-in" style={{ padding: '32px 48px' }}>
      <div className="skeleton" style={{ height: '36px', width: '40%', marginBottom: '24px' }}></div>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="skeleton" style={{ height: '300px', width: '100%', borderRadius: '10px' }}></div>
          <div className="skeleton" style={{ height: '200px', width: '100%', borderRadius: '10px' }}></div>
        </div>
        <div className="skeleton" style={{ height: '600px', width: '100%', borderRadius: '10px' }}></div>
      </div>
    </div>
  );

  if (!project || !article) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
      Could not load project data. Please go back and try again.
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* ─── HEADER BAR ─── */}
      <div className="flex-between" style={{ marginBottom: '20px', alignItems: 'center', background: 'var(--bg-surface)', padding: '16px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Circular Score Gauge in Header */}
          <div 
            onClick={() => setActiveTab('score')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
            title="Click to view full SEO Content Score breakdown"
          >
            <ScoreGauge score={contentScoreBreakdown.totalScore} size={64} strokeWidth={6} label="" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{project.keyword}</h2>
                <span className={`badge ${article.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>
                  {(article.status || 'draft').replace('_', ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>🎯 Target: ~{project.target_word_count || 1500} words</span>
                <span>📝 Words: <strong style={{ color: '#fff' }}>{contentScoreBreakdown.words}</strong></span>
                <span>📊 Score: <strong style={{ color: contentScoreBreakdown.totalScore >= 75 ? '#10B981' : '#F59E0B' }}>{contentScoreBreakdown.totalScore}/100</strong></span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {contentHistory.length > 0 && (
            <button className="btn btn-secondary" onClick={handleUndo} title={`Undo: ${contentHistory[contentHistory.length - 1]?.label}`}
              style={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.4)', padding: '8px 12px' }}>
              <Undo2 size={15} /> Undo
            </button>
          )}

          <button className="btn btn-secondary" onClick={() => handleExport('html')} disabled={!article.content} style={{ padding: '8px 12px' }}>
            <Download size={15} /> HTML
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('docx')} disabled={!article.content} style={{ padding: '8px 12px' }}>
            <Download size={15} /> DOCX
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={handleHumanize} 
            disabled={!article.content || humanizing || generatingSection !== null}
            style={{ color: '#A78BFA', borderColor: 'rgba(167,139,250,0.4)', padding: '8px 12px' }}
          >
            {humanizing 
              ? <><RefreshCw size={15} className="spinner" style={{ border: 'none' }} /> Humanizing...</> 
              : <><Sparkles size={15} /> Humanize</>}
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={handleFactCheck} 
            disabled={!article.content || factChecking || !clientProfile}
            style={{ color: '#38BDF8', borderColor: 'rgba(56,189,248,0.4)', padding: '8px 12px' }}
          >
            {factChecking 
              ? <><RefreshCw size={15} className="spinner" style={{ border: 'none' }} /> Checking...</> 
              : <><ShieldCheck size={15} /> Brand Check</>}
          </button>

          <button className="btn btn-primary" onClick={handlePolish} disabled={!article.content || polishing} style={{ padding: '8px 16px' }}>
            {polishing ? <RefreshCw size={15} className="spinner" style={{ border: 'none' }} /> : <CheckCircle size={15} />}
            Final Polish
          </button>
        </div>
      </div>

      {/* ─── MAIN 2-COLUMN LAYOUT ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* ─── LEFT SIDEBAR: TABS & SUITE ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            
            {/* TAB NAVIGATION */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.2)'
            }}>
              <button 
                onClick={() => setActiveTab('editor')}
                style={{ 
                  padding: '12px 6px', 
                  background: activeTab === 'editor' ? 'var(--bg-surface-hover)' : 'transparent', 
                  border: 'none', 
                  color: activeTab === 'editor' ? '#fff' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontWeight: activeTab === 'editor' ? 600 : 500, 
                  fontSize: '0.78rem',
                  borderBottom: activeTab === 'editor' ? '2px solid var(--primary-accent)' : 'none'
                }}
              >
                Outline
              </button>

              <button 
                onClick={() => {
                  setActiveTab('nlp');
                  if (nlpTerms.length === 0) handleFetchNLPTerms();
                }}
                style={{ 
                  padding: '12px 6px', 
                  background: activeTab === 'nlp' ? 'var(--bg-surface-hover)' : 'transparent', 
                  border: 'none', 
                  color: activeTab === 'nlp' ? '#10B981' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontWeight: activeTab === 'nlp' ? 600 : 500, 
                  fontSize: '0.78rem',
                  borderBottom: activeTab === 'nlp' ? '2px solid #10B981' : 'none'
                }}
              >
                ⚡ NLP Terms
              </button>

              <button 
                onClick={() => {
                  setActiveTab('competitors');
                  if (competitors.length === 0) handleFetchCompetitors();
                }}
                style={{ 
                  padding: '12px 6px', 
                  background: activeTab === 'competitors' ? 'var(--bg-surface-hover)' : 'transparent', 
                  border: 'none', 
                  color: activeTab === 'competitors' ? '#38BDF8' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontWeight: activeTab === 'competitors' ? 600 : 500, 
                  fontSize: '0.78rem',
                  borderBottom: activeTab === 'competitors' ? '2px solid #38BDF8' : 'none'
                }}
              >
                🌐 Competitors
              </button>

              <button 
                onClick={() => {
                  setActiveTab('research');
                  if (researchItems.length === 0) handleFetchResearchVault();
                }}
                style={{ 
                  padding: '12px 6px', 
                  background: activeTab === 'research' ? 'var(--bg-surface-hover)' : 'transparent', 
                  border: 'none', 
                  color: activeTab === 'research' ? '#F59E0B' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontWeight: activeTab === 'research' ? 600 : 500, 
                  fontSize: '0.78rem',
                  borderBottom: activeTab === 'research' ? '2px solid #F59E0B' : 'none'
                }}
              >
                🔬 Research
              </button>
            </div>

            {/* SECONDARY ROW OF TABS */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.1)'
            }}>
              <button 
                onClick={() => setActiveTab('score')}
                style={{ 
                  padding: '10px 4px', 
                  background: activeTab === 'score' ? 'var(--bg-surface-hover)' : 'transparent', 
                  border: 'none', 
                  color: activeTab === 'score' ? '#EE2770' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontWeight: 500, 
                  fontSize: '0.75rem',
                  borderBottom: activeTab === 'score' ? '2px solid #EE2770' : 'none'
                }}
              >
                📊 Score
              </button>

              <button 
                onClick={() => setActiveTab('hooks')}
                style={{ 
                  padding: '10px 4px', 
                  background: activeTab === 'hooks' ? 'var(--bg-surface-hover)' : 'transparent', 
                  border: 'none', 
                  color: activeTab === 'hooks' ? '#A78BFA' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontWeight: 500, 
                  fontSize: '0.75rem',
                  borderBottom: activeTab === 'hooks' ? '2px solid #A78BFA' : 'none'
                }}
              >
                🪝 Hooks
              </button>

              <button 
                onClick={() => setActiveTab('polish')}
                style={{ 
                  padding: '10px 4px', 
                  background: activeTab === 'polish' ? 'var(--bg-surface-hover)' : 'transparent', 
                  border: 'none', 
                  color: activeTab === 'polish' ? '#fff' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontWeight: 500, 
                  fontSize: '0.75rem',
                  borderBottom: activeTab === 'polish' ? '2px solid #fff' : 'none'
                }}
              >
                Meta
              </button>

              <button 
                onClick={() => setActiveTab('fact-check')}
                style={{ 
                  padding: '10px 4px', 
                  background: activeTab === 'fact-check' ? 'var(--bg-surface-hover)' : 'transparent', 
                  border: 'none', 
                  color: activeTab === 'fact-check' ? '#38BDF8' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontWeight: 500, 
                  fontSize: '0.75rem',
                  borderBottom: activeTab === 'fact-check' ? '2px solid #38BDF8' : 'none'
                }}
              >
                🛡️ Brand
              </button>
            </div>

            {/* TAB CONTENT AREA */}
            <div style={{ padding: '16px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              
              {/* ─── TAB: OUTLINE & SECTIONS ─── */}
              {activeTab === 'editor' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Instructions Override */}
                  <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: `1px solid ${projectInstructions ? 'rgba(238,39,112,0.4)' : 'var(--border-color)'}` }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: projectInstructions ? 'var(--primary-accent)' : 'var(--text-muted)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>✍️ Writing Instructions</span>
                      {projectInstructions ? <span style={{ fontSize: '0.65rem', background: 'rgba(238,39,112,0.15)', color: 'var(--primary-accent)', padding: '2px 6px', borderRadius: '10px' }}>Customized</span> : (clientProfile ? <span style={{ fontSize: '0.65rem', background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '10px' }}>From Client Profile</span> : null)}
                    </div>
                    <textarea
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.8rem', resize: 'vertical', outline: 'none', minHeight: '60px', fontFamily: 'var(--font-sans)' }}
                      placeholder={clientProfile?.custom_instructions || 'Add project-specific writing instructions...'}
                      value={projectInstructions}
                      onChange={(e) => setProjectInstructions(e.target.value)}
                      onBlur={() => saveArticle({ custom_instructions: projectInstructions })}
                    />
                  </div>

                  {/* Section List */}
                  {article.outline?.map((section, idx) => {
                    const isGenerated = article.content?.includes(section.heading);
                    return (
                      <div 
                        key={idx} 
                        style={{
                          padding: '12px',
                          background: 'var(--bg-base)',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: `3px solid ${section.type === 'h1' ? 'var(--primary-accent)' : section.type === 'h2' ? '#38BDF8' : '#A78BFA'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {section.type || 'H2'} • ~{section.target_words || 200} words
                          </span>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {isGenerated && <span style={{ fontSize: '0.7rem', color: '#10B981' }}>✓ In Draft</span>}
                            <button onClick={() => removeOutlineSection(idx)} className="btn-icon" style={{ color: 'var(--text-muted)', padding: '2px' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <input 
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            outline: 'none',
                            width: '100%'
                          }}
                          value={section.heading}
                          onChange={(e) => {
                            const newOutline = [...article.outline];
                            newOutline[idx].heading = e.target.value;
                            setArticle(prev => ({ ...prev, outline: newOutline }));
                          }}
                          onBlur={() => saveArticle({ outline: article.outline })}
                        />

                        {section.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{section.notes}</div>
                        )}

                        <button 
                          className="btn btn-secondary"
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '6px 10px', 
                            justifyContent: 'center',
                            borderColor: isGenerated ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'
                          }}
                          onClick={() => handleGenerateSection(section, idx)}
                          disabled={generatingSection !== null}
                        >
                          {generatingSection === idx ? (
                            <><RefreshCw size={13} className="spinner" style={{ border: 'none' }} /> Writing...</>
                          ) : (
                            <><Play size={13} fill="currentColor" /> {isGenerated ? 'Re-Generate Section' : 'Write Section'}</>
                          )}
                        </button>
                      </div>
                    );
                  })}

                  <button 
                    onClick={addOutlineSection}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed', fontSize: '0.8rem', padding: '8px' }}
                  >
                    <Plus size={14} /> Add New Section
                  </button>
                </div>
              )}

              {/* ─── TAB: SURFER NLP ENTITIES ─── */}
              {activeTab === 'nlp' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={15} /> NLP Semantic Entities
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Frequency targets for top rankings</span>
                    </div>
                    <button 
                      onClick={handleFetchNLPTerms}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                      disabled={loadingNlp}
                    >
                      {loadingNlp ? <RefreshCw size={12} className="spinner" style={{ border: 'none' }} /> : <RefreshCw size={12} />}
                      Re-Analyze
                    </button>
                  </div>

                  {/* Filter & Search */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
                      <input 
                        placeholder="Search NLP entities..."
                        value={nlpSearch}
                        onChange={(e) => setNlpSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px 6px 30px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          color: '#fff',
                          fontSize: '0.75rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {['all', 'topical', 'headings', 'questions', 'missing'].map(f => (
                        <button
                          key={f}
                          onClick={() => setNlpFilter(f)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            border: 'none',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: nlpFilter === f ? '#10B981' : 'var(--bg-base)',
                            color: nlpFilter === f ? '#000' : 'var(--text-muted)',
                            textTransform: 'capitalize'
                          }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Terms List */}
                  {loadingNlp ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <RefreshCw size={20} className="spinner" style={{ border: 'none', margin: '0 auto 8px' }} />
                      Extracting top NLP entities from Google SERP...
                    </div>
                  ) : filteredNlpTerms.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No NLP terms matching filter.
                      <div style={{ marginTop: '12px' }}>
                        <button className="btn btn-primary" onClick={handleFetchNLPTerms} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          ⚡ Extract NLP Terms
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {filteredNlpTerms.map((item, i) => {
                        let badgeBg = 'rgba(239, 68, 68, 0.15)';
                        let badgeColor = '#EF4444';
                        let badgeBorder = 'rgba(239, 68, 68, 0.3)';
                        let statusText = `${item.current_count}/${item.min_count}-${item.max_count}`;

                        if (item.status === 'optimal') {
                          badgeBg = 'rgba(16, 185, 129, 0.15)';
                          badgeColor = '#10B981';
                          badgeBorder = 'rgba(16, 185, 129, 0.3)';
                        } else if (item.status === 'under') {
                          badgeBg = 'rgba(245, 158, 11, 0.12)';
                          badgeColor = '#F59E0B';
                          badgeBorder = 'rgba(245, 158, 11, 0.25)';
                        }

                        return (
                          <div 
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              background: 'var(--bg-base)',
                              borderRadius: 'var(--radius-sm)',
                              border: `1px solid ${item.status === 'optimal' ? 'rgba(16,185,129,0.2)' : 'var(--border-color)'}`
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span 
                                onClick={() => insertTextAtCursor(item.term)}
                                title="Click to insert at cursor"
                                style={{ 
                                  fontSize: '0.8rem', 
                                  color: '#F3F4F6', 
                                  fontWeight: 500, 
                                  cursor: 'pointer',
                                  textDecoration: 'underline dotted var(--text-muted)'
                                }}
                              >
                                {item.term}
                              </span>
                              {item.category === 'headings' && (
                                <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(56,189,248,0.15)', color: '#38BDF8' }}>
                                  H2/H3
                                </span>
                              )}
                            </div>

                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: badgeBg,
                              color: badgeColor,
                              border: `1px solid ${badgeBorder}`
                            }}>
                              {statusText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: FRASE COMPETITOR OUTLINES ─── */}
              {activeTab === 'competitors' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Compass size={15} /> Top Competitor Outlines
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Inspect & 1-click import sections</span>
                    </div>
                    <button 
                      onClick={handleFetchCompetitors}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                      disabled={loadingCompetitors}
                    >
                      {loadingCompetitors ? <RefreshCw size={12} className="spinner" style={{ border: 'none' }} /> : <RefreshCw size={12} />}
                      Fetch
                    </button>
                  </div>

                  {loadingCompetitors ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <RefreshCw size={20} className="spinner" style={{ border: 'none', margin: '0 auto 8px' }} />
                      Extracting competitor heading structures...
                    </div>
                  ) : competitors.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No competitor outlines loaded yet.
                      <div style={{ marginTop: '12px' }}>
                        <button className="btn btn-primary" onClick={handleFetchCompetitors} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          🌐 Extract Competitor Headings
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {competitors.map((comp, idx) => {
                        const isExpanded = expandedCompetitor === idx;
                        return (
                          <div 
                            key={idx}
                            style={{
                              background: 'var(--bg-base)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)',
                              overflow: 'hidden'
                            }}
                          >
                            <div 
                              onClick={() => setExpandedCompetitor(isExpanded ? -1 : idx)}
                              style={{
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: isExpanded ? 'var(--bg-surface-hover)' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  fontWeight: 700, 
                                  padding: '2px 6px', 
                                  borderRadius: '10px', 
                                  background: 'rgba(56,189,248,0.2)', 
                                  color: '#38BDF8' 
                                }}>
                                  #{comp.rank || idx + 1}
                                </span>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {comp.title}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    {comp.domain} • ~{comp.word_count || 1800} words
                                  </div>
                                </div>
                              </div>
                              {isExpanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                            </div>

                            {isExpanded && comp.outline && (
                              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {comp.outline.map((headingObj, hIdx) => (
                                  <div 
                                    key={hIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 8px',
                                      background: 'rgba(255,255,255,0.03)',
                                      borderRadius: '4px',
                                      paddingLeft: headingObj.type === 'h3' ? '20px' : '8px'
                                    }}
                                  >
                                    <span style={{ fontSize: '0.75rem', color: '#F3F4F6' }}>
                                      <strong style={{ color: headingObj.type === 'h3' ? '#A78BFA' : '#38BDF8', marginRight: '6px', fontSize: '0.65rem' }}>
                                        {headingObj.type?.toUpperCase() || 'H2'}
                                      </strong>
                                      {headingObj.heading}
                                    </span>
                                    <button 
                                      onClick={() => handleImportCompetitorHeading(headingObj)}
                                      className="btn btn-secondary"
                                      style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                                      title="Add this heading to your article outline"
                                    >
                                      <Plus size={11} /> Add
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: FRASE RESEARCH & CITATIONS VAULT ─── */}
              {activeTab === 'research' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={15} /> Research & Citations Vault
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Verified stats for high E-E-A-T</span>
                    </div>
                    <button 
                      onClick={handleFetchResearchVault}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                      disabled={loadingResearch}
                    >
                      {loadingResearch ? <RefreshCw size={12} className="spinner" style={{ border: 'none' }} /> : <RefreshCw size={12} />}
                      Fetch
                    </button>
                  </div>

                  {loadingResearch ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <RefreshCw size={20} className="spinner" style={{ border: 'none', margin: '0 auto 8px' }} />
                      Synthesizing industry statistics and data points...
                    </div>
                  ) : researchItems.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No research data points loaded yet.
                      <div style={{ marginTop: '12px' }}>
                        <button className="btn btn-primary" onClick={handleFetchResearchVault} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          🔬 Extract Research Citations
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {researchItems.map((item, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: '12px',
                            background: 'var(--bg-base)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ 
                              fontSize: '0.65rem', 
                              fontWeight: 700, 
                              textTransform: 'uppercase', 
                              color: '#F59E0B',
                              background: 'rgba(245,158,11,0.15)',
                              padding: '2px 6px',
                              borderRadius: '10px'
                            }}>
                              {item.type || 'Statistic'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Source: <strong>{item.source_name || 'Industry Report'}</strong>
                            </span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 500, lineHeight: '1.4' }}>
                            "{item.stat}"
                          </div>

                          {item.context && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              💡 {item.context}
                            </div>
                          )}

                          <button 
                            onClick={() => handleInsertCitation(item)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '5px 10px', 
                              fontSize: '0.72rem', 
                              color: '#F59E0B', 
                              borderColor: 'rgba(245,158,11,0.4)',
                              justifyContent: 'center'
                            }}
                          >
                            <Quote size={12} /> Insert with Citation
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: FULL 0-100 CONTENT SCORE ─── */}
              {activeTab === 'score' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)' }}>
                    <ScoreGauge score={contentScoreBreakdown.totalScore} size={84} strokeWidth={8} label="" />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>
                        {contentScoreBreakdown.totalScore >= 75 ? '🟢 Great Optimization' : contentScoreBreakdown.totalScore >= 50 ? '🟡 Moderate Quality' : '🔴 Needs Optimization'}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Calculated across structure, NLP semantic terms, heading keywords, readability & meta tags.
                      </p>
                    </div>
                  </div>

                  {/* Category Breakdown Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span>Content Structure</span>
                        <strong>{contentScoreBreakdown.structureScore} / 25 pts</strong>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-base)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(contentScoreBreakdown.structureScore / 25) * 100}%`, background: '#38BDF8' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span>NLP Semantic Terms</span>
                        <strong>{contentScoreBreakdown.nlpScore} / 40 pts</strong>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-base)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(contentScoreBreakdown.nlpScore / 40) * 100}%`, background: '#10B981' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span>Headings & Title Keywords</span>
                        <strong>{contentScoreBreakdown.headingScore} / 15 pts</strong>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-base)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(contentScoreBreakdown.headingScore / 15) * 100}%`, background: '#A78BFA' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span>Readability Grade ({contentScoreBreakdown.readability.grade})</span>
                        <strong>{contentScoreBreakdown.readabilityScore} / 10 pts</strong>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-base)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(contentScoreBreakdown.readabilityScore / 10) * 100}%`, background: '#F59E0B' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span>Meta & Schema Completeness</span>
                        <strong>{contentScoreBreakdown.metaScore} / 10 pts</strong>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-base)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(contentScoreBreakdown.metaScore / 10) * 100}%`, background: '#EE2770' }} />
                      </div>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                      📋 Optimization Checklist
                    </div>
                    <ul style={{ paddingLeft: '18px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <li style={{ color: contentScoreBreakdown.words >= contentScoreBreakdown.targetWords * 0.8 ? '#10B981' : 'inherit' }}>
                        Reach target word count ({contentScoreBreakdown.words}/{contentScoreBreakdown.targetWords})
                      </li>
                      <li style={{ color: contentScoreBreakdown.h2Count >= 3 ? '#10B981' : 'inherit' }}>
                        Include at least 3 to 6 H2 subheadings ({contentScoreBreakdown.h2Count} found)
                      </li>
                      <li style={{ color: analyzedNlpTerms.filter(t => t.status === 'optimal').length >= 10 ? '#10B981' : 'inherit' }}>
                        Use key NLP semantic entities in optimal ranges
                      </li>
                      <li style={{ color: article.meta_title ? '#10B981' : 'inherit' }}>
                        Generate Meta Title & Description via Final Polish
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* ─── TAB: HOOKS ─── */}
              {activeTab === 'hooks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#A78BFA' }}>Dynamic Intro Hooks</h4>
                    <button className="btn btn-secondary" onClick={handleGenerateHooks} disabled={generatingHooks} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
                      {generatingHooks ? <RefreshCw size={12} className="spinner" style={{ border: 'none' }} /> : 'Generate Hooks'}
                    </button>
                  </div>
                  {hooks && hooks.map((hook, i) => (
                    <div key={i} style={{ padding: '10px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#A78BFA', textTransform: 'uppercase' }}>{hook.style}</div>
                      <div style={{ fontSize: '0.8rem', color: '#fff', margin: '6px 0' }}>{hook.content}</div>
                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                        onClick={() => {
                          insertTextAtCursor(`\n\n${hook.content}\n\n`);
                          addToast('Hook inserted into draft!', 'success');
                        }}
                      >
                        Insert into Draft
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ─── TAB: POLISH / META ─── */}
              {activeTab === 'polish' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Meta Title</label>
                    <input 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.8rem', marginTop: '4px' }}
                      value={article.meta_title || ''}
                      onChange={(e) => setArticle(prev => ({ ...prev, meta_title: e.target.value }))}
                      onBlur={() => saveArticle({ meta_title: article.meta_title })}
                      placeholder="SEO Meta Title..."
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Meta Description</label>
                    <textarea 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.8rem', marginTop: '4px', minHeight: '80px' }}
                      value={article.meta_description || ''}
                      onChange={(e) => setArticle(prev => ({ ...prev, meta_description: e.target.value }))}
                      onBlur={() => saveArticle({ meta_description: article.meta_description })}
                      placeholder="Meta Description under 160 characters..."
                    />
                  </div>

                  {article.faq_schema && article.faq_schema.length > 0 && (
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FAQ Schema Generated</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                        {article.faq_schema.map((faq, i) => (
                          <div key={i} style={{ padding: '8px', background: 'var(--bg-base)', borderRadius: '4px', fontSize: '0.75rem' }}>
                            <strong>Q: {faq.question}</strong>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: BRAND & ORIGINALITY ─── */}
              {activeTab === 'fact-check' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#38BDF8' }}>Brand Compliance</h4>
                    <button className="btn btn-secondary" onClick={handleFactCheck} disabled={factChecking} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
                      {factChecking ? 'Checking...' : 'Run Audit'}
                    </button>
                  </div>

                  {factCheckResult && (
                    <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: `1px solid ${factCheckResult.passed ? '#10B981' : '#EF4444'}` }}>
                      <div style={{ fontWeight: 600, color: factCheckResult.passed ? '#10B981' : '#EF4444', fontSize: '0.85rem' }}>
                        {factCheckResult.passed ? '✓ Passed Brand Compliance' : '⚠️ Brand Issues Found'}
                      </div>
                      {factCheckResult.violations?.length > 0 && (
                        <ul style={{ paddingLeft: '16px', fontSize: '0.75rem', marginTop: '6px', color: '#EF4444' }}>
                          {factCheckResult.violations.map((v, i) => <li key={i}>{v}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Originality & AI Detection</span>
                      <button className="btn btn-secondary" onClick={handleCheckOriginality} disabled={checkingOriginality} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
                        {checkingOriginality ? 'Scanning...' : 'Scan'}
                      </button>
                    </div>
                    {originalityResult && (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1, padding: '10px', background: 'var(--bg-base)', borderRadius: '4px', textAlign: 'center' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10B981' }}>{originalityResult.originality}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Plagiarism Free</div>
                        </div>
                        <div style={{ flex: 1, padding: '10px', background: 'var(--bg-base)', borderRadius: '4px', textAlign: 'center' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38BDF8' }}>{originalityResult.human}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Human Score</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ─── RIGHT: MAIN RICH EDITOR ─── */}
        <div className="rich-text-editor" style={{ display: 'flex', flexDirection: 'column', minHeight: '750px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          
          {/* FORMATTING & VIEW TOOLBAR */}
          <div className="editor-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '8px' }}>
            
            {/* Quick Markdown Format Buttons */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button onClick={() => insertFormatting('**', '**')} className="btn-icon" title="Bold" style={{ padding: '6px' }}>
                <Bold size={14} />
              </button>
              <button onClick={() => insertFormatting('*', '*')} className="btn-icon" title="Italic" style={{ padding: '6px' }}>
                <Italic size={14} />
              </button>
              <span style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }} />
              <button onClick={() => insertFormatting('## ')} className="btn-icon" title="H2 Heading" style={{ padding: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                H2
              </button>
              <button onClick={() => insertFormatting('### ')} className="btn-icon" title="H3 Subheading" style={{ padding: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                H3
              </button>
              <span style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }} />
              <button onClick={() => insertFormatting('- ')} className="btn-icon" title="Bullet List" style={{ padding: '6px' }}>
                <List size={14} />
              </button>
              <button onClick={() => insertFormatting('> ')} className="btn-icon" title="Blockquote" style={{ padding: '6px' }}>
                <Quote size={14} />
              </button>
              <button onClick={() => insertFormatting('\n| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n')} className="btn-icon" title="Insert Table" style={{ padding: '6px' }}>
                <Table size={14} />
              </button>
            </div>

            {/* View Mode & Word Count */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Words: <strong style={{ color: '#fff' }}>{contentScoreBreakdown.words}</strong>
              </div>

              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-base)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
                <button 
                  onClick={() => setIsPreviewMode(false)}
                  style={{ 
                    padding: '4px 10px', 
                    fontSize: '0.75rem', 
                    borderRadius: '4px',
                    border: 'none',
                    background: !isPreviewMode ? 'var(--primary-accent)' : 'transparent',
                    color: !isPreviewMode ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button 
                  onClick={() => setIsPreviewMode(true)}
                  style={{ 
                    padding: '4px 10px', 
                    fontSize: '0.75rem', 
                    borderRadius: '4px',
                    border: 'none',
                    background: isPreviewMode ? 'var(--primary-accent)' : 'transparent',
                    color: isPreviewMode ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Eye size={13} /> Preview
                </button>
              </div>
            </div>
          </div>

          {/* FLOATING / INLINE AI ACTIONS BAR */}
          {showInlineAI && !isPreviewMode && (
            <div className="animate-fade-in" style={{
              background: 'linear-gradient(90deg, #1E2532, #2A1B3D)',
              borderBottom: '1px solid var(--primary-accent)',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={15} color="var(--primary-accent)" />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>
                  Selection AI ({selectedText.length} chars):
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  disabled={inlineLoading}
                  onClick={() => handleExecuteInlineAI('expand')}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#38BDF8' }}
                >
                  <Wand2 size={12} /> Expand
                </button>
                <button 
                  disabled={inlineLoading}
                  onClick={() => handleExecuteInlineAI('shorten')}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#F59E0B' }}
                >
                  <Scissors size={12} /> Shorten
                </button>
                <button 
                  disabled={inlineLoading}
                  onClick={() => handleExecuteInlineAI('add_stats')}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#10B981' }}
                >
                  <TrendingUp size={12} /> Add Stats
                </button>
                <button 
                  disabled={inlineLoading}
                  onClick={() => handleExecuteInlineAI('humanize')}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#A78BFA' }}
                >
                  <Sparkles size={12} /> Humanize
                </button>

                {/* Custom Instruction Input */}
                <input 
                  placeholder="Custom instruction..."
                  value={customInlinePrompt}
                  onChange={(e) => setCustomInlinePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customInlinePrompt) {
                      handleExecuteInlineAI('custom', customInlinePrompt);
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: '#fff',
                    outline: 'none',
                    width: '140px'
                  }}
                />
                {customInlinePrompt && (
                  <button 
                    onClick={() => handleExecuteInlineAI('custom', customInlinePrompt)}
                    className="btn btn-primary"
                    style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                  >
                    Go
                  </button>
                )}

                {inlineLoading && <RefreshCw size={14} className="spinner" style={{ border: 'none', color: '#fff' }} />}
              </div>
            </div>
          )}

          {/* MAIN CONTENT AREA: TEXTAREA OR RENDERED MARKDOWN */}
          {isPreviewMode ? (
            <div 
              className="editor-content markdown-preview" 
              style={{ 
                flex: 1,
                width: '100%', 
                background: 'transparent', 
                color: '#F3F4F6',
                padding: '32px 48px',
                lineHeight: '1.8',
                overflowY: 'auto',
                fontSize: '1.05rem'
              }}
            >
              <ReactMarkdown>{article.content || '*No content written yet. Use the sidebar to generate sections or start typing.*'}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              ref={contentRef}
              className="editor-content"
              onSelect={handleEditorSelect}
              onMouseUp={handleEditorSelect}
              onKeyUp={handleEditorSelect}
              style={{ 
                flex: 1,
                width: '100%', 
                minHeight: '650px',
                background: 'transparent', 
                border: 'none', 
                color: '#F3F4F6',
                resize: 'none',
                fontFamily: 'monospace',
                fontSize: '1rem',
                lineHeight: '1.7',
                padding: '24px 32px',
                outline: 'none'
              }}
              value={article.content || ''}
              onChange={(e) => saveArticle({ content: e.target.value })}
              placeholder="# Enter your article heading here...&#10;&#10;Click 'Write Section' in the sidebar or type freely. Highlight any text for instant Inline AI actions."
            />
          )}
        </div>

      </div>
    </div>
  );
}
