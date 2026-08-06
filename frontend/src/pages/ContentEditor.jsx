import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { 
  Play, Download, Settings, RefreshCw, FileText, CheckCircle, AlertTriangle, 
  Sparkles, Undo2, Redo2, History, BarChart3, Trash2, Plus, ShieldCheck, Eye, Edit3, Search,
  ChevronDown, ChevronRight, BookOpen, Users, Compass, Zap, HelpCircle, 
  ExternalLink, Copy, List, Heading1, Heading2, Heading3, Bold, Italic, 
  Quote, Table, Wand2, Scissors, TrendingUp, Check, Layers, Award, Columns,
  Share2, FileDown, CheckCheck, Scale
} from 'lucide-react';
import { useToast } from '../components/ToastContext';
import DiffReviewModal from '../components/DiffReviewModal';
import RevisionsModal from '../components/RevisionsModal';
import ExportCenterModal from '../components/ExportCenterModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper: Escape string for safe RegExp
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Slices a section out of the full article content given a heading string
function extractSectionSlice(fullContent = '', headingText = '') {
  if (!fullContent || !headingText) return null;
  const escaped = escapeRegex(headingText.trim());
  const headingRegex = new RegExp(`(^|\\n)(#{1,3}\\s+${escaped}[^\\n]*\\n?)`, 'i');
  const match = headingRegex.exec(fullContent);
  if (!match) return null;

  const startIndex = match.index + (match[1] ? match[1].length : 0);
  const remaining = fullContent.slice(startIndex + match[2].length);
  const nextHeadingRegex = /(^|\n)#{1,3}\s+/m;
  const nextMatch = nextHeadingRegex.exec(remaining);

  const endIndex = nextMatch 
    ? startIndex + match[2].length + nextMatch.index 
    : fullContent.length;

  return {
    startIndex,
    endIndex,
    originalText: fullContent.slice(startIndex, endIndex).trim()
  };
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
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
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
  const [projectInstructions, setProjectInstructions] = useState('');
  
  // ─── Undo, Redo, Revisions & Diff State ───
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showRevisionsModal, setShowRevisionsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const [diffModal, setDiffModal] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    originalContent: '',
    newContent: '',
    onAccept: null,
    onAppend: null
  });

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

  // ─── Save & History Engine ───
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

  const pushHistory = (label, currentContentOverride) => {
    const textToSave = currentContentOverride !== undefined ? currentContentOverride : (article?.content || '');
    if (!textToSave) return;
    setUndoStack(prev => [
      ...prev.slice(-29), // Keep up to 30 snapshots
      { label, content: textToSave, timestamp: new Date().toISOString() }
    ]);
    setRedoStack([]); // Clear redo on fresh edit
  };

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastItem = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);
    
    // Push current state to redoStack
    if (article?.content) {
      setRedoStack(prev => [
        ...prev,
        { label: `Before Undo: ${lastItem.label}`, content: article.content, timestamp: new Date().toISOString() }
      ]);
    }
    setUndoStack(newUndo);
    setArticle(prev => ({ ...prev, content: lastItem.content }));
    saveArticle({ content: lastItem.content });
    addToast(`Restored: ${lastItem.label}`, 'info');
  }, [undoStack, article?.content]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextItem = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);

    if (article?.content) {
      setUndoStack(prev => [
        ...prev,
        { label: `Before Redo: ${nextItem.label}`, content: article.content, timestamp: new Date().toISOString() }
      ]);
    }
    setRedoStack(newRedo);
    setArticle(prev => ({ ...prev, content: nextItem.content }));
    saveArticle({ content: nextItem.content });
    addToast(`Redone: ${nextItem.label}`, 'info');
  }, [redoStack, article?.content]);

  const handleRestoreRevision = (restoredContent, label) => {
    if (article?.content) {
      pushHistory(`Before Restore: ${label}`);
    }
    setArticle(prev => ({ ...prev, content: restoredContent }));
    saveArticle({ content: restoredContent });
    addToast(`Restored snapshot: ${label}`, 'success');
  };

  const handleClearHistory = () => {
    if (confirm('Clear your revision history stack for this article?')) {
      setUndoStack([]);
      setRedoStack([]);
      addToast('History cleared', 'info');
    }
  };

  // Keyboard shortcut listener for Undo (Ctrl+Z) / Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is inside a separate modal input (except editor textarea)
      if (diffModal.isOpen || showRevisionsModal || showExportModal) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        if (redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, diffModal.isOpen, showRevisionsModal, showExportModal, handleUndo, handleRedo]);

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
        status,
        in_heading: inHeading
      };
    });
  }, [nlpTerms, article?.content]);

  const filteredNlpTerms = useMemo(() => {
    return analyzedNlpTerms.filter(item => {
      const matchesSearch = item.term.toLowerCase().includes(nlpSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (nlpFilter === 'all') return true;
      if (nlpFilter === 'missing') return item.current_count === 0;
      return item.category === nlpFilter;
    });
  }, [analyzedNlpTerms, nlpSearch, nlpFilter]);

  // ─── 2. Frase Competitor Outlines ───
  const handleFetchCompetitors = async () => {
    if (!project?.keyword) return;
    setLoadingCompetitors(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/competitor-outlines`, {
        keyword: project.keyword,
        serp_data: article?.parsed_serp || {}
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data.competitors) {
        setCompetitors(res.data.competitors);
        addToast(`Loaded ${res.data.competitors.length} competitor outlines!`, 'success');
      }
    } catch (err) {
      addToast('Failed to load competitor outlines', 'error');
    } finally {
      setLoadingCompetitors(false);
    }
  };

  const handleImportCompetitorHeading = (heading) => {
    const cleanHeading = heading.replace(/^#{1,3}\s+/, '').trim();
    const newSection = {
      type: 'h2',
      heading: cleanHeading,
      target_words: 250,
      notes: 'Imported from competitor analysis'
    };
    const newOutline = [...(article?.outline || []), newSection];
    setArticle(prev => ({ ...prev, outline: newOutline }));
    saveArticle({ outline: newOutline });
    addToast(`Added "${cleanHeading}" to outline!`, 'success');
  };

  // ─── 3. Research Vault ───
  const handleFetchResearchVault = async () => {
    if (!project?.keyword) return;
    setLoadingResearch(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/research-vault`, {
        keyword: project.keyword,
        serp_data: article?.parsed_serp || {}
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data.research) {
        setResearchItems(res.data.research);
        addToast(`Found ${res.data.research.length} research nuggets & stats!`, 'success');
      }
    } catch (err) {
      addToast('Failed to fetch research items', 'error');
    } finally {
      setLoadingResearch(false);
    }
  };

  // ─── 4. Real-time Content Score Calculator ───
  const contentScoreBreakdown = useMemo(() => {
    const content = article?.content || '';
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const targetWords = project?.target_word_count || 1500;
    
    // Length score (0 - 25)
    let lengthScore = Math.min(25, Math.round((words / targetWords) * 25));
    if (words > targetWords * 1.5) lengthScore = 20;

    // Keyword density score (0 - 20)
    const density = calcKeywordDensity(content, project?.keyword);
    let densityScore = 0;
    if (density >= 0.8 && density <= 2.2) densityScore = 20;
    else if (density > 0 && density < 0.8) densityScore = Math.round((density / 0.8) * 20);
    else if (density > 2.2 && density <= 3.0) densityScore = 12;
    else densityScore = 5;

    // NLP coverage score (0 - 30)
    let nlpScore = 0;
    if (analyzedNlpTerms.length > 0) {
      const optimalOrUnder = analyzedNlpTerms.filter(t => t.current_count > 0).length;
      nlpScore = Math.round((optimalOrUnder / analyzedNlpTerms.length) * 30);
    } else {
      nlpScore = 15;
    }

    // Structure score (0 - 15)
    const h2Count = (content.match(/^##\s+/gm) || []).length;
    const h3Count = (content.match(/^###\s+/gm) || []).length;
    let structureScore = 0;
    if (h2Count >= 3) structureScore += 8;
    else structureScore += h2Count * 2.5;
    if (h3Count >= 2) structureScore += 7;
    else structureScore += h3Count * 3.5;
    structureScore = Math.min(15, Math.round(structureScore));

    // Readability score (0 - 10)
    const readability = calcReadability(content);
    let readabilityScore = 0;
    if (readability.score >= 50 && readability.score <= 75) readabilityScore = 10;
    else if (readability.score > 75) readabilityScore = 8;
    else if (readability.score >= 35) readabilityScore = 6;
    else readabilityScore = 3;

    const totalScore = Math.min(100, lengthScore + densityScore + nlpScore + structureScore + readabilityScore);

    return {
      totalScore,
      words,
      targetWords,
      density,
      densityScore,
      lengthScore,
      nlpScore,
      structureScore,
      readabilityScore,
      readability,
      h2Count,
      h3Count
    };
  }, [article?.content, project?.keyword, project?.target_word_count, analyzedNlpTerms]);

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

  const handleExecuteInlineAI = async (action, customPrompt, openInDiff = false) => {
    if (!selectedText || inlineLoading) return;
    setInlineLoading(true);

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
        const currentSelection = { ...selectionRange };

        if (openInDiff) {
          // Open Side-by-Side Diff modal for selection
          setDiffModal({
            isOpen: true,
            title: `Inline AI Review: ${action.replace(/_/g, ' ').toUpperCase()}`,
            subtitle: `Inspect side-by-side diff of your selection before replacing or appending.`,
            originalContent: selectedText,
            newContent: replacement,
            onAccept: (acceptedReplacement) => {
              pushHistory(`Inline AI (${action})`);
              const newContent = fullContent.substring(0, currentSelection.start) + acceptedReplacement + fullContent.substring(currentSelection.end);
              setArticle(prev => ({ ...prev, content: newContent }));
              saveArticle({ content: newContent });
              setShowInlineAI(false);
              setSelectedText('');
              setDiffModal(prev => ({ ...prev, isOpen: false }));
              addToast('Inline edit applied!', 'success');
            },
            onAppend: (appendedText) => {
              pushHistory(`Inline AI Append (${action})`);
              const newContent = fullContent.substring(0, currentSelection.end) + '\n\n' + appendedText + fullContent.substring(currentSelection.end);
              setArticle(prev => ({ ...prev, content: newContent }));
              saveArticle({ content: newContent });
              setShowInlineAI(false);
              setSelectedText('');
              setDiffModal(prev => ({ ...prev, isOpen: false }));
              addToast('Revision inserted below selection!', 'info');
            }
          });
        } else {
          // Direct apply with undo snapshot
          pushHistory(`Inline AI: ${action}`);
          const newContent = fullContent.substring(0, currentSelection.start) + replacement + fullContent.substring(currentSelection.end);
          setArticle(prev => ({ ...prev, content: newContent }));
          saveArticle({ content: newContent });
          setShowInlineAI(false);
          setSelectedText('');
          addToast('Inline edit applied!', 'success');
        }
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
    pushHistory('Format Text');
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
      pushHistory(`Inserted "${textToInsert}"`);
      setArticle(prev => ({ ...prev, content: newContent }));
      saveArticle({ content: newContent });
      return;
    }
    const start = el.selectionStart || full.length;
    const end = el.selectionEnd || full.length;
    const newContent = full.substring(0, start) + textToInsert + full.substring(end);
    pushHistory(`Inserted "${textToInsert}"`);
    setArticle(prev => ({ ...prev, content: newContent }));
    saveArticle({ content: newContent });
  };

  // ─── Section Generation & 2-View Side-by-Side Diff Review ───
  const handleGenerateSection = async (section, index) => {
    if (generatingSection !== null) return;
    
    const currentFullContent = article?.content || '';
    const existingSlice = extractSectionSlice(currentFullContent, section.heading);
    const isRegen = existingSlice !== null;

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
      const prefix = `${section.type === 'h1' ? '#' : section.type === 'h2' ? '##' : '###'} ${section.heading}\n\n`;
      let generatedSectionText = prefix;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n\n')) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              generatedSectionText += data.text;
            }
          }
        }
      }

      if (isRegen) {
        // TRIGGER SIDE-BY-SIDE DIFF REVIEW MODAL ("Two views to choose from")
        setDiffModal({
          isOpen: true,
          title: `Diff Review: "${section.heading}"`,
          subtitle: `Compare your existing draft section with the new AI generation before applying changes.`,
          originalContent: existingSlice.originalText,
          newContent: generatedSectionText.trim(),
          onAccept: (acceptedContent) => {
            pushHistory(`Regenerated: ${section.heading}`);
            const before = currentFullContent.slice(0, existingSlice.startIndex);
            const after = currentFullContent.slice(existingSlice.endIndex);
            const updatedArticleContent = (before + acceptedContent + (after.startsWith('\n') ? after : (after ? '\n\n' + after : ''))).trim();
            saveArticle({ content: updatedArticleContent });
            setDiffModal(prev => ({ ...prev, isOpen: false }));
            addToast(`Section "${section.heading}" replaced!`, 'success');
          },
          onAppend: (appendedContent) => {
            pushHistory(`Appended revision: ${section.heading}`);
            const before = currentFullContent.slice(0, existingSlice.endIndex);
            const after = currentFullContent.slice(existingSlice.endIndex);
            const updatedArticleContent = (before + '\n\n' + appendedContent + (after.startsWith('\n') ? after : (after ? '\n\n' + after : ''))).trim();
            saveArticle({ content: updatedArticleContent });
            setDiffModal(prev => ({ ...prev, isOpen: false }));
            addToast(`Revision appended below "${section.heading}"!`, 'info');
          }
        });
      } else {
        // Fresh section: append directly
        pushHistory(`Wrote Section: ${section.heading}`);
        const updatedArticleContent = (currentFullContent ? currentFullContent + '\n\n' : '') + generatedSectionText.trim();
        await saveArticle({ content: updatedArticleContent });
        addToast(`Section "${section.heading}" added to draft!`, 'success');
      }
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
    if (!confirm('Rewrite the article with active voice and human pacing? Your current draft will be backed up in revision history.')) return;
    pushHistory('Before Humanize Full Draft');
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
        faq_schema: article.faq_schema ? (typeof article.faq_schema === 'string' ? JSON.parse(article.faq_schema) : article.faq_schema) : [],
        article_schema: article.article_schema ? (typeof article.article_schema === 'string' ? JSON.parse(article.article_schema) : article.article_schema) : null
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
      addToast(`Exported as ${format.toUpperCase()}!`, 'success');
    } catch (err) {
      addToast(`Failed to export ${format.toUpperCase()}`, 'error');
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
        
        {/* Top Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Undo / Redo controls */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-base)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <button 
              className="btn-icon" 
              onClick={handleUndo} 
              disabled={undoStack.length === 0}
              title={undoStack.length > 0 ? `Undo (Ctrl+Z): ${undoStack[undoStack.length - 1]?.label}` : 'Undo (Ctrl+Z)'}
              style={{ padding: '6px 8px', color: undoStack.length > 0 ? '#F59E0B' : 'var(--text-muted)' }}
            >
              <Undo2 size={15} />
            </button>
            <button 
              className="btn-icon" 
              onClick={handleRedo} 
              disabled={redoStack.length === 0}
              title={redoStack.length > 0 ? `Redo (Ctrl+Y): ${redoStack[redoStack.length - 1]?.label}` : 'Redo (Ctrl+Y)'}
              style={{ padding: '6px 8px', color: redoStack.length > 0 ? '#38BDF8' : 'var(--text-muted)' }}
            >
              <Redo2 size={15} />
            </button>
          </div>

          {/* History Timeline Modal Button */}
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowRevisionsModal(true)}
            title="Inspect full revision timeline"
            style={{ padding: '8px 12px', fontSize: '0.8rem', gap: '6px' }}
          >
            <History size={14} color="var(--primary-accent)" />
            Revisions
            {undoStack.length > 0 && (
              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(238,39,112,0.2)', color: 'var(--primary-accent)', fontWeight: 700 }}>
                {undoStack.length}
              </span>
            )}
          </button>

          {/* 1-Click Multi-Format Export Center Button */}
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowExportModal(true)}
            disabled={!article.content} 
            style={{ padding: '8px 12px', fontSize: '0.8rem', gap: '6px', color: '#38BDF8', borderColor: 'rgba(56,189,248,0.3)' }}
          >
            <Download size={14} /> Export Center
          </button>

          {/* Humanize Button */}
          <button 
            className="btn btn-secondary" 
            onClick={handleHumanize} 
            disabled={!article.content || humanizing || generatingSection !== null}
            style={{ color: '#A78BFA', borderColor: 'rgba(167,139,250,0.4)', padding: '8px 12px', fontSize: '0.8rem' }}
          >
            {humanizing 
              ? <><RefreshCw size={14} className="spinner" style={{ border: 'none' }} /> Humanizing...</> 
              : <><Sparkles size={14} /> Humanize</>}
          </button>
          
          {/* Brand Audit Button */}
          <button 
            className="btn btn-secondary" 
            onClick={handleFactCheck} 
            disabled={!article.content || factChecking || !clientProfile}
            style={{ color: '#10B981', borderColor: 'rgba(16,185,129,0.3)', padding: '8px 12px', fontSize: '0.8rem' }}
          >
            {factChecking 
              ? <><RefreshCw size={14} className="spinner" style={{ border: 'none' }} /> Checking...</> 
              : <><ShieldCheck size={14} /> Brand Check</>}
          </button>

          {/* Final Polish Button */}
          <button className="btn btn-primary" onClick={handlePolish} disabled={!article.content || polishing} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
            {polishing ? <RefreshCw size={14} className="spinner" style={{ border: 'none' }} /> : <CheckCircle size={14} />}
            Final Polish
          </button>
        </div>
      </div>

      {/* ─── MAIN 2-COLUMN LAYOUT ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* ─── LEFT SIDEBAR: TABS & SUITE ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            
            {/* TAB NAVIGATION ROW 1 */}
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

            {/* TAB NAVIGATION ROW 2 */}
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
                            {isGenerated && (
                              <span style={{ fontSize: '0.7rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Check size={12} /> In Draft
                              </span>
                            )}
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
                            borderColor: isGenerated ? 'rgba(56,189,248,0.3)' : 'var(--border-color)',
                            color: isGenerated ? '#38BDF8' : 'var(--text-main)'
                          }}
                          onClick={() => handleGenerateSection(section, idx)}
                          disabled={generatingSection !== null}
                          title={isGenerated ? "Re-generate this section with side-by-side Diff comparison" : "Generate section with AI"}
                        >
                          {generatingSection === idx ? (
                            <><RefreshCw size={13} className="spinner" style={{ border: 'none' }} /> Writing...</>
                          ) : (
                            <>{isGenerated ? <><Scale size={13} /> Re-Generate (Diff Review)</> : <><Play size={13} fill="currentColor" /> Write Section</>}</>
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
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                  {comp.domain || comp.title}
                                </span>
                              </div>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>

                            {isExpanded && (
                              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {comp.headings?.length || 0} headings detected • Click '+' to add to outline
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto' }}>
                                  {comp.headings?.map((h, hIdx) => (
                                    <div 
                                      key={hIdx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px 8px',
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem'
                                      }}
                                    >
                                      <span style={{ color: '#D1D5DB', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {h}
                                      </span>
                                      <button 
                                        onClick={() => handleImportCompetitorHeading(h)}
                                        className="btn-icon" 
                                        title="Import into your outline"
                                        style={{ padding: '2px', color: '#10B981' }}
                                      >
                                        <Plus size={13} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: RESEARCH VAULT ─── */}
              {activeTab === 'research' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={15} /> SERP Research & Stats
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Verified facts & sources</span>
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
                      Synthesizing research stats & facts from top results...
                    </div>
                  ) : researchItems.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No research items extracted yet.
                      <div style={{ marginTop: '12px' }}>
                        <button className="btn btn-primary" onClick={handleFetchResearchVault} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          🔬 Extract Facts & Stats
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {researchItems.map((item, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: '10px 12px',
                            background: 'var(--bg-base)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>
                              {item.type || 'Fact'}
                            </span>
                            <button
                              onClick={() => insertTextAtCursor(item.fact || item.text)}
                              className="btn btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '0.68rem', color: '#F59E0B' }}
                            >
                              Insert
                            </button>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#F3F4F6', lineHeight: '1.4' }}>
                            {item.fact || item.text}
                          </p>
                          {item.source && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>Source: {item.source}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: CONTENT SCORE BREAKDOWN ─── */}
              {activeTab === 'score' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
                    <ScoreGauge score={contentScoreBreakdown.totalScore} size={110} strokeWidth={10} label="Overall Optimization Score" />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Word Count */}
                    <div style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>Content Length</span>
                        <strong style={{ color: contentScoreBreakdown.lengthScore >= 20 ? '#10B981' : '#F59E0B' }}>
                          {contentScoreBreakdown.words} / {contentScoreBreakdown.targetWords} words
                        </strong>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (contentScoreBreakdown.words / contentScoreBreakdown.targetWords) * 100)}%`, background: contentScoreBreakdown.lengthScore >= 20 ? '#10B981' : '#F59E0B', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>

                    {/* Primary Keyword Density */}
                    <div style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>Keyword Density ("{project.keyword}")</span>
                        <strong style={{ color: contentScoreBreakdown.densityScore >= 18 ? '#10B981' : '#F59E0B' }}>
                          {contentScoreBreakdown.density}% (Target: 1.0 - 2.0%)
                        </strong>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (contentScoreBreakdown.density / 2.0) * 100)}%`, background: contentScoreBreakdown.densityScore >= 18 ? '#10B981' : '#F59E0B', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>

                    {/* NLP Coverage */}
                    <div style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>NLP Entity Coverage</span>
                        <strong style={{ color: contentScoreBreakdown.nlpScore >= 20 ? '#10B981' : '#F59E0B' }}>
                          {contentScoreBreakdown.nlpScore}/30 pts
                        </strong>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(contentScoreBreakdown.nlpScore / 30) * 100}%`, background: '#10B981', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>

                    {/* Heading Structure */}
                    <div style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>Headings Hierarchy</span>
                        <strong style={{ color: contentScoreBreakdown.structureScore >= 12 ? '#10B981' : '#F59E0B' }}>
                          {contentScoreBreakdown.h2Count} H2s, {contentScoreBreakdown.h3Count} H3s
                        </strong>
                      </div>
                    </div>

                    {/* Readability */}
                    <div style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Flesch Readability</span>
                        <strong style={{ color: '#38BDF8' }}>
                          {contentScoreBreakdown.readability.grade} ({contentScoreBreakdown.readability.score}/100)
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── TAB: HOOKS ─── */}
              {activeTab === 'hooks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#A78BFA' }}>Introduction Hooks</h4>
                    <button className="btn btn-secondary" onClick={handleGenerateHooks} disabled={generatingHooks} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
                      {generatingHooks ? 'Generating...' : 'Generate'}
                    </button>
                  </div>

                  {hooks && hooks.map((hook, i) => (
                    <div key={i} style={{ padding: '10px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#A78BFA', textTransform: 'uppercase', marginBottom: '4px' }}>{hook.style}</div>
                      <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: '1.4' }}>{hook.text}</p>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => insertTextAtCursor(hook.text + '\n\n')} 
                        style={{ marginTop: '8px', fontSize: '0.7rem', padding: '3px 8px' }}
                      >
                        Insert at Cursor
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
                        {(typeof article.faq_schema === 'string' ? JSON.parse(article.faq_schema) : article.faq_schema).map((faq, i) => (
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
              gap: '10px',
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
                  onClick={() => handleExecuteInlineAI('expand', null, false)}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#38BDF8' }}
                  title="Expand selection with depth"
                >
                  <Wand2 size={12} /> Expand
                </button>
                <button 
                  disabled={inlineLoading}
                  onClick={() => handleExecuteInlineAI('shorten', null, false)}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#F59E0B' }}
                  title="Make selection concise"
                >
                  <Scissors size={12} /> Shorten
                </button>
                <button 
                  disabled={inlineLoading}
                  onClick={() => handleExecuteInlineAI('add_stats', null, false)}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#10B981' }}
                  title="Inject industry statistics"
                >
                  <TrendingUp size={12} /> Add Stats
                </button>
                <button 
                  disabled={inlineLoading}
                  onClick={() => handleExecuteInlineAI('humanize', null, false)}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#A78BFA' }}
                  title="Natural conversational human flow"
                >
                  <Sparkles size={12} /> Humanize
                </button>

                {/* Compare in Diff button */}
                <button 
                  disabled={inlineLoading}
                  onClick={() => handleExecuteInlineAI('rephrase', null, true)}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.4)' }}
                  title="Rephrase & preview in side-by-side Diff Modal"
                >
                  <Scale size={12} /> Compare in Diff
                </button>

                {/* Custom Instruction Input */}
                <input 
                  placeholder="Custom instruction..."
                  value={customInlinePrompt}
                  onChange={(e) => setCustomInlinePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customInlinePrompt) {
                      handleExecuteInlineAI('custom', customInlinePrompt, false);
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
                    onClick={() => handleExecuteInlineAI('custom', customInlinePrompt, false)}
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
              onChange={(e) => {
                const updated = e.target.value;
                setArticle(prev => ({ ...prev, content: updated }));
                saveArticle({ content: updated });
              }}
              placeholder="# Enter your article heading here...&#10;&#10;Click 'Write Section' in the sidebar or type freely. Highlight any text for instant Inline AI actions."
            />
          )}
        </div>

      </div>

      {/* ─── MODAL 1: SIDE-BY-SIDE DIFF REVIEW ("Two views to choose from") ─── */}
      <DiffReviewModal
        isOpen={diffModal.isOpen}
        title={diffModal.title}
        subtitle={diffModal.subtitle}
        originalContent={diffModal.originalContent}
        newContent={diffModal.newContent}
        onAccept={diffModal.onAccept}
        onAppend={diffModal.onAppend}
        onClose={() => setDiffModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ─── MODAL 2: REVISION HISTORY TIMELINE ─── */}
      <RevisionsModal
        isOpen={showRevisionsModal}
        history={undoStack}
        currentContent={article.content || ''}
        onRestore={handleRestoreRevision}
        onClearHistory={handleClearHistory}
        onClose={() => setShowRevisionsModal(false)}
      />

      {/* ─── MODAL 3: 1-CLICK MULTI-FORMAT EXPORT CENTER ─── */}
      <ExportCenterModal
        isOpen={showExportModal}
        project={project}
        article={article}
        onClose={() => setShowExportModal(false)}
        onExportDownload={handleExport}
      />

    </div>
  );
}
