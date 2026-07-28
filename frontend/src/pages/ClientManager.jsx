import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '', website_url: '', industry: '', target_audience: '', 
    tone: 'professional', brand_voice: '',
    niche_category: 'general', reference_content: '',
    banned_words: '', competitors: '', internal_urls: [], color: '#6366F1',
    author_name: '', author_credentials: '', author_bio: '', company_credentials: '', preferred_citations: ''
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
    if (client) {
      setEditingClient(client);
      setFormData({
        ...client,
        banned_words: Array.isArray(client.banned_words) ? client.banned_words.join(', ') : (client.banned_words || ''),
        competitors: Array.isArray(client.competitors) ? client.competitors.join(', ') : (client.competitors || ''),
        internal_urls: Array.isArray(client.internal_urls) 
          ? client.internal_urls.map(item => typeof item === 'string' ? { url: item, keyword: '' } : item) 
          : [],
        author_name: client.author_name || '',
        author_credentials: client.author_credentials || '',
        author_bio: client.author_bio || '',
        company_credentials: client.company_credentials || '',
        preferred_citations: Array.isArray(client.preferred_citations) ? client.preferred_citations.join(', ') : (client.preferred_citations || ''),
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '', website_url: '', industry: '', target_audience: '', 
        tone: 'professional', brand_voice: '',
        niche_category: 'general', reference_content: '',
        banned_words: '', competitors: '', internal_urls: [], color: '#6366F1',
        author_name: '', author_credentials: '', author_bio: '', company_credentials: '', preferred_citations: ''
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
      };

      if (editingClient) {
        await axios.put(`${API_URL}/clients/${editingClient.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/clients`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setIsModalOpen(false);
      fetchClients();
    } catch (err) {
      alert('Failed to save client');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/clients/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchClients();
    } catch (err) {
      alert('Failed to delete client');
    }
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
          <div key={client.id} className="card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: client.color, borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }} />
            
            <div className="flex-between" style={{ marginBottom: '16px', marginTop: '8px' }}>
              <h3 style={{ margin: 0 }}>{client.name}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => openModal(client)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(client.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, overflowY: 'auto', padding: '5vh 20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>{editingClient ? 'Edit Client' : 'New Client'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
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
                  <label>Target Audience</label>
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
                  <option value="news">News / Journalism</option>
                  <option value="education">Education</option>
                </select>
              </div>

              <div className="input-group">
                <label>Brand Voice Guidelines (Instructions for AI)</label>
                <textarea className="input" style={{ minHeight: '80px' }} placeholder="e.g. We use short sentences. We never say 'utilize'." value={formData.brand_voice} onChange={e => setFormData({...formData, brand_voice: e.target.value})} />
              </div>

              <div className="input-group">
                <label>Reference Articles / Writing Style Examples</label>
                <textarea
                  className="input"
                  style={{ minHeight: '120px' }}
                  placeholder="Paste 1–2 sample paragraphs from existing articles so the AI can match the pacing, tone, and vocabulary..."
                  value={formData.reference_content}
                  onChange={e => setFormData({...formData, reference_content: e.target.value})}
                />
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label>Banned Words (Comma separated)</label>
                  <input type="text" className="input" placeholder="e.g. utilize, leverage, synergies" value={formData.banned_words} onChange={e => setFormData({...formData, banned_words: e.target.value})} />
                </div>
                <div className="input-group">
                  <label>Competitor Brands to Avoid</label>
                  <input type="text" className="input" placeholder="e.g. HubSpot, Salesforce" value={formData.competitors} onChange={e => setFormData({...formData, competitors: e.target.value})} />
                </div>
              </div>

              <div className="input-group">
                <label>Internal URLs & Anchor Texts</label>
                {formData.internal_urls.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="https://example.com/page" 
                      value={item.url} 
                      onChange={e => {
                        const newUrls = [...formData.internal_urls];
                        newUrls[idx].url = e.target.value;
                        setFormData({...formData, internal_urls: newUrls});
                      }} 
                      style={{ flex: 1 }}
                    />
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Target Keyword(s)" 
                      value={item.keyword} 
                      onChange={e => {
                        const newUrls = [...formData.internal_urls];
                        newUrls[idx].keyword = e.target.value;
                        setFormData({...formData, internal_urls: newUrls});
                      }} 
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        const newUrls = [...formData.internal_urls];
                        newUrls.splice(idx, 1);
                        setFormData({...formData, internal_urls: newUrls});
                      }} 
                      className="btn btn-secondary" 
                      style={{ padding: '8px', color: '#EF4444', borderColor: 'transparent', background: 'rgba(239, 68, 68, 0.1)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setFormData({...formData, internal_urls: [...formData.internal_urls, { url: '', keyword: '' }]})}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  <Plus size={16} /> Add Internal URL
                </button>
              </div>

              {/* ── E-E-A-T & Authority ── */}
              <div style={{ padding: '16px', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99,102,241,0.25)', marginTop: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-accent)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏅 E-E-A-T &amp; Authority Signals
                </div>

                <div className="grid-2">
                  <div className="input-group">
                    <label>Author Name</label>
                    <input type="text" className="input" placeholder="e.g. Dr. Jane Smith" value={formData.author_name} onChange={e => setFormData({...formData, author_name: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Author Credentials / Title</label>
                    <input type="text" className="input" placeholder="e.g. MD, 15+ years in oncology" value={formData.author_credentials} onChange={e => setFormData({...formData, author_credentials: e.target.value})} />
                  </div>
                </div>

                <div className="input-group">
                  <label>Author Bio (for Author Block)</label>
                  <textarea className="input" style={{ minHeight: '70px' }} placeholder="e.g. Jane is a board-certified physician specializing in..." value={formData.author_bio} onChange={e => setFormData({...formData, author_bio: e.target.value})} />
                </div>

                <div className="input-group">
                  <label>Company Credentials &amp; Authority</label>
                  <input type="text" className="input" placeholder="e.g. Established 2010, serving 50,000+ clients, Google Partner" value={formData.company_credentials} onChange={e => setFormData({...formData, company_credentials: e.target.value})} />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Preferred Citation Sources (Comma separated)</label>
                  <input type="text" className="input" placeholder="e.g. HubSpot, Statista, Forbes, McKinsey" value={formData.preferred_citations} onChange={e => setFormData({...formData, preferred_citations: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={18} /> Save Client</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
