import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Layers, Play, Loader, Check, X, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function BulkGenerator() {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [contentType, setContentType] = useState('blog_post');
  const [keywordsText, setKeywordsText] = useState('');
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

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

  const addToQueue = () => {
    const keywords = keywordsText.split('\n').map(k => k.trim()).filter(k => k);
    if (keywords.length === 0) return alert('Enter at least one keyword');

    const newItems = keywords.map(kw => ({
      id: Date.now() + Math.random(),
      keyword: kw,
      clientId,
      contentType,
      status: 'pending', // pending | processing | done | error
      projectId: null
    }));

    setQueue(prev => [...prev, ...newItems]);
    setKeywordsText('');
  };

  const removeFromQueue = (id) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const processQueue = async () => {
    setProcessing(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status !== 'pending') continue;

      // Mark as processing
      setQueue(prev => prev.map((q, idx) => q.id === item.id ? { ...q, status: 'processing' } : q));

      try {
        // 1. Create project
        const projRes = await axios.post(`${API_URL}/projects`, {
          keyword: item.keyword,
          title: '',
          client_id: item.clientId || null,
          content_type: item.contentType
        }, { headers });

        // 2. Fetch SERP
        const serpRes = await axios.post(`${API_URL}/serp/analyze`, { keyword: item.keyword }, { headers });
        await axios.put(`${API_URL}/projects/${projRes.data.id}/article`, {
          serp_data: JSON.stringify(serpRes.data)
        }, { headers });

        // 3. Generate Brief
        const clientProfile = clients.find(c => c.id.toString() === item.clientId);
        const briefRes = await axios.post(`${API_URL}/content/brief`, {
          keyword: item.keyword,
          serp_data: serpRes.data,
          content_type: item.contentType,
          client_profile: clientProfile
        }, { headers });

        await axios.put(`${API_URL}/projects/${projRes.data.id}/article`, {
          brief: briefRes.data.brief,
          status: 'brief'
        }, { headers });

        // 4. Generate Outline
        const outlineRes = await axios.post(`${API_URL}/content/outline`, {
          keyword: item.keyword,
          brief: briefRes.data.brief,
          content_type: item.contentType,
          serp_data: serpRes.data
        }, { headers });

        await axios.put(`${API_URL}/projects/${projRes.data.id}/article`, {
          outline: outlineRes.data.outline,
          status: 'outline'
        }, { headers });

        // Mark as done — article is ready to be written in the editor
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done', projectId: projRes.data.id } : q));

      } catch (err) {
        console.error(`Bulk error for "${item.keyword}":`, err);
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
      }
    }

    setProcessing(false);
  };

  const doneCount = queue.filter(q => q.status === 'done').length;
  const errorCount = queue.filter(q => q.status === 'error').length;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1>Bulk Content Generation</h1>
          <p style={{ color: 'var(--text-muted)' }}>Queue multiple keywords for batch research & outline generation.</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Add Keywords to Queue</h2>
        <div className="grid-2">
          <div className="input-group">
            <label>Client Profile</label>
            <select className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">No Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Content Type</label>
            <select className="input" value={contentType} onChange={e => setContentType(e.target.value)}>
              <option value="blog_post">Blog Post</option>
              <option value="product_page">Product Page</option>
              <option value="location_page">Location Page</option>
              <option value="service_page">Service Page</option>
              <option value="info_page">General Information Page</option>
            </select>
          </div>
        </div>
        <div className="input-group">
          <label>Keywords (one per line)</label>
          <textarea
            className="input"
            style={{ minHeight: '120px', fontFamily: 'monospace' }}
            placeholder={"best project management software\nhow to start a blog in 2025\ntop 10 SEO tools for beginners"}
            value={keywordsText}
            onChange={e => setKeywordsText(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={addToQueue} style={{ width: '100%' }}>
          <Layers size={16} /> Add to Queue
        </button>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Queue ({queue.length} items)</h2>
            <button 
              className="btn btn-primary" 
              onClick={processQueue} 
              disabled={processing || queue.filter(q => q.status === 'pending').length === 0}
            >
              {processing ? <><Loader size={16} className="spinner" style={{ border: 'none' }} /> Processing...</> : <><Play size={16} /> Start Processing</>}
            </button>
          </div>

          {doneCount > 0 && (
            <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '0.85rem', color: '#10B981' }}>
              ✅ {doneCount} article(s) ready — outlines generated, click to start writing!
            </div>
          )}
          {errorCount > 0 && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '0.85rem', color: '#EF4444' }}>
              ❌ {errorCount} article(s) failed. You can retry by re-adding them.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                opacity: item.status === 'error' ? 0.6 : 1
              }}>
                {/* Status icon */}
                <div style={{ width: '24px', textAlign: 'center' }}>
                  {item.status === 'pending' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--text-muted)', margin: '0 auto' }} />}
                  {item.status === 'processing' && <Loader size={16} className="spinner" style={{ border: 'none', color: 'var(--primary-accent)' }} />}
                  {item.status === 'done' && <Check size={16} style={{ color: '#10B981' }} />}
                  {item.status === 'error' && <X size={16} style={{ color: '#EF4444' }} />}
                </div>

                {/* Keyword */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.keyword}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.contentType.replace('_', ' ')} {item.clientId ? `• ${clients.find(c => c.id.toString() === item.clientId)?.name || ''}` : ''}
                  </div>
                </div>

                {/* Actions */}
                {item.status === 'done' && item.projectId && (
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => navigate(`/editor/${item.projectId}`)}>
                    Write →
                  </button>
                )}
                {item.status === 'pending' && (
                  <button className="btn btn-secondary" style={{ padding: '6px', color: '#EF4444', borderColor: 'transparent' }} onClick={() => removeFromQueue(item.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
