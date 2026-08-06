import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Plus, Trash2, Edit2, Loader, Save, X, LayoutTemplate, RotateCcw, 
  Copy, Search, ChevronDown, ChevronUp, Sparkles, Filter, FileText, Check
} from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const TONE_SUGGESTIONS = [
  'Professional & Authoritative',
  'Conversational & Engaging',
  'Technical & In-Depth',
  'Persuasive & High-Intent',
  'Educational & Friendly'
];

export default function Templates() {
  const { addToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('blog_post');
  const [instructions, setInstructions] = useState('');
  const [targetWordCount, setTargetWordCount] = useState(1500);
  const [toneOfVoice, setToneOfVoice] = useState('Professional & Authoritative');
  const [formattingRules, setFormattingRules] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data);
    } catch (err) {
      addToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('This will sync all 10 agency-grade default prompt templates (Standard Blog, Skyscraper 10x, Comparison VS, Listicles, How-To Tutorials, Content Refresh, Product Pages, Location Pages, Service Pages, Topic Pillars). Proceed?')) return;
    setIsResetting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/templates/reset-defaults`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data.templates);
      addToast('Agency default templates synced successfully!', 'success');
    } catch (err) {
      addToast('Failed to restore default templates', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleEdit = (tpl) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setType(tpl.type);
    setInstructions(tpl.instructions || '');
    setTargetWordCount(tpl.target_word_count || 1500);
    setToneOfVoice(tpl.tone_of_voice || 'Professional & Authoritative');
    setFormattingRules(tpl.formatting_rules || '');
    
    // Scroll form into view if on mobile/smaller screens
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = async (tpl) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/templates/duplicate/${tpl.id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast(`Duplicated "${tpl.name}" as custom template`, 'success');
      setTemplates(prev => [res.data, ...prev]);
      handleEdit(res.data);
    } catch (err) {
      addToast('Failed to duplicate template', 'error');
    }
  };

  const handleCopyPrompt = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast('Prompt copied to clipboard', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setType('blog_post');
    setInstructions('');
    setTargetWordCount(1500);
    setToneOfVoice('Professional & Authoritative');
    setFormattingRules('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return addToast('Template name is required', 'warning');
    if (!instructions.trim()) return addToast('Prompt instructions are required', 'warning');
    
    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const payload = { 
      name: name.trim(), 
      type, 
      instructions: instructions.trim(),
      target_word_count: Number(targetWordCount) || 1500,
      tone_of_voice: toneOfVoice.trim() || 'Professional & Authoritative',
      formatting_rules: formattingRules.trim()
    };

    try {
      if (editingId) {
        const res = await axios.put(`${API_URL}/templates/${editingId}`, payload, { headers });
        setTemplates(prev => prev.map(t => t.id === editingId ? res.data : t));
        addToast('Template updated successfully!', 'success');
      } else {
        const res = await axios.post(`${API_URL}/templates`, payload, { headers });
        setTemplates(prev => [res.data, ...prev]);
        addToast('New template created successfully!', 'success');
      }
      resetForm();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save template', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, templateName) => {
    if (!confirm(`Are you sure you want to delete template "${templateName}"?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (editingId === id) resetForm();
      addToast('Template deleted successfully', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete template', 'error');
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl => {
      const matchesSearch = 
        tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tpl.instructions && tpl.instructions.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tpl.type && tpl.type.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedType === 'all' || tpl.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [templates, searchQuery, selectedType]);

  const typeLabels = {
    all: 'All Templates',
    blog_post: 'Blog Post',
    content_refresh: 'Content Refresh',
    product_page: 'Product Page',
    location_page: 'Location Page',
    service_page: 'Service Page',
    info_page: 'Info / Pillar'
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <Loader className="spinner" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <LayoutTemplate color="var(--primary-accent)" /> 
            Prompt Template Studio
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', fontSize: '0.95rem' }}>
            Customize AI writing instructions, word counts, tones, and formatting rules. Edit directly or clone templates.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleResetDefaults}
            disabled={isResetting}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
            title="Restore and sync all 10 agency-grade default prompt templates"
          >
            {isResetting ? <Loader className="spinner" size={14} /> : <RotateCcw size={14} />}
            Sync Agency Defaults
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Filter Bar & Templates List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Search & Filter Controls */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search templates by keyword, tone, or content type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {Object.entries(typeLabels).map(([key, label]) => (
                <button
                  key={key}
                  className={`btn ${selectedType === key ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    padding: '4px 12px', 
                    fontSize: '0.8rem', 
                    borderRadius: '20px',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => setSelectedType(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Template Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredTemplates.map(tpl => {
              const isExpanded = expandedId === tpl.id;
              const isEditing = editingId === tpl.id;

              return (
                <div 
                  key={tpl.id} 
                  className="card" 
                  style={{ 
                    padding: '20px', 
                    borderLeft: isEditing ? '4px solid var(--primary-accent)' : tpl.is_default ? '4px solid var(--secondary-accent)' : '4px solid var(--border-color)',
                    background: isEditing ? 'rgba(99, 102, 241, 0.05)' : undefined,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div className="flex-between" style={{ marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: '600' }}>
                      {tpl.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {tpl.is_default ? (
                        <span className="badge badge-green">Default</span>
                      ) : (
                        <span className="badge badge-blue">Custom</span>
                      )}
                      <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>
                        {tpl.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Summary / Snippet */}
                  <p style={{ 
                    color: 'var(--text-muted)', 
                    fontSize: '0.88rem', 
                    marginBottom: '14px', 
                    lineHeight: '1.5',
                    display: isExpanded ? 'block' : '-webkit-box', 
                    WebkitLineClamp: isExpanded ? 'unset' : 2, 
                    WebkitBoxOrient: 'vertical', 
                    overflow: isExpanded ? 'visible' : 'hidden' 
                  }}>
                    {tpl.instructions}
                  </p>

                  {/* Formatting Rules preview when expanded */}
                  {isExpanded && tpl.formatting_rules && (
                    <div style={{ 
                      background: 'var(--bg-secondary)', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      fontSize: '0.85rem', 
                      marginBottom: '14px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-main)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={13} color="var(--primary-accent)" /> Formatting Rules:
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>{tpl.formatting_rules}</div>
                    </div>
                  )}

                  {/* Metadata Chips */}
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                    <div><strong>Target Words:</strong> {tpl.target_word_count?.toLocaleString()} words</div>
                    <div><strong>Tone:</strong> {tpl.tone_of_voice || 'Professional'}</div>
                  </div>
                  
                  {/* Card Actions */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                    >
                      {isExpanded ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> View Details</>}
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleCopyPrompt(tpl.id, tpl.instructions)}
                        title="Copy prompt text"
                      >
                        {copiedId === tpl.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        {copiedId === tpl.id ? 'Copied' : 'Copy'}
                      </button>

                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleDuplicate(tpl)}
                        title="Duplicate as a new editable custom template"
                      >
                        <Sparkles size={14} color="var(--secondary-accent)" /> Clone
                      </button>

                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleEdit(tpl)}
                        title="Edit instructions, word count, and tone"
                      >
                        <Edit2 size={14} /> Edit
                      </button>

                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                        onClick={() => handleDelete(tpl.id, tpl.name)}
                        title="Delete template"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredTemplates.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>No templates matched your search criteria.</p>
                <button className="btn btn-secondary" onClick={() => { setSearchQuery(''); setSelectedType('all'); }}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Template Editor / Creator Form */}
        <div>
          <div className="card" style={{ position: 'sticky', top: '24px', border: editingId ? '1px solid var(--primary-accent)' : undefined }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                {editingId ? (
                  <><Edit2 size={18} color="var(--primary-accent)" /> Edit Template</>
                ) : (
                  <><Plus size={18} color="var(--primary-accent)" /> Create New Template</>
                )}
              </h3>
              {editingId && (
                <span className="badge badge-blue">Editing ID #{editingId}</span>
              )}
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              {editingId 
                ? 'Modify the prompt instructions, tone, and formatting rules below. Click Save when finished.'
                : 'Create a custom prompt template for your agency content workflow.'}
            </p>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Template Name *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. B2B SaaS Case Study, Affiliate Review"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Content Type *</label>
                <select 
                  className="input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                >
                  <option value="blog_post">Blog Post / Article</option>
                  <option value="content_refresh">Content Refresh (Optimizer Mode)</option>
                  <option value="product_page">Product Page / E-Commerce</option>
                  <option value="location_page">Location Page (Local SEO)</option>
                  <option value="service_page">Service Page (B2B / Agency)</option>
                  <option value="info_page">General Information / Topic Pillar</option>
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <div className="flex-between" style={{ marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>AI Prompt Instructions *</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{instructions.length} chars</span>
                </div>
                <textarea 
                  className="input" 
                  placeholder="Detailed prompt instructions for the AI on how to structure, tone, and write this exact type of content..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  style={{ minHeight: '130px', fontSize: '0.88rem', lineHeight: '1.5' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Target Word Count</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={targetWordCount}
                    onChange={(e) => setTargetWordCount(e.target.value)}
                    min="100"
                    step="50"
                    required
                  />
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Tone of Voice</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. Professional & Direct"
                    value={toneOfVoice}
                    onChange={(e) => setToneOfVoice(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Tone Suggestions */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Quick Tone Presets:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {TONE_SUGGESTIONS.map(t => (
                    <button
                      key={t}
                      type="button"
                      className="btn btn-secondary"
                      style={{ 
                        padding: '2px 8px', 
                        fontSize: '0.72rem', 
                        borderRadius: '12px',
                        background: toneOfVoice === t ? 'var(--primary-accent)' : undefined,
                        color: toneOfVoice === t ? '#fff' : undefined
                      }}
                      onClick={() => setToneOfVoice(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Formatting Rules (Optional)</label>
                <textarea 
                  className="input" 
                  placeholder="e.g. Use short 2-3 sentence paragraphs, bold key takeaway phrases, include bullet lists."
                  value={formattingRules}
                  onChange={(e) => setFormattingRules(e.target.value)}
                  style={{ minHeight: '65px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader className="spinner" size={16} />
                  ) : (
                    <><Save size={16} /> {editingId ? 'Save Changes' : 'Create Template'}</>
                  )}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    <X size={16} /> Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
