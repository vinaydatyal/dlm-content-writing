import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
  Plus, Edit2, Trash2, X, Save, Sparkles, Volume2, 
  CheckCircle2, ShieldCheck, BookOpen, Layers, Play, AlertCircle, ArrowRight
} from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const BRAND_ARCHETYPES = [
  { id: 'authoritative_sage', name: 'Authoritative Sage / Industry Leader', desc: 'Data-first, academic, confident, objective (e.g. McKinsey, Gartner)' },
  { id: 'friendly_guide', name: 'Friendly Advisor / Guide', desc: 'Empathetic, clear, accessible, educational (e.g. HubSpot, Mailchimp)' },
  { id: 'visionary_innovator', name: 'Visionary Innovator', desc: 'Cutting-edge, forward-looking, ambitious, bold (e.g. Stripe, OpenAI)' },
  { id: 'challenger_disruptor', name: 'Challenger / Disruptor', desc: 'Provocative, punchy, counter-intuitive, direct (e.g. Basecamp)' },
  { id: 'technical_expert', name: 'Technical Specialist / Engineer', desc: 'Precise, developer-centric, jargon-tolerant, pragmatic (e.g. Cloudflare)' },
  { id: 'caring_partner', name: 'Caring Partner / Human-First', desc: 'Warm, collaborative, transparent, community-driven (e.g. Notion, Buffer)' }
];

const SAMPLE_PROMPTS = [
  { label: 'SEO & Organic Growth Pitch', text: 'Explain why modern B2B SaaS companies must prioritize topical authority over thin keyword spam to dominate SERPs.' },
  { label: 'Product Introduction', text: 'Introduce our enterprise software and explain why it eliminates manual busywork for marketing teams.' },
  { label: 'Debunking an Industry Myth', text: 'Explain why "keyword density" is dead and why semantic entities and search intent rule modern SEO.' },
  { label: 'Customer ROI Analysis', text: 'Break down how our automated content pipeline saves over 40 hours per month and doubles lead velocity.' }
];

