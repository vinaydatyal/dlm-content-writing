import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, FileText, List, Check, ArrowRight, Loader, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PREDEFINED_TEMPLATES = [
  // Blog Posts
  { id: 'blog_standard', name: 'Standard Blog (Informational Intent)', type: 'blog_post', instructions: 'Write in a conversational but professional tone. Focus on directly answering the user query in the first 100 words.' },
  { id: 'blog_skyscraper', name: 'Skyscraper Content (High Competition)', type: 'blog_post', instructions: 'Write highly comprehensive 10x content. Include statistical data, expert quotes, and format heavily with tables, lists, and bold text.' },
  { id: 'blog_longtail', name: 'Niche Topic (Long-Tail Intent)', type: 'blog_post', instructions: 'Focus deeply on hyper-specific subtopics. Use secondary keywords naturally. Keep language highly technical and authoritative.' },
  { id: 'listicle', name: 'Listicle / Top X (Discovery Intent)', type: 'blog_post', instructions: 'Keep each item concise. Highlight the unique selling point of each item. Optimize H3 tags for quick scanning.' },
  { id: 'howto', name: 'Step-by-Step Guide (How-To Intent)', type: 'blog_post', instructions: 'Break down every step logically. Use numbered lists where possible. Include "Prerequisites" or "What you need" sections.' },
  
  // Product Pages
  { id: 'product_commercial', name: 'Product Page (Commercial Intent)', type: 'product_page', instructions: 'Focus heavily on benefits rather than just features. Use persuasive copywriting and end with a strong CTA.' },
  { id: 'review_transactional', name: 'Product Review (Transactional Intent)', type: 'product_page', instructions: 'Be objective but persuasive. List clear pros and cons. Include a "Final Verdict" or "Who this is for" section.' },
  { id: 'comparison', name: 'Product Comparison (Decision Intent)', type: 'product_page', instructions: 'Compare objectively across multiple dimensions. Emphasize differences in pricing, usability, and target audience.' },
  
  // Location Pages
  { id: 'local_hyper', name: 'Local SEO (Hyper-Local Focus)', type: 'location_page', instructions: 'Mention specific neighborhoods, local landmarks, and proximity to major roads. Establish trust as a local authority.' },
  { id: 'local_broad', name: 'Local SEO (Broad City Service)', type: 'location_page', instructions: 'Focus on serving the entire metropolitan area. Detail service areas and incorporate broad geographic modifiers.' },
  
  // Service Pages
  { id: 'service_core', name: 'Core Service (Conversion Focus)', type: 'service_page', instructions: 'Clearly define the problem it solves, the process, and include trust signals (testimonials/guarantees). Use a strong, conversion-focused CTA.' },
  { id: 'service_educational', name: 'Service Overview (Educational Focus)', type: 'service_page', instructions: 'Educate the reader on why they need this service. Break down industry jargon and outline the long-term ROI.' },
  
  // Info Pages
  { id: 'info_guide', name: 'Comprehensive Guide (Evergreen)', type: 'info_page', instructions: 'Provide in-depth, authoritative information designed to be evergreen. Use varied formatting, definitions, and extensive examples.' },
  { id: 'info_faq', name: 'FAQ / Glossary Hub', type: 'info_page', instructions: 'Format as direct Questions and Answers. Keep answers concise (under 50 words per answer) to target Featured Snippets.' },
];

