import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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
  
  // Form State
  const [formData, setFormData] = useState({
    name: '', website_url: '', industry: '', target_audience: '', 
    tone: 'professional', brand_voice: '',
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
    if (client) {
      setEditingClient(client);
      setFormData({
        ...client,
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
        tone: 'professional', brand_voice: '',
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
        internal_urls: formData.internal_urls.filter(item => item.url.trim() !== ''),
        preferred_citations: formData.preferred_citations.split(',').map(w => w.trim()).filter(w => w),
        products_services: formData.products_services.filter(p => p.name.trim() !== ''),
        buyer_personas: formData.buyer_personas.filter(p => p.name.trim() !== ''),
        dos_and_donts: formData.dos_and_donts.filter(d => d.bad_phrase.trim() !== ''),
        good_examples: formData.good_examples.filter(e => e.trim() !== ''),
        bad_examples: formData.bad_examples.filter(e => e.trim() !== ''),
      };

      if (editingClient) {
        await axios.put(`${API_URL}/clients/${editingClient.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        addToast('Client updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/clients`, payload, { headers: { Authorization: `Bearer ${token}` } });
        addToast('Client created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchClients();
    } catch (err) {
      addToast('Failed to save client', 'error');
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
    const formData = new FormData();
    formData.append('file', file);
    
    setIsUploading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/knowledge/${editingClient.id}/upload`, formData, {
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
      addToast(`Found ${newUrls.length} URLs. Building Semantic Graph in the background...`, 'success');
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
    if (typeof newArr[idx] === 'object') newArr[idx][field] = val;
    else newArr[idx] = val; // for simple strings
    setFormData({ ...formData, [key]: newArr });
  };
  const removeArrayItem = (key, idx) => {
    const newArr = [...formData[key]];
    newArr.splice(idx, 1);
    setFormData({ ...formData, [key]: newArr });
  };

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />;

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1>Client Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage brand voices and profiles for content generation.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Client
        </button>
      </div>

      <div className="grid-3">
        {clients.map(client => (
          <div 
            key={client.id} 
            className="card interactive" 
            style={{ position: 'relative' }}
            onClick={() => openModal(client)}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: client.color, borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }} />
            
            <div className="flex-between" style={{ marginBottom: '16px', marginTop: '8px' }}>
              <h3 style={{ margin: 0 }}>{client.name}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); openModal(client); }} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <div><strong>Website:</strong> {client.website_url || 'N/A'}</div>
              <div><strong>Industry:</strong> {client.industry || 'N/A'}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span className="badge badge-purple">{client.tone}</span>
                {client.niche_category && client.niche_category !== 'general' && (
                  <span className={`badge ${['finance','health'].includes(client.niche_category) ? 'badge-yellow' : 'badge-blue'}`}>
                    {client.niche_category === 'health' ? '⚕️ YMYL Health' : client.niche_category === 'finance' ? '💰 YMYL Finance' : client.niche_category}
                  </span>
                )}
              </div>
            </div>

            <div style={{ fontSize: '0.85rem' }}>
              <strong>Brand Voice:</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {client.brand_voice || 'Default'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div className="flex-between" style={{ padding: '24px 24px 0', marginBottom: '24px', flexShrink: 0 }}>
              <h2 style={{ margin: 0 }}>{editingClient ? 'Edit Client Profile' : 'New Client Profile'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', marginBottom: '0', overflowX: 'auto', flexShrink: 0 }}>
              <button type="button" className={`tab ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>Basic & Core</button>
              <button type="button" className={`tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>Products & Personas</button>
              <button type="button" className={`tab ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')}>Brand Voice Library</button>
              <button type="button" className={`tab ${activeTab === 'eeat' ? 'active' : ''}`} onClick={() => setActiveTab('eeat')}>EEAT & Internal</button>
              {editingClient && <button type="button" className={`tab ${activeTab === 'kb' ? 'active' : ''}`} onClick={() => setActiveTab('kb')}>📚 Knowledge Base</button>}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              
              {/* TAB 1: BASIC & CORE */}
              <div style={{ display: activeTab === 'basic' ? 'block' : 'none' }}>
                <div className="grid-2">
                  <div className="input-group">
                    <label>Client Name *</label>
                    <input type="text" className="input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Brand Color</label>
                    <input type="color" className="input" style={{ padding: '4px', height: '48px' }} value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="input-group">
                    <label>Website URL</label>
                    <input type="text" className="input" value={formData.website_url} onChange={e => setFormData({...formData, website_url: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Industry</label>
                    <input type="text" className="input" value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="input-group">
                    <label>Target Audience (Legacy)</label>
                    <input type="text" className="input" placeholder="e.g. SMB Owners in Tech" value={formData.target_audience} onChange={e => setFormData({...formData, target_audience: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Tone of Voice</label>
                    <select className="input" value={formData.tone} onChange={e => setFormData({...formData, tone: e.target.value})}>
                      <option value="professional">Professional</option>
                      <option value="conversational">Conversational</option>
                      <option value="authoritative">Authoritative</option>
                      <option value="casual">Casual & Friendly</option>
                      <option value="technical">Technical</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label>Content Niche / Risk Level</label>
                  <select className="input" value={formData.niche_category} onChange={e => setFormData({...formData, niche_category: e.target.value})}>
                    <option value="general">General</option>
                    <option value="ecommerce">E-commerce / Retail</option>
                    <option value="saas">SaaS / Technology</option>
                    <option value="finance">Finance / Legal (YMYL)</option>
                    <option value="health">Health / Medical (YMYL)</option>
                  </select>
                </div>
              </div>

              {/* TAB 2: PRODUCTS & PERSONAS */}
              <div style={{ display: activeTab === 'products' ? 'block' : 'none' }}>
                
                {/* PRODUCTS */}
                <div style={{ marginBottom: '32px' }}>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Products & Services</h3>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addArrayItem('products_services', { name: '', description: '', uvp: '' })}>
                      <Plus size={14} /> Add Product
                    </button>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Provide catalog facts so the AI mentions real products instead of generic solutions.</p>
                  
                  {formData.products_services.map((item, idx) => (
                    <div key={idx} style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                      <div className="flex-between" style={{ marginBottom: '12px' }}>
                        <strong>Product #{idx+1}</strong>
                        <button type="button" onClick={() => removeArrayItem('products_services', idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16}/></button>
                      </div>
                      <div className="input-group">
                        <label>Product Name</label>
                        <input type="text" className="input" value={item.name} onChange={e => updateArrayItem('products_services', idx, 'name', e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label>Description / Features</label>
                        <textarea className="input" style={{ minHeight: '60px' }} value={item.description} onChange={e => updateArrayItem('products_services', idx, 'description', e.target.value)} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Unique Value Proposition (UVP)</label>
                        <input type="text" className="input" value={item.uvp} onChange={e => updateArrayItem('products_services', idx, 'uvp', e.target.value)} />
                      </div>
                    </div>
                  ))}
                  {formData.products_services.length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No products added.</div>}
                </div>

                <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '32px 0' }} />

                {/* PERSONAS */}
                <div>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Buyer Personas</h3>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addArrayItem('buyer_personas', { name: '', pain_points: '', goals: '', objections: '' })}>
                      <Plus size={14} /> Add Persona
                    </button>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Help the AI write exactly to the anxieties and goals of specific buyers.</p>

                  {formData.buyer_personas.map((item, idx) => (
                    <div key={idx} style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                      <div className="flex-between" style={{ marginBottom: '12px' }}>
                        <strong>Persona #{idx+1}</strong>
                        <button type="button" onClick={() => removeArrayItem('buyer_personas', idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16}/></button>
                      </div>
                      <div className="grid-2">
                        <div className="input-group">
                          <label>Persona Name</label>
                          <input type="text" className="input" placeholder="e.g. Busy CEO Bob" value={item.name} onChange={e => updateArrayItem('buyer_personas', idx, 'name', e.target.value)} />
                        </div>
                        <div className="input-group">
                          <label>Goals</label>
                          <input type="text" className="input" placeholder="e.g. Wants to save time" value={item.goals} onChange={e => updateArrayItem('buyer_personas', idx, 'goals', e.target.value)} />
                        </div>
                      </div>
                      <div className="grid-2" style={{ marginBottom: 0 }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Pain Points</label>
                          <textarea className="input" style={{ minHeight: '60px' }} value={item.pain_points} onChange={e => updateArrayItem('buyer_personas', idx, 'pain_points', e.target.value)} />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Common Objections</label>
                          <textarea className="input" style={{ minHeight: '60px' }} value={item.objections} onChange={e => updateArrayItem('buyer_personas', idx, 'objections', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {formData.buyer_personas.length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No personas added.</div>}
                </div>
              </div>

              {/* TAB 3: BRAND VOICE LIBRARY */}
              <div style={{ display: activeTab === 'voice' ? 'block' : 'none' }}>
                <div className="input-group">
                  <label>General Brand Voice Guidelines</label>
                  <textarea className="input" style={{ minHeight: '80px' }} placeholder="e.g. We use short sentences. We are witty but professional." value={formData.brand_voice} onChange={e => setFormData({...formData, brand_voice: e.target.value})} />
                </div>
                
                <div className="grid-2">
                  <div className="input-group">
                    <label>Banned Words (Legacy - comma separated)</label>
                    <input type="text" className="input" value={formData.banned_words} onChange={e => setFormData({...formData, banned_words: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Competitor Brands to Avoid</label>
                    <input type="text" className="input" value={formData.competitors} onChange={e => setFormData({...formData, competitors: e.target.value})} />
                  </div>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '24px 0' }} />

                <div style={{ marginBottom: '24px' }}>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Do's and Don'ts Phrase Mapping</h3>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addArrayItem('dos_and_donts', { bad_phrase: '', good_phrase: '', context: '' })}>
                      <Plus size={14} /> Add Rule
                    </button>
                  </div>
                  {formData.dos_and_donts.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input type="text" className="input" placeholder="Instead of saying..." value={item.bad_phrase} onChange={e => updateArrayItem('dos_and_donts', idx, 'bad_phrase', e.target.value)} style={{ flex: 1 }} />
                      <input type="text" className="input" placeholder="Say this..." value={item.good_phrase} onChange={e => updateArrayItem('dos_and_donts', idx, 'good_phrase', e.target.value)} style={{ flex: 1 }} />
                      <input type="text" className="input" placeholder="Context (Optional)" value={item.context} onChange={e => updateArrayItem('dos_and_donts', idx, 'context', e.target.value)} style={{ flex: 1 }} />
                      <button type="button" onClick={() => removeArrayItem('dos_and_donts', idx)} className="btn btn-secondary" style={{ padding: '8px', color: '#EF4444' }}><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>

                <div className="grid-2">
                  <div>
                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1rem', margin: 0, color: '#10B981' }}>👍 Good Examples</h3>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addArrayItem('good_examples', '')}><Plus size={14}/></button>
                    </div>
                    {formData.good_examples.map((item, idx) => (
                      <div key={idx} style={{ position: 'relative', marginBottom: '8px' }}>
                        <textarea className="input" style={{ minHeight: '80px', paddingRight: '36px' }} value={item} onChange={e => updateArrayItem('good_examples', idx, null, e.target.value)} placeholder="Paste a great paragraph..." />
                        <button type="button" onClick={() => removeArrayItem('good_examples', idx)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1rem', margin: 0, color: '#EF4444' }}>👎 Bad Examples</h3>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addArrayItem('bad_examples', '')}><Plus size={14}/></button>
                    </div>
                    {formData.bad_examples.map((item, idx) => (
                      <div key={idx} style={{ position: 'relative', marginBottom: '8px' }}>
                        <textarea className="input" style={{ minHeight: '80px', paddingRight: '36px' }} value={item} onChange={e => updateArrayItem('bad_examples', idx, null, e.target.value)} placeholder="Paste a bad paragraph..." />
                        <button type="button" onClick={() => removeArrayItem('bad_examples', idx)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* TAB 4: EEAT & INTERNAL */}
              <div style={{ display: activeTab === 'eeat' ? 'block' : 'none' }}>
                <div style={{ padding: '16px', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99,102,241,0.25)', marginBottom: '24px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-accent)', marginBottom: '16px' }}>🏅 E-E-A-T &amp; Authority Signals</div>
                  <div className="grid-2">
                    <div className="input-group">
                      <label>Author Name</label>
                      <input type="text" className="input" value={formData.author_name} onChange={e => setFormData({...formData, author_name: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>Author Credentials</label>
                      <input type="text" className="input" value={formData.author_credentials} onChange={e => setFormData({...formData, author_credentials: e.target.value})} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Author Bio</label>
                    <textarea className="input" style={{ minHeight: '70px' }} value={formData.author_bio} onChange={e => setFormData({...formData, author_bio: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Company Credentials</label>
                    <input type="text" className="input" value={formData.company_credentials} onChange={e => setFormData({...formData, company_credentials: e.target.value})} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Preferred Citation Sources (Comma separated)</label>
                    <input type="text" className="input" value={formData.preferred_citations} onChange={e => setFormData({...formData, preferred_citations: e.target.value})} />
                  </div>
                </div>

                <div className="input-group">
                  <label>Internal URLs & Anchor Texts</label>
                  {editingClient && (
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="https://example.com/sitemap.xml" 
                        value={sitemapUrl} 
                        onChange={e => setSitemapUrl(e.target.value)} 
                        style={{ flex: 1 }} 
                      />
                      <button type="button" className="btn btn-secondary" onClick={handleFetchSitemap} disabled={fetchingSitemap || !sitemapUrl}>
                        {fetchingSitemap ? 'Fetching...' : 'Scrape Sitemap'}
                      </button>
                    </div>
                  )}

                  {formData.internal_urls.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input type="text" className="input" placeholder="URL" value={item.url} onChange={e => updateArrayItem('internal_urls', idx, 'url', e.target.value)} style={{ flex: 1 }} />
                      <input type="text" className="input" placeholder="Target Keyword(s)" value={item.keyword} onChange={e => updateArrayItem('internal_urls', idx, 'keyword', e.target.value)} style={{ flex: 1 }} />
                      <button type="button" onClick={() => removeArrayItem('internal_urls', idx)} className="btn btn-secondary" style={{ padding: '8px', color: '#EF4444' }}><Trash2 size={16} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary" onClick={() => addArrayItem('internal_urls', { url: '', keyword: '' })} style={{ width: '100%', marginTop: '8px' }}>
                    <Plus size={16} /> Add Internal URL
                  </button>
                </div>
              </div>

              {/* TAB 5: KNOWLEDGE BASE */}
              {editingClient && (
                <div style={{ display: activeTab === 'kb' ? 'block' : 'none' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                      Upload PDFs, text files, or markdown to create a brand knowledge base. The AI will reference these documents to pull exact facts, feature details, and context when writing.
                    </p>
                    
                    <div className="input-group">
                      <label>Upload Document (.txt, .md, .pdf)</label>
                      <input 
                        type="file" 
                        className="input" 
                        accept=".txt,.md,.pdf" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      {isUploading && <span style={{ fontSize: '0.8rem', color: 'var(--primary-accent)', marginLeft: '8px' }}>Uploading & Parsing...</span>}
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Uploaded Documents</h3>
                    {kbDocs.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                        No documents uploaded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {kbDocs.map(doc => (
                          <div key={doc.id} className="flex-between" style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                            <div>
                              <strong>{doc.title}</strong>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {Math.round(doc.size / 1024)} KB • {new Date(doc.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <button type="button" onClick={() => handleDeleteKbDoc(doc.id)} className="btn btn-secondary" style={{ padding: '8px', color: '#EF4444' }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={18} /> Save Client</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .tab { padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); cursor: pointer; font-weight: 500; font-size: 0.95rem; }
        .tab:hover { color: var(--text); }
        .tab.active { color: var(--primary-accent); border-bottom-color: var(--primary-accent); }
      `}} />
    </div>
  );
}