export default function ClientManager() {
  const { addToast } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [kbDocs, setKbDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [fetchingSitemap, setFetchingSitemap] = useState(false);

  // Live Voice Sandbox State
  const [sandboxPrompt, setSandboxPrompt] = useState(SAMPLE_PROMPTS[0].text);
  const [sandboxOutput, setSandboxOutput] = useState('');
  const [testingVoice, setTestingVoice] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '', website_url: '', industry: '', target_audience: '', 
    tone: 'professional', brand_voice: '', brand_archetype: 'authoritative_sage',
    niche_category: 'general', reference_content: '',
    banned_words: '', competitors: '', internal_urls: [], color: '#6366F1',
    author_name: '', author_credentials: '', author_bio: '', company_credentials: '', preferred_citations: '',
    products_services: [], buyer_personas: [], dos_and_donts: [], good_examples: [], bad_examples: []
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(res.data);
    } catch (err) {
      console.error('Failed to fetch clients', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (client = null) => {
    setActiveTab('basic');
    setSandboxOutput('');
    if (client) {
      setEditingClient(client);
      setFormData({
        ...client,
        brand_archetype: client.brand_archetype || 'authoritative_sage',
        banned_words: Array.isArray(client.banned_words) ? client.banned_words.join(', ') : (client.banned_words || ''),
        competitors: Array.isArray(client.competitors) ? client.competitors.join(', ') : (client.competitors || ''),
        internal_urls: Array.isArray(client.internal_urls) ? client.internal_urls.map(item => typeof item === 'string' ? { url: item, keyword: '' } : item) : [],
        author_name: client.author_name || '',
        author_credentials: client.author_credentials || '',
        author_bio: client.author_bio || '',
        company_credentials: client.company_credentials || '',
        preferred_citations: Array.isArray(client.preferred_citations) ? client.preferred_citations.join(', ') : (client.preferred_citations || ''),
        products_services: Array.isArray(client.products_services) ? client.products_services : [],
        buyer_personas: Array.isArray(client.buyer_personas) ? client.buyer_personas : [],
        dos_and_donts: Array.isArray(client.dos_and_donts) ? client.dos_and_donts : [],
        good_examples: Array.isArray(client.good_examples) ? client.good_examples : [],
        bad_examples: Array.isArray(client.bad_examples) ? client.bad_examples : []
      });
      fetchKbDocs(client.id);
    } else {
      setEditingClient(null);
      setFormData({
        name: '', website_url: '', industry: '', target_audience: '', 
        tone: 'professional', brand_voice: '', brand_archetype: 'authoritative_sage',
        niche_category: 'general', reference_content: '',
        banned_words: '', competitors: '', internal_urls: [], color: '#6366F1',
        author_name: '', author_credentials: '', author_bio: '', company_credentials: '', preferred_citations: '',
        products_services: [], buyer_personas: [], dos_and_donts: [], good_examples: [], bad_examples: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        banned_words: formData.banned_words.split(',').map(w => w.trim()).filter(w => w),
        competitors: formData.competitors.split(',').map(w => w.trim()).filter(w => w),
        internal_urls: formData.internal_urls.filter(item => item.url && item.url.trim() !== ''),
        preferred_citations: formData.preferred_citations.split(',').map(w => w.trim()).filter(w => w),
        products_services: formData.products_services.filter(p => p.name && p.name.trim() !== ''),
        buyer_personas: formData.buyer_personas.filter(p => p.name && p.name.trim() !== ''),
        dos_and_donts: formData.dos_and_donts.filter(d => d.bad_phrase && d.bad_phrase.trim() !== ''),
        good_examples: formData.good_examples.filter(e => e && e.trim() !== ''),
        bad_examples: formData.bad_examples.filter(e => e && e.trim() !== ''),
      };

      if (editingClient) {
        await axios.put(`${API_URL}/clients/${editingClient.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        addToast('Client profile updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/clients`, payload, { headers: { Authorization: `Bearer ${token}` } });
        addToast('Client created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchClients();
    } catch (err) {
      addToast('Failed to save client profile', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/clients/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      addToast('Client deleted', 'success');
      fetchClients();
    } catch (err) {
      addToast('Failed to delete client', 'error');
    }
  };

  // Run Live Voice Sandbox Test
  const handleTestVoice = async () => {
    if (!sandboxPrompt.trim()) {
      addToast('Please enter a test topic', 'error');
      return;
    }
    setTestingVoice(true);
    setSandboxOutput('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/clients/test-voice`, {
        name: formData.name,
        industry: formData.industry,
        tone: formData.tone,
        brand_voice: formData.brand_voice,
        brand_archetype: formData.brand_archetype,
        target_audience: formData.target_audience,
        banned_words: formData.banned_words.split(',').map(w => w.trim()).filter(w => w),
        sample_prompt: sandboxPrompt
      }, { headers: { Authorization: `Bearer ${token}` } });

      setSandboxOutput(res.data.sample_output || 'No output generated.');
      addToast('Voice sample generated!', 'success');
    } catch (err) {
      addToast('Failed to run voice test: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setTestingVoice(false);
    }
  };

  const fetchKbDocs = async (clientId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/knowledge/${clientId}`, { headers: { Authorization: `Bearer ${token}` } });
      setKbDocs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0 || !editingClient) return;
    const file = e.target.files[0];
    const uploadData = new FormData();
    uploadData.append('file', file);
    
    setIsUploading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/knowledge/${editingClient.id}/upload`, uploadData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      addToast('Document added to Knowledge Base', 'success');
      fetchKbDocs(editingClient.id);
    } catch (err) {
      addToast('Failed to upload document', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteKbDoc = async (docId) => {
    if (!confirm('Delete this document from the Knowledge Base?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/knowledge/${docId}`, { headers: { Authorization: `Bearer ${token}` } });
      addToast('Document deleted', 'success');
      fetchKbDocs(editingClient.id);
    } catch (err) {
      addToast('Failed to delete document', 'error');
    }
  };

  const handleFetchSitemap = async () => {
    if (!sitemapUrl || !editingClient) {
      addToast('Please enter a sitemap URL and ensure client is saved first.', 'error');
      return;
    }
    setFetchingSitemap(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/clients/${editingClient.id}/sitemap`, { sitemap_url: sitemapUrl }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const newUrls = res.data.urls || [];
      const formatted = newUrls.map(u => ({ url: u, keyword: '' }));
      setFormData(prev => ({
        ...prev,
        internal_urls: [...prev.internal_urls, ...formatted]
      }));
      addToast(`Found ${newUrls.length} URLs. Semantic Graph building in background.`, 'success');
      setSitemapUrl('');
    } catch (err) {
      addToast('Failed to fetch sitemap', 'error');
    } finally {
      setFetchingSitemap(false);
    }
  };

  // Helper for dynamic arrays
  const addArrayItem = (key, item) => setFormData({ ...formData, [key]: [...formData[key], item] });
  const updateArrayItem = (key, idx, field, val) => {
    const newArr = [...formData[key]];
    if (typeof newArr[idx] === 'object' && field) newArr[idx][field] = val;
    else newArr[idx] = val;
    setFormData({ ...formData, [key]: newArr });
  };
  const removeArrayItem = (key, idx) => {
    const newArr = [...formData[key]];
    newArr.splice(idx, 1);
    setFormData({ ...formData, [key]: newArr });
  };

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--primary-accent)', fontWeight: 600, marginBottom: '6px' }}>
            <Volume2 size={14} /> Brand Voice &amp; E-E-A-T Studio
          </div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Client Brand Knowledge &amp; Voice Profiles</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Configure authoritative brand archetypes, custom tone rules, E-E-A-T signals, and test with live AI generation.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={18} /> New Client Profile
        </button>
      </div>

      {/* Client Cards Grid */}
      <div className="grid-3">
        {clients.map(client => {
          const archetypeObj = BRAND_ARCHETYPES.find(a => a.id === client.brand_archetype);
          return (
            <div 
              key={client.id} 
              className="card" 
              style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              onClick={() => openModal(client)}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', background: client.color || '#6366F1', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }} />
              
              <div>
                <div className="flex-between" style={{ marginBottom: '12px', marginTop: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{client.name}</h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); openModal(client); }} 
                      className="btn btn-secondary" 
                      style={{ padding: '6px', border: 'none' }}
                      title="Edit Profile"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} 
                      className="btn btn-secondary" 
                      style={{ padding: '6px', color: '#EF4444', border: 'none' }}
                      title="Delete Client"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Industry:</strong> {client.industry || 'General'}</div>
                  <div><strong>Audience:</strong> {client.target_audience || 'All buyers'}</div>
                  {client.author_name && (
                    <div style={{ color: 'var(--primary-accent)', fontWeight: 600 }}>
                      🏅 E-E-A-T Author: {client.author_name}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>
                    {client.tone || 'Professional'}
                  </span>
                  {archetypeObj && (
                    <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>
                      {archetypeObj.name.split('/')[0]}
                    </span>
                  )}
                  {client.niche_category && client.niche_category !== 'general' && (
                    <span className={`badge ${['finance','health'].includes(client.niche_category) ? 'badge-yellow' : 'badge-blue'}`}>
                      {client.niche_category === 'health' ? '⚕️ Health' : client.niche_category === 'finance' ? '💰 Finance' : client.niche_category}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', minHeight: '44px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Guidelines: </span>
                  {client.brand_voice ? (client.brand_voice.length > 85 ? client.brand_voice.slice(0, 85) + '...' : client.brand_voice) : 'Default standard guidelines.'}
                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {client.internal_urls?.length || 0} Links • {client.products_services?.length || 0} Products
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Open Studio <ArrowRight size={13} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Full Brand Voice & EEAT Studio */}
      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '880px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div className="flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                  {editingClient ? `Brand Studio: ${editingClient.name}` : 'Create Client Brand Profile'}
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Tailor AI persona, tone rules, E-E-A-T credentials, and test outputs in real time.
                </span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {/* TAB BAR */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px', overflowX: 'auto', flexShrink: 0, gap: '4px' }}>
              <button type="button" className={`tab ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>Identity &amp; Industry</button>
              <button type="button" className={`tab ${activeTab === 'archetype' ? 'active' : ''}`} onClick={() => setActiveTab('archetype')}>Archetype &amp; Voice</button>
              <button type="button" className={`tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>Products &amp; Personas</button>
              <button type="button" className={`tab ${activeTab === 'eeat' ? 'active' : ''}`} onClick={() => setActiveTab('eeat')}>E-E-A-T &amp; Citations</button>
              <button type="button" className={`tab ${activeTab === 'sandbox' ? 'active' : ''}`} onClick={() => setActiveTab('sandbox')} style={{ color: 'var(--primary-accent)', fontWeight: 700 }}>
                <Sparkles size={14} style={{ display: 'inline', marginRight: '4px' }} /> Live Voice Sandbox
              </button>
              {editingClient && <button type="button" className={`tab ${activeTab === 'kb' ? 'active' : ''}`} onClick={() => setActiveTab('kb')}>📚 Knowledge Base</button>}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              
              {/* TAB 1: BASIC & IDENTITY */}
              <div style={{ display: activeTab === 'basic' ? 'block' : 'none' }}>
                <div className="grid-2" style={{ marginBottom: '16px' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Client Name *</label>
                    <input type="text" className="input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Apex Security Inc." />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Brand Accent Color</label>
                    <input type="color" className="input" style={{ padding: '4px', height: '42px' }} value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom: '16px' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Website URL</label>
                    <input type="url" className="input" value={formData.website_url} onChange={e => setFormData({...formData, website_url: e.target.value})} placeholder="https://apexsecurity.com" />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Industry / Sector</label>
                    <input type="text" className="input" value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} placeholder="e.g. Cloud Infrastructure Security" />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Target Audience Description</label>
                  <input type="text" className="input" value={formData.target_audience} onChange={e => setFormData({...formData, target_audience: e.target.value})} placeholder="e.g. CISOs, DevOps Engineers, and Enterprise IT Directors" />
                </div>

                <div className="grid-2" style={{ marginBottom: '16px' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Regulatory / YMYL Category</label>
                    <select className="input" value={formData.niche_category} onChange={e => setFormData({...formData, niche_category: e.target.value})}>
                      <option value="general">Standard Business (General)</option>
                      <option value="finance">💰 YMYL Finance &amp; Legal (Mandatory Hedging)</option>
                      <option value="health">⚕️ YMYL Health &amp; Wellness (Medical Disclaimer)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Baseline Tone</label>
                    <select className="input" value={formData.tone} onChange={e => setFormData({...formData, tone: e.target.value})}>
                      <option value="professional">Professional &amp; Authoritative</option>
                      <option value="conversational">Conversational &amp; Accessible</option>
                      <option value="persuasive">High-Impact &amp; Persuasive</option>
                      <option value="technical">In-Depth &amp; Technical</option>
                      <option value="friendly">Friendly &amp; Warm</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reference Sample Writing Style (AI Mimics Pacing &amp; Rhythm)</label>
                  <textarea className="input" style={{ minHeight: '90px', fontSize: '0.85rem' }} placeholder="Paste a 200-word paragraph that captures this brand's exact cadence and vocabulary..." value={formData.reference_content} onChange={e => setFormData({...formData, reference_content: e.target.value})} />
                </div>
              </div>

              {/* TAB 2: ARCHETYPE & VOICE RULES */}
              <div style={{ display: activeTab === 'archetype' ? 'block' : 'none' }}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                    Select Brand Voice Archetype
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {BRAND_ARCHETYPES.map(arch => {
                      const isSelected = formData.brand_archetype === arch.id;
                      return (
                        <div 
                          key={arch.id}
                          onClick={() => setFormData({ ...formData, brand_archetype: arch.id })}
                          style={{
                            padding: '12px 14px',
                            background: isSelected ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)',
                            border: `1.5px solid ${isSelected ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '0.85rem', color: isSelected ? 'var(--primary-accent)' : 'var(--text-main)' }}>
                              {arch.name}
                            </strong>
                            {isSelected && <CheckCircle2 size={15} style={{ color: 'var(--primary-accent)' }} />}
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                            {arch.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Custom Brand Voice Guidelines</label>
                  <textarea className="input" style={{ minHeight: '80px', fontSize: '0.85rem' }} placeholder="e.g. Speak with punchy, short sentences. Avoid corporate fluff. Use active verbs and practical benchmarks." value={formData.brand_voice} onChange={e => setFormData({...formData, brand_voice: e.target.value})} />
                </div>
                
                <div className="grid-2" style={{ marginBottom: '20px' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Strictly Banned Words / Clichés (Comma separated)</label>
                    <input type="text" className="input" value={formData.banned_words} onChange={e => setFormData({...formData, banned_words: e.target.value})} placeholder="e.g. dive deep, vital, tapestry, game-changer, seamless" />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Competitor Brands to Avoid Mentioning</label>
                    <input type="text" className="input" value={formData.competitors} onChange={e => setFormData({...formData, competitors: e.target.value})} placeholder="e.g. CompetitorA, CompetitorB" />
                  </div>
                </div>

                {/* DO'S AND DON'TS PHRASE MAPPINGS */}
                <div>
                  <div className="flex-between" style={{ marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '0.92rem', margin: 0, fontWeight: 700 }}>Do's and Don'ts Phrase Dictionary</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => addArrayItem('dos_and_donts', { bad_phrase: '', good_phrase: '', context: '' })}>
                      <Plus size={14} /> Add Rule
                    </button>
                  </div>
                  {formData.dos_and_donts.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input type="text" className="input" placeholder="Instead of saying (e.g. cheap)..." value={item.bad_phrase} onChange={e => updateArrayItem('dos_and_donts', idx, 'bad_phrase', e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                      <input type="text" className="input" placeholder="Say this (e.g. cost-efficient)..." value={item.good_phrase} onChange={e => updateArrayItem('dos_and_donts', idx, 'good_phrase', e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                      <input type="text" className="input" placeholder="Context / Reason..." value={item.context} onChange={e => updateArrayItem('dos_and_donts', idx, 'context', e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                      <button type="button" onClick={() => removeArrayItem('dos_and_donts', idx)} className="btn btn-secondary" style={{ padding: '6px 8px', color: '#EF4444' }}><Trash2 size={14}/></button>
                    </div>
                  ))}
                  {formData.dos_and_donts.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No phrase mapping rules defined.</div>}
                </div>
              </div>

              {/* TAB 3: PRODUCTS & PERSONAS */}
              <div style={{ display: activeTab === 'products' ? 'block' : 'none' }}>
                <div style={{ marginBottom: '24px' }}>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700 }}>Specific Products &amp; Services</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => addArrayItem('products_services', { name: '', description: '', uvp: '' })}>
                      <Plus size={14} /> Add Product
                    </button>
                  </div>
                  {formData.products_services.map((item, idx) => (
                    <div key={idx} style={{ padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '10px' }}>
                      <div className="flex-between" style={{ marginBottom: '8px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>Product #{idx+1}</strong>
                        <button type="button" onClick={() => removeArrayItem('products_services', idx)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                      </div>
                      <div className="grid-2" style={{ marginBottom: '8px' }}>
                        <input type="text" className="input" placeholder="Product / Feature Name" value={item.name} onChange={e => updateArrayItem('products_services', idx, 'name', e.target.value)} style={{ fontSize: '0.82rem' }} />
                        <input type="text" className="input" placeholder="Unique Value Proposition (UVP)" value={item.uvp} onChange={e => updateArrayItem('products_services', idx, 'uvp', e.target.value)} style={{ fontSize: '0.82rem' }} />
                      </div>
                      <textarea className="input" placeholder="Short description of what it does..." value={item.description} onChange={e => updateArrayItem('products_services', idx, 'description', e.target.value)} style={{ minHeight: '50px', fontSize: '0.82rem' }} />
                    </div>
                  ))}
                  {formData.products_services.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No products listed.</div>}
                </div>

                <div>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700 }}>Target Buyer Personas</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => addArrayItem('buyer_personas', { name: '', pain_points: '', goals: '', objections: '' })}>
                      <Plus size={14} /> Add Persona
                    </button>
                  </div>
                  {formData.buyer_personas.map((item, idx) => (
                    <div key={idx} style={{ padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '10px' }}>
                      <div className="flex-between" style={{ marginBottom: '8px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>Persona #{idx+1}</strong>
                        <button type="button" onClick={() => removeArrayItem('buyer_personas', idx)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                      </div>
                      <div className="grid-2" style={{ marginBottom: '8px' }}>
                        <input type="text" className="input" placeholder="Persona Name (e.g. VP of Security Dave)" value={item.name} onChange={e => updateArrayItem('buyer_personas', idx, 'name', e.target.value)} style={{ fontSize: '0.82rem' }} />
                        <input type="text" className="input" placeholder="Key Goals (e.g. Automate SOC2 compliance)" value={item.goals} onChange={e => updateArrayItem('buyer_personas', idx, 'goals', e.target.value)} style={{ fontSize: '0.82rem' }} />
                      </div>
                      <div className="grid-2">
                        <textarea className="input" placeholder="Top Pain Points..." value={item.pain_points} onChange={e => updateArrayItem('buyer_personas', idx, 'pain_points', e.target.value)} style={{ minHeight: '50px', fontSize: '0.82rem' }} />
                        <textarea className="input" placeholder="Common Objections..." value={item.objections} onChange={e => updateArrayItem('buyer_personas', idx, 'objections', e.target.value)} style={{ minHeight: '50px', fontSize: '0.82rem' }} />
                      </div>
                    </div>
                  ))}
                  {formData.buyer_personas.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No personas listed.</div>}
                </div>
              </div>

              {/* TAB 4: E-E-A-T & CITATIONS */}
              <div style={{ display: activeTab === 'eeat' ? 'block' : 'none' }}>
                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', padding: '14px', borderRadius: '8px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-accent)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>
                    <ShieldCheck size={18} /> Google E-E-A-T &amp; Experience Signals
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    The AI weaves these author credentials, first-hand experience citations, and company authority benchmarks directly into every article generated.
                  </p>
                </div>

                <div className="grid-2" style={{ marginBottom: '14px' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Default Author Byline</label>
                    <input type="text" className="input" value={formData.author_name} onChange={e => setFormData({...formData, author_name: e.target.value})} placeholder="e.g. Dr. Alex Mercer, CISSP" />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Author Credentials / Title</label>
                    <input type="text" className="input" value={formData.author_credentials} onChange={e => setFormData({...formData, author_credentials: e.target.value})} placeholder="e.g. 15+ years Head of Cybersecurity" />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Author Short Bio / Experience Blurb</label>
                  <textarea className="input" style={{ minHeight: '60px', fontSize: '0.82rem' }} placeholder="Alex Mercer is a veteran security architect who has consulted for Fortune 500 enterprises..." value={formData.author_bio} onChange={e => setFormData({...formData, author_bio: e.target.value})} />
                </div>

                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Company Authority &amp; Certifications</label>
                  <input type="text" className="input" value={formData.company_credentials} onChange={e => setFormData({...formData, company_credentials: e.target.value})} placeholder="e.g. ISO-27001 Certified, Protected 2M+ Endpoints, Gartner Leader" />
                </div>

                <div className="input-group" style={{ marginBottom: '18px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Preferred Citation Sources (Comma separated)</label>
                  <input type="text" className="input" value={formData.preferred_citations} onChange={e => setFormData({...formData, preferred_citations: e.target.value})} placeholder="e.g. Gartner, Statista, IBM Security Report, IEEE, McKinsey" />
                </div>

                {/* SITEMAP & INTERNAL URLS */}
                <div>
                  <div className="flex-between" style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Internal Links for Semantic Anchor Insertion</label>
                  </div>

                  {editingClient && (
                    <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="https://example.com/sitemap.xml" 
                        value={sitemapUrl} 
                        onChange={e => setSitemapUrl(e.target.value)} 
                        style={{ flex: 1, fontSize: '0.85rem' }} 
                      />
                      <button type="button" className="btn btn-secondary" onClick={handleFetchSitemap} disabled={fetchingSitemap || !sitemapUrl} style={{ fontSize: '0.82rem' }}>
                        {fetchingSitemap ? 'Fetching...' : 'Scrape Sitemap'}
                      </button>
                    </div>
                  )}

                  {formData.internal_urls.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input type="text" className="input" placeholder="Target URL" value={item.url} onChange={e => updateArrayItem('internal_urls', idx, 'url', e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                      <input type="text" className="input" placeholder="Primary Anchor Keyword" value={item.keyword} onChange={e => updateArrayItem('internal_urls', idx, 'keyword', e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                      <button type="button" onClick={() => removeArrayItem('internal_urls', idx)} className="btn btn-secondary" style={{ padding: '6px 8px', color: '#EF4444' }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary" onClick={() => addArrayItem('internal_urls', { url: '', keyword: '' })} style={{ width: '100%', marginTop: '6px', fontSize: '0.82rem' }}>
                    <Plus size={14} /> Add Internal URL
                  </button>
                </div>
              </div>

              {/* TAB 5: LIVE VOICE SANDBOX */}
              <div style={{ display: activeTab === 'sandbox' ? 'block' : 'none' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={16} /> Live Voice Sandboxing
                    </h4>
                    <span style={{ fontSize: '0.75rem', background: 'var(--bg)', padding: '3px 8px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      Active: {BRAND_ARCHETYPES.find(a => a.id === formData.brand_archetype)?.name.split('/')[0] || 'Default'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Test how the AI speaks with your configured Tone ({formData.tone}), Archetype, and Banned Words before publishing full articles.
                  </p>
                </div>

                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <div className="flex-between" style={{ marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Test Prompt / Topic</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {SAMPLE_PROMPTS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSandboxPrompt(p.text)}
                          style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
                            color: 'var(--text-muted)'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea 
                    className="input" 
                    style={{ minHeight: '70px', fontSize: '0.85rem' }} 
                    value={sandboxPrompt}
                    onChange={e => setSandboxPrompt(e.target.value)}
                    placeholder="Type any test topic or prompt..."
                  />
                </div>

                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleTestVoice} 
                  disabled={testingVoice}
                  style={{ width: '100%', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  {testingVoice ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Generating Voice Sample...</> : <><Play size={16} /> Run Voice Test</>}
                </button>

                {sandboxOutput && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                    <div className="flex-between" style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-accent)' }}>
                        AI Generated Voice Output
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Tone: {formData.tone}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-main)', whiteSpace: 'pre-line' }}>
                      {sandboxOutput}
                    </div>
                  </div>
                )}
              </div>

              {/* TAB 6: KNOWLEDGE BASE */}
              {editingClient && (
                <div style={{ display: activeTab === 'kb' ? 'block' : 'none' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}>
                      Upload PDFs, text files, or markdown to create a brand knowledge base. The AI will reference these documents to pull exact facts and feature details.
                    </p>
                    
                    <div className="input-group">
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Upload Document (.txt, .md, .pdf)</label>
                      <input 
                        type="file" 
                        className="input" 
                        accept=".txt,.md,.pdf" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      {isUploading && <span style={{ fontSize: '0.8rem', color: 'var(--primary-accent)', marginLeft: '8px' }}>Uploading &amp; Parsing...</span>}
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', fontWeight: 700 }}>Uploaded Knowledge Documents</h4>
                    {kbDocs.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        No documents uploaded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {kbDocs.map(doc => (
                          <div key={doc.id} className="flex-between" style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '0.88rem' }}>{doc.title}</strong>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {Math.round(doc.size / 1024)} KB • {new Date(doc.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <button type="button" onClick={() => handleDeleteKbDoc(doc.id)} className="btn btn-secondary" style={{ padding: '6px', color: '#EF4444' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg)', flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Save size={16} /> Save Client Profile
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .tab { padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); cursor: pointer; font-weight: 600; font-size: 0.85rem; }
        .tab:hover { color: var(--text-main); }
        .tab.active { color: var(--primary-accent); border-bottom-color: var(--primary-accent); }
      `}} />
    </div>
  );
}