export default function BriefBuilder() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  
  // Form State
  const [keyword, setKeyword] = useState('');
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [contentType, setContentType] = useState('blog_post');
  
  // Data State
  const [serpData, setSerpData] = useState(null);
  const [brief, setBrief] = useState('');
  const [outline, setOutline] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleTemplateChange = (e) => {
    const tplId = e.target.value;
    setSelectedTemplate(tplId);
    if (tplId) {
      const tpl = PREDEFINED_TEMPLATES.find(t => t.id === tplId);
      if (tpl) {
        setContentType(tpl.type);
        setCustomInstructions(tpl.instructions);
      }
    } else {
      setCustomInstructions('');
    }
  };

  const updateOutlineSection = (idx, field, value) => {
    const newOutline = [...outline];
    newOutline[idx][field] = value;
    setOutline(newOutline);
  };

  const addOutlineSection = () => {
    setOutline([...outline, { type: 'h2', heading: 'New Section', target_words: 200, notes: '', keywords_to_include: [] }]);
  };

  const removeOutlineSection = (idx) => {
    const newOutline = [...outline];
    newOutline.splice(idx, 1);
    setOutline(newOutline);
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/clients`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClients(res.data);
      } catch (err) {
        console.error('Failed to fetch clients', err);
      }
    };
    fetchClients();
  }, []);

  const handleNext = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    if (step === 1) {
      if (!keyword) return addToast('Keyword is required', 'warning');
      setLoading(true);
      try {
        // 1. Create Project
        const projRes = await axios.post(`${API_URL}/projects`, {
          keyword,
          title,
          client_id: clientId || null,
          content_type: contentType
        }, { headers });
        setProjectId(projRes.data.id);

        // 2. Fetch SERP Data
        const serpRes = await axios.post(`${API_URL}/serp/analyze`, { keyword }, { headers });
        setSerpData(serpRes.data);
        
        // Save SERP to article
        await axios.put(`${API_URL}/projects/${projRes.data.id}/article`, {
          serp_data: JSON.stringify(serpRes.data)
        }, { headers });

        setStep(2);
      } catch (err) {
        addToast('Failed to analyze SERP: ' + (err.response?.data?.error || err.message), 'error');
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      setLoading(true);
      try {
        const clientProfile = clients.find(c => c.id.toString() === clientId);
        const briefRes = await axios.post(`${API_URL}/content/brief`, {
          keyword,
          title,
          serp_data: serpData,
          content_type: contentType,
          client_profile: clientProfile
        }, { headers });
        
        setBrief(briefRes.data.brief);
        await axios.put(`${API_URL}/projects/${projectId}/article`, {
          brief: briefRes.data.brief,
          status: 'brief'
        }, { headers });
        
        setStep(3);
      } catch (err) {
        addToast('Failed to generate brief', 'error');
      } finally {
        setLoading(false);
      }
    } else if (step === 3) {
      setLoading(true);
      try {
        const outlineRes = await axios.post(`${API_URL}/content/outline`, {
          keyword,
          title,
          brief,
          content_type: contentType,
          serp_data: serpData
        }, { headers });
        
        setOutline(outlineRes.data.outline);
        await axios.put(`${API_URL}/projects/${projectId}/article`, {
          outline: outlineRes.data.outline,
          status: 'outline'
        }, { headers });
        
        setStep(4);
      } catch (err) {
        addToast('Failed to generate outline', 'error');
      } finally {
        setLoading(false);
      }
    } else if (step === 4) {
      // Save final outline and redirect to editor
      setLoading(true);
      try {
        await axios.put(`${API_URL}/projects/${projectId}/article`, {
          outline: JSON.stringify(outline),
          custom_instructions: customInstructions,
          status: 'writing'
        }, { headers });
        navigate(`/editor/${projectId}`);
      } catch (err) {
        addToast('Failed to save outline', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1>Create New Content</h1>
      
      {/* Wizard Header */}
      <div className="wizard-header" style={{ marginTop: '32px' }}>
        <div className={`wizard-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 1 ? <Check size={16} /> : '1'}</div>
          <span className="step-label">Details</span>
        </div>
        <div className={`wizard-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 2 ? <Check size={16} /> : '2'}</div>
          <span className="step-label">SERP</span>
        </div>
        <div className={`wizard-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 3 ? <Check size={16} /> : '3'}</div>
          <span className="step-label">Brief</span>
        </div>
        <div className={`wizard-step ${step >= 4 ? 'active' : ''}`}>
          <div className="step-circle">4</div>
          <span className="step-label">Outline</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: '32px' }}>
        {step === 1 && (
          <div className="animate-fade-in">
            <h2>Project Details</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Start by entering your target keyword and selecting a client profile.</p>
            
            <div className="grid-2">
              <div className="input-group">
                <label>Target Keyword *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. best project management software"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Working Title (Optional)</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Leave blank for AI recommendation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid-2">
              <div className="input-group">
                <label>Client Profile</label>
                <select 
                  className="input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">No Client (Default Settings)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Content Type</label>
                <select 
                  className="input"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                >
                  <option value="blog_post">Blog Post</option>
                  <option value="product_page">Product Page</option>
                  <option value="location_page">Location Page</option>
                  <option value="service_page">Service Page</option>
                  <option value="info_page">General Information Page</option>
                </select>
              </div>
            </div>

            <div className="input-group" style={{ marginTop: '16px' }}>
              <label>Content Brief Template (Optional)</label>
              <select 
                className="input"
                value={selectedTemplate}
                onChange={handleTemplateChange}
              >
                <option value="">Start from Scratch</option>
                {PREDEFINED_TEMPLATES.filter(t => t.type === contentType).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && serpData && (
          <div className="animate-fade-in">
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <div>
                <h2 style={{ marginBottom: '6px' }}>SERP Analysis</h2>
                {serpData.dominant_content_type && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Dominant format: <strong style={{ color: 'var(--text-main)' }}>{serpData.dominant_content_type}</strong>
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`badge ${serpData.source === 'serpapi' ? 'badge-green' : 'badge-purple'}`}>
                  {serpData.source === 'serpapi' ? '🔴 Live SERP' : '🤖 AI-Powered'}
                </span>
                <span className="badge badge-blue">~{serpData.avg_word_count} Target Words</span>
              </div>
            </div>
            
            <div className="grid-2">
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Top Competitors</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {serpData.top_results?.slice(0, 5).map((res, i) => (
                    <div key={i} style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Rank #{res.position}</div>
                      <div style={{ fontWeight: 500, color: 'var(--primary-accent)', marginBottom: '4px' }}>{res.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>{res.url}</div>
                      {res.snippet && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{res.snippet}</div>}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>People Also Ask</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {serpData.people_also_ask?.map((q, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      {q}
                    </div>
                  ))}
                </div>
                
                <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Related Searches</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                  {serpData.related_searches?.map((s, i) => (
                    <span key={i} className="badge" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      {s}
                    </span>
                  ))}
                </div>

                {serpData.content_gaps && serpData.content_gaps.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>🎯 Content Gaps to Win</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {serpData.content_gaps.map((gap, i) => (
                        <div key={i} style={{ padding: '10px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.9rem', color: 'var(--secondary-accent)' }}>
                          ✓ {gap}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}


        {step === 3 && (
          <div className="animate-fade-in">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h2>Strategic Brief</h2>
              <span className="badge badge-purple">AI Generated</span>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Review and edit the AI-generated brief before generating the outline.</p>
            
            <textarea 
              className="input" 
              style={{ minHeight: '400px', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.5' }}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
        )}

        {step === 4 && outline && (
          <div className="animate-fade-in">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h2>Article Outline</h2>
              <span className="badge badge-purple">Editable</span>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Review and edit the outline sections. Add custom writing instructions for the AI to follow during generation.</p>

            <div className="input-group" style={{ marginBottom: '24px' }}>
              <label>✍️ Custom Writing Instructions & Tone <span style={{ fontSize: '0.75rem', color: 'var(--primary-accent)', background: 'rgba(238,39,112,0.12)', padding: '2px 7px', borderRadius: '10px', marginLeft: '6px' }}>Project-Specific</span></label>
              <textarea 
                className="input" 
                placeholder="e.g. Write in a witty, conversational tone. Do not use the word 'delve'. Format lists with emojis."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                style={{ minHeight: '80px' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {outline.map((section, idx) => (
                <div key={idx} style={{ padding: '16px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <select 
                      className="input" 
                      value={section.type} 
                      onChange={(e) => updateOutlineSection(idx, 'type', e.target.value)}
                      style={{ width: '100px' }}
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
                      style={{ flex: 1, fontWeight: 'bold' }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '140px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Words:</span>
                      <input 
                        className="input" 
                        type="number" 
                        value={section.target_words}
                        onChange={(e) => updateOutlineSection(idx, 'target_words', parseInt(e.target.value))}
                        style={{ width: '80px' }}
                      />
                    </div>
                    
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => removeOutlineSection(idx)}
                      style={{ padding: '8px', color: '#EF4444', borderColor: 'transparent', background: 'rgba(239, 68, 68, 0.1)' }}
                      title="Delete Section"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <textarea 
                    className="input" 
                    placeholder="Section notes / instructions..."
                    value={section.notes}
                    onChange={(e) => updateOutlineSection(idx, 'notes', e.target.value)}
                    style={{ minHeight: '60px', fontSize: '0.9rem' }}
                  />
                </div>
              ))}
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={addOutlineSection}
              style={{ marginTop: '16px', width: '100%' }}
            >
              <Plus size={16} /> Add Section
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleNext}
            disabled={loading}
            style={{ minWidth: '150px' }}
          >
            {loading ? (
              <><Loader className="spinner" size={18} style={{ border: 'none' }} /> Processing...</>
            ) : (
              <>{step === 4 ? 'Go to Editor' : 'Next Step'} <ArrowRight size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
