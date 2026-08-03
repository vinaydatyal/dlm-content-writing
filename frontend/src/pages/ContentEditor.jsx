import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Play, Download, Settings, RefreshCw, FileText, CheckCircle, AlertTriangle, Sparkles, Undo2, BarChart3, Trash2, Plus, ShieldCheck } from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─── SEO Scoring Utilities (client-side, no API) ───
function calcKeywordDensity(content, keyword) {
  if (!content || !keyword) return 0;
  const words = content.toLowerCase().split(/\s+/).filter(Boolean);
  const kw = keyword.toLowerCase();
  const count = content.toLowerCase().split(kw).length - 1;
  return words.length > 0 ? ((count / words.length) * 100).toFixed(1) : 0;
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

function findSecondaryKeywords(outline) {
  if (!outline) return [];
  const all = [];
  outline.forEach(s => {
    if (s.keywords_to_include) all.push(...s.keywords_to_include);
  });
  return [...new Set(all)].slice(0, 15);
}

// ─── SEO Score Panel Component ───
function SEOScorePanel({ content, keyword, targetWords, outline }) {
  const words = content?.split(/\s+/).filter(Boolean) || [];
  const wordCount = words.length;
  const progress = targetWords ? Math.min(100, Math.round((wordCount / targetWords) * 100)) : 0;
  const density = calcKeywordDensity(content, keyword);
  const readability = calcReadability(content);
  const secondaryKws = findSecondaryKeywords(outline);

  const densityColor = density >= 0.5 && density <= 2.5 ? '#10B981' : density > 2.5 ? '#EF4444' : '#F59E0B';
  const readColor = readability.score >= 60 ? '#10B981' : readability.score >= 40 ? '#F59E0B' : '#EF4444';

  // Check which secondary keywords appear in content
  const kwCoverage = secondaryKws.map(kw => ({
    keyword: kw,
    found: content?.toLowerCase().includes(kw.toLowerCase())
  }));
  const coveredCount = kwCoverage.filter(k => k.found).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Word Count Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Word Count</span>
          <span style={{ fontWeight: 600, color: progress >= 90 ? '#10B981' : 'var(--text-main)' }}>
            {wordCount.toLocaleString()} / {(targetWords || 0).toLocaleString()}
          </span>
        </div>
        <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-base)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '4px', transition: 'width 0.3s',
            width: `${progress}%`,
            background: progress >= 90 ? 'linear-gradient(90deg, #10B981, #059669)' : progress >= 50 ? 'linear-gradient(90deg, #F59E0B, #D97706)' : 'linear-gradient(90deg, #6366F1, #8B5CF6)'
          }} />
        </div>
      </div>

      {/* Keyword Density */}
      <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keyword Density</span>
          <span style={{ fontWeight: 700, color: densityColor, fontSize: '1.1rem' }}>{density}%</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Ideal: 0.5% – 2.5% | "{keyword}"
        </div>
      </div>

      {/* Readability Score */}
      <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Readability</span>
          <span style={{ fontWeight: 700, color: readColor, fontSize: '1.1rem' }}>{readability.score}</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Flesch-Kincaid: {readability.grade}
        </div>
      </div>

      {/* Secondary Keyword Coverage */}
      {secondaryKws.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Keyword Coverage</span>
            <span style={{ fontWeight: 600, color: coveredCount === secondaryKws.length ? '#10B981' : '#F59E0B' }}>
              {coveredCount}/{secondaryKws.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {kwCoverage.map((kw, i) => (
              <span key={i} style={{
                fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px',
                background: kw.found ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                color: kw.found ? '#10B981' : '#EF4444',
                border: `1px solid ${kw.found ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
              }}>
                {kw.found ? '✓' : '✗'} {kw.keyword}
              </span>
            ))}
          </div>
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState('editor');
  const [contentHistory, setContentHistory] = useState([]);
  const [projectInstructions, setProjectInstructions] = useState('');
  
  const [factChecking, setFactChecking] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState(null);
  
  const [generatingHooks, setGeneratingHooks] = useState(false);
  const [hooks, setHooks] = useState(null);

  const [analyzingGaps, setAnalyzingGaps] = useState(false);
  const [contentGaps, setContentGaps] = useState(null);
  
  const [checkingOriginality, setCheckingOriginality] = useState(false);
  const [originalityResult, setOriginalityResult] = useState(null);

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

      // SQLite stores JSON fields as strings — parse them back into objects/arrays
      const safeParseJSON = (val, fallback) => {
        if (!val) return fallback;
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val); } catch { return fallback; }
      };

      art.outline = safeParseJSON(art.outline, []);
      art.faq_schema = safeParseJSON(art.faq_schema, []);
      art.article_schema = safeParseJSON(art.article_schema, null);

      setProject(projRes.data);
      setArticle(art);
      // Load project-specific instructions (use article's, NOT client's)
      setProjectInstructions(art.custom_instructions || '');

      // Fetch client profile if project has one
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


  // Save a snapshot before destructive operations
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
  };

  const handleGenerateSection = async (section, index) => {
    if (generatingSection !== null) return;
    
    // Check if section was already generated — if so, push history for redo
    const isRegen = article.content?.includes(section.heading);
    if (isRegen) {
      pushHistory(`Before re-generate: ${section.heading}`);
    }

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
          // Project-specific instructions take priority over client profile's global ones
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
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
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
    } catch (err) {
      addToast('Failed to polish content', 'error');
    } finally {
      setPolishing(false);
    }
  };

  const handleHumanize = async () => {
    if (!article.content) return;
    if (!confirm('This will rewrite the entire article to sound more human. Your current content will be replaced. Continue?')) return;
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
    } catch (err) {
      addToast('Failed to humanize content. Please try again.', 'error');
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

  const updateOutlineSection = (index, field, value) => {
    const newOutline = [...article.outline];
    newOutline[index][field] = value;
    setArticle(prev => ({ ...prev, outline: newOutline }));
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

  const insertHook = (hookItem) => {
    const newContent = `# ${hookItem.title}\n\n${hookItem.hook}\n\n` + (article.content || '');
    pushHistory('Insert Hook');
    setArticle(prev => ({ ...prev, content: newContent }));
    saveArticle({ content: newContent });
    addToast('Hook inserted', 'success');
  };

  const saveOutlineToDb = () => {
    saveArticle({ outline: article.outline });
  };

  const handleAnalyzeGaps = async () => {
    setAnalyzingGaps(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/gap-analysis`, {
        keyword: project.keyword,
        outline: article.outline,
        serp_data: typeof article.serp_data === 'string' ? JSON.parse(article.serp_data || '{}') : article.serp_data
      }, { headers: { Authorization: `Bearer ${token}` } });
      setContentGaps(res.data.gaps);
    } catch (err) {
      addToast('Failed to analyze gaps', 'error');
    } finally {
      setAnalyzingGaps(false);
    }
  };

  const handleAddGapToOutline = (gap, index) => {
    const newOutline = [...(article.outline || []), gap];
    setArticle(prev => ({ ...prev, outline: newOutline }));
    saveArticle({ outline: newOutline });
    setContentGaps(prev => prev.filter((_, i) => i !== index));
    addToast('Gap added to outline', 'success');
  };

  const handleOriginalityCheck = async () => {
    setCheckingOriginality(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/content/originality-check`, {
        content: article.content
      }, { headers: { Authorization: `Bearer ${token}` } });
      setOriginalityResult(res.data);
    } catch (err) {
      addToast('Failed to run originality check', 'error');
    } finally {
      setCheckingOriginality(false);
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
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
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
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1>{project.keyword}</h1>
            <span className={`badge ${article.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>
              {(article.status || 'draft').replace('_', ' ')}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Target: ~{project.target_word_count} words</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {contentHistory.length > 0 && (
            <button className="btn btn-secondary" onClick={handleUndo} title={`Undo: ${contentHistory[contentHistory.length - 1]?.label}`}
              style={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.4)' }}>
              <Undo2 size={16} /> Undo
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => handleExport('html')} disabled={!article.content}>
            <Download size={16} /> HTML
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('docx')} disabled={!article.content}>
            <Download size={16} /> DOCX
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleHumanize} 
            disabled={!article.content || humanizing || generatingSection !== null}
            style={{ color: '#A78BFA', borderColor: 'rgba(167,139,250,0.4)' }}
          >
            {humanizing 
              ? <><RefreshCw size={16} className="spinner" style={{ border: 'none' }} /> Humanizing...</> 
              : <><Sparkles size={16} /> Humanize</>}
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={handleFactCheck} 
            disabled={!article.content || factChecking || !clientProfile}
            style={{ color: '#38BDF8', borderColor: 'rgba(56,189,248,0.4)' }}
          >
            {factChecking 
              ? <><RefreshCw size={16} className="spinner" style={{ border: 'none' }} /> Checking...</> 
              : <><ShieldCheck size={16} /> Verify Brand</>}
          </button>

          <button className="btn btn-primary" onClick={handlePolish} disabled={!article.content || polishing}>
            {polishing ? <RefreshCw size={16} className="spinner" style={{ border: 'none' }} /> : <CheckCircle size={16} />}
            Final Polish
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        
        {/* LEFT SIDEBAR: Outline & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '0' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setActiveTab('editor')}
                style={{ flex: '1 1 20%', padding: '12px 6px', background: activeTab === 'editor' ? 'var(--bg-surface-hover)' : 'transparent', border: 'none', color: activeTab === 'editor' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}
              >Outline</button>
              <button 
                onClick={() => setActiveTab('score')}
                style={{ flex: '1 1 20%', padding: '12px 6px', background: activeTab === 'score' ? 'var(--bg-surface-hover)' : 'transparent', border: 'none', color: activeTab === 'score' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}
              >📊 Score</button>
              <button 
                onClick={() => setActiveTab('brief')}
                style={{ flex: '1 1 20%', padding: '12px 6px', background: activeTab === 'brief' ? 'var(--bg-surface-hover)' : 'transparent', border: 'none', color: activeTab === 'brief' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}
              >Brief</button>
              <button 
                onClick={() => setActiveTab('hooks')}
                style={{ flex: '1 1 20%', padding: '12px 6px', background: activeTab === 'hooks' ? 'var(--bg-surface-hover)' : 'transparent', border: 'none', color: activeTab === 'hooks' ? '#A78BFA' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}
              >🪝 Hooks</button>
              <button 
                onClick={() => setActiveTab('polish')}
                style={{ flex: '1 1 20%', padding: '12px 6px', background: activeTab === 'polish' ? 'var(--bg-surface-hover)' : 'transparent', border: 'none', color: activeTab === 'polish' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}
              >Meta</button>
              <button 
                onClick={() => setActiveTab('fact-check')}
                style={{ flex: '1 1 20%', padding: '12px 6px', background: activeTab === 'fact-check' ? 'var(--bg-surface-hover)' : 'transparent', border: 'none', color: activeTab === 'fact-check' ? '#38BDF8' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}
              >🛡️ Brand & Originality</button>
            </div>

            <div style={{ padding: '16px', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
              {activeTab === 'editor' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Project-Specific Instructions */}
                  <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: `1px solid ${projectInstructions ? 'rgba(238,39,112,0.4)' : 'var(--border-color)'}` }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: projectInstructions ? 'var(--primary-accent)' : 'var(--text-muted)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>✍️ Writing Instructions</span>
                      {projectInstructions ? <span style={{ fontSize: '0.65rem', background: 'rgba(238,39,112,0.15)', color: 'var(--primary-accent)', padding: '2px 6px', borderRadius: '10px' }}>Project-Specific</span> : (clientProfile ? <span style={{ fontSize: '0.65rem', background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '10px' }}>From Client Profile</span> : null)}
                    </div>
                    <textarea
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.8rem', resize: 'vertical', outline: 'none', minHeight: '70px', fontFamily: 'var(--font-sans)' }}
                      placeholder={clientProfile?.custom_instructions || 'Add project-specific writing instructions...'}
                      value={projectInstructions}
                      onChange={(e) => setProjectInstructions(e.target.value)}
                      onBlur={() => saveArticle({ custom_instructions: projectInstructions })}
                    />
                    {clientProfile?.custom_instructions && projectInstructions && (
                      <div style={{ fontSize: '0.7rem', color: '#F59E0B', marginTop: '4px' }}>⚠️ Overrides client profile instructions</div>
                    )}
                  </div>

                  {article.outline?.map((section, idx) => {
                    const isGenerated = article.content?.includes(section.heading);
                    const isGenerating = generatingSection === idx;
                    
                    return (
                      <div key={idx} style={{ 
                        padding: '12px', 
                        background: 'var(--bg-base)', 
                        borderRadius: 'var(--radius-sm)', 
                        border: `1px solid ${isGenerating ? 'var(--primary-accent)' : isGenerated ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
                        opacity: (generatingSection !== null && !isGenerating) ? 0.5 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <select 
                            className="input" 
                            value={section.type} 
                            onChange={(e) => {
                              updateOutlineSection(idx, 'type', e.target.value);
                              saveOutlineToDb();
                            }}
                            style={{ width: '70px', padding: '6px', fontSize: '0.8rem', height: '32px' }}
                          >
                            <option value="h1">H1</option>
                            <option value="h2">H2</option>
                            <option value="h3">H3</option>
                          </select>
                          
                          <input 
                            className="input" 
                            type="text" 
                            value={section.heading}
                            onChange={(e) => updateOutlineSection(idx, 'heading', e.target.value)}
                            onBlur={saveOutlineToDb}
                            style={{ flex: 1, fontWeight: 'bold', padding: '6px', fontSize: '0.85rem', height: '32px', color: isGenerated ? '#10B981' : 'var(--text-main)' }}
                          />

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '90px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Words:</span>
                            <input 
                              className="input" 
                              type="number" 
                              value={section.target_words}
                              onChange={(e) => updateOutlineSection(idx, 'target_words', parseInt(e.target.value) || 0)}
                              onBlur={saveOutlineToDb}
                              style={{ width: '50px', padding: '6px', fontSize: '0.8rem', height: '32px' }}
                            />
                          </div>
                          
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => removeOutlineSection(idx)}
                            style={{ padding: '6px', height: '32px', color: '#EF4444', borderColor: 'transparent', background: 'rgba(239, 68, 68, 0.1)' }}
                            title="Delete Section"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        
                        <textarea 
                          className="input" 
                          placeholder="Section notes / instructions..."
                          value={section.notes || ''}
                          onChange={(e) => updateOutlineSection(idx, 'notes', e.target.value)}
                          onBlur={saveOutlineToDb}
                          style={{ minHeight: '50px', fontSize: '0.8rem', padding: '8px' }}
                        />

                        <button 
                          onClick={() => handleGenerateSection(section, idx)}
                          disabled={generatingSection !== null}
                          className="btn btn-secondary"
                          style={{ width: '100%', padding: '6px', fontSize: '0.8rem', marginTop: '4px' }}
                        >
                          {isGenerating ? 'Generating...' : isGenerated ? '↻ Re-generate' : 'Generate Section'}
                        </button>
                      </div>
                    );
                  })}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button 
                      className="btn btn-secondary" 
                      onClick={addOutlineSection}
                      style={{ flex: 1 }}
                    >
                      <Plus size={16} /> Add Section
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={handleAnalyzeGaps}
                      disabled={analyzingGaps}
                      style={{ flex: 1, borderColor: '#38BDF8', color: '#38BDF8' }}
                    >
                      {analyzingGaps ? <RefreshCw size={16} className="spinner" /> : <Sparkles size={16} />} 
                      Analyze Gaps
                    </button>
                  </div>

                  {contentGaps && contentGaps.length > 0 && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <h4 style={{ fontSize: '0.85rem', color: '#38BDF8', marginBottom: '12px' }}>Competitor Content Gaps Found:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {contentGaps.map((gap, i) => (
                          <div key={i} style={{ padding: '12px', background: 'rgba(56, 189, 248, 0.05)', border: '1px dashed rgba(56, 189, 248, 0.3)', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h5 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'var(--text-main)' }}>{gap.heading}</h5>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{gap.notes}</p>
                              </div>
                              <button className="btn btn-primary" onClick={() => handleAddGapToOutline(gap, i)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                + Add
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {contentGaps && contentGaps.length === 0 && (
                    <div style={{ marginTop: '16px', padding: '12px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', borderRadius: '4px', fontSize: '0.8rem' }}>
                      Your outline is comprehensive! No major competitor gaps found.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'score' && (
                <SEOScorePanel 
                  content={article.content} 
                  keyword={project.keyword} 
                  targetWords={project.target_word_count}
                  outline={article.outline}
                />
              )}

              {activeTab === 'brief' && (
                <textarea
                  style={{ 
                    width: '100%', 
                    background: 'transparent', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text-muted)', 
                    fontSize: '0.85rem', 
                    resize: 'vertical', 
                    outline: 'none', 
                    minHeight: '300px', 
                    fontFamily: 'monospace',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)'
                  }}
                  value={article.brief || ''}
                  onChange={(e) => setArticle(prev => ({ ...prev, brief: e.target.value }))}
                  onBlur={() => saveArticle({ brief: article.brief })}
                  placeholder="Enter or edit your content brief here..."
                />
              )}

              {activeTab === 'hooks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <button className="btn btn-primary" onClick={handleGenerateHooks} disabled={generatingHooks} style={{ width: '100%', background: '#8B5CF6', color: '#fff', borderColor: '#8B5CF6' }}>
                    {generatingHooks ? <><RefreshCw size={16} className="spinner" /> Brainstorming...</> : <><Sparkles size={16} /> Generate Hook Ideas</>}
                  </button>

                  {hooks && hooks.map((h, i) => (
                    <div key={i} style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#A78BFA', marginBottom: '8px', textTransform: 'uppercase' }}>
                        {h.type}
                      </div>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '1rem' }}>{h.title}</h4>
                      <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        {h.hook}
                      </p>
                      <button className="btn btn-secondary" onClick={() => insertHook(h)} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                        Insert at Top
                      </button>
                    </div>
                  ))}
                  
                  {!hooks && !generatingHooks && (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Generate A/B testable titles and introductory hooks (Data-driven, Empathy-led, Curiosity) to grab your reader's attention instantly.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'polish' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Meta Title</label>
                    <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '4px', fontSize: '0.9rem' }}>
                      {article.meta_title || 'Not generated yet'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Meta Description</label>
                    <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '4px', fontSize: '0.9rem' }}>
                      {article.meta_description || 'Not generated yet'}
                    </div>
                  </div>

                  {/* Featured Snippet */}
                  {article.featured_snippet && (
                    <div>
                      <label style={{ fontSize: '0.85rem', color: '#A78BFA', marginBottom: '4px', display: 'block', fontWeight: 600 }}>🎯 Featured Snippet</label>
                      <div style={{ padding: '12px', background: 'rgba(167,139,250,0.08)', borderRadius: '4px', fontSize: '0.85rem', border: '1px solid rgba(167,139,250,0.25)', lineHeight: '1.5' }}>
                        {article.featured_snippet}
                      </div>
                    </div>
                  )}

                  {/* Article Schema */}
                  {article.article_schema && (
                    <div>
                      <label style={{ fontSize: '0.85rem', color: '#10B981', marginBottom: '4px', display: 'block', fontWeight: 600 }}>✅ Article Schema (JSON-LD)</label>
                      <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
                        {JSON.stringify(article.article_schema, null, 2)}
                      </div>
                    </div>
                  )}

                  {article.faq_schema?.length > 0 && (
                    <div>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>FAQ Schema</label>
                      <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(article.faq_schema, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'fact-check' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Originality Check Section */}
                  <div style={{ padding: '20px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={18} color="#A78BFA" /> Plagiarism & AI Check</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Scan your content for plagiarism and AI footprint before publishing.</p>
                    
                    {!originalityResult && !checkingOriginality && (
                      <button className="btn btn-secondary" onClick={handleOriginalityCheck}>
                        Run Originality Scan
                      </button>
                    )}

                    {checkingOriginality && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A78BFA' }}>
                        <RefreshCw size={16} className="spinner" /> Scanning document...
                      </div>
                    )}

                    {originalityResult && (
                      <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                        <div style={{ flex: 1, padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10B981' }}>{originalityResult.originality}%</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Original (Plagiarism-Free)</div>
                        </div>
                        <div style={{ flex: 1, padding: '16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#38BDF8' }}>{originalityResult.human}%</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Human-Written</div>
                        </div>
                      </div>
                    )}
                    {originalityResult && originalityResult.details && (
                      <p style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '12px', fontStyle: 'italic' }}>{originalityResult.details}</p>
                    )}
                  </div>

                  {/* Brand Compliance Section */}
                  <div style={{ padding: '20px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} color="#38BDF8" /> Brand Compliance</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Ensure the AI didn't invent fake product features or use banned words.</p>
                    
                    {!factCheckResult && !factChecking && (
                      <button className="btn btn-secondary" onClick={handleFactCheck}>
                        Verify Brand Compliance
                      </button>
                    )}

                  {factChecking && (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw size={32} className="spinner" style={{ marginBottom: '16px' }} />
                      <p>Analyzing content against client profile...</p>
                    </div>
                  )}

                  {factCheckResult && !factChecking && (
                    <div>
                      <div style={{ 
                        padding: '16px', 
                        borderRadius: 'var(--radius-sm)', 
                        background: factCheckResult.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${factCheckResult.passed ? '#10B981' : '#EF4444'}`,
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        {factCheckResult.passed ? <CheckCircle size={24} color="#10B981" /> : <AlertTriangle size={24} color="#EF4444" />}
                        <h3 style={{ margin: 0, color: factCheckResult.passed ? '#10B981' : '#EF4444' }}>
                          {factCheckResult.passed ? 'Passed Compliance Check' : 'Violations Detected'}
                        </h3>
                      </div>

                      {factCheckResult.violations && factCheckResult.violations.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <h4 style={{ color: '#EF4444', marginBottom: '8px' }}>Violations / Hallucinations:</h4>
                          <ul style={{ paddingLeft: '20px', color: 'var(--text-main)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {factCheckResult.violations.map((v, i) => <li key={i}>{v}</li>)}
                          </ul>
                        </div>
                      )}

                      {factCheckResult.recommendations && factCheckResult.recommendations.length > 0 && (
                        <div>
                          <h4 style={{ color: '#38BDF8', marginBottom: '8px' }}>Recommendations:</h4>
                          <ul style={{ paddingLeft: '20px', color: 'var(--text-main)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {factCheckResult.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Editor */}
        <div className="rich-text-editor">
          <div className="editor-toolbar">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Words: {article.content?.split(/\s+/).filter(w => w.length > 0).length || 0}
            </div>
          </div>
          <textarea
            ref={contentRef}
            className="editor-content"
            style={{ 
              width: '100%', 
              background: 'transparent', 
              border: 'none', 
              color: '#F3F4F6',
              resize: 'none',
              fontFamily: 'monospace',
              fontSize: '1rem',
              lineHeight: '1.6'
            }}
            value={article.content || ''}
            onChange={(e) => saveArticle({ content: e.target.value })}
            placeholder="Content will appear here as it's generated..."
          />
        </div>

      </div>
    </div>
  );
}
