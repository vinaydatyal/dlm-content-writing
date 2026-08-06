import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Layers, Play, Loader, Check, X, Trash2, UploadCloud, 
  FileSpreadsheet, Sparkles, ArrowRight, CheckCircle2, 
  AlertCircle, Download, RefreshCw, LayoutTemplate
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function BulkGenerator() {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [contentType, setContentType] = useState('blog_post');
  const [targetWordCount, setTargetWordCount] = useState(1500);
  const [keywordsText, setKeywordsText] = useState('');
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [bulkJobId, setBulkJobId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/clients`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClients(res.data || []);
      } catch (err) {
        console.error('Failed to fetch clients', err);
      }
    };
    fetchClients();
  }, []);

  const parseAndAddKeywords = (text) => {
    const lines = text.split(/\r?\n/).map(k => k.trim()).filter(k => k);
    if (lines.length === 0) return alert('Enter or upload at least one keyword');

    const newItems = lines.map(line => {
      let keyword = line;
      let target_url = '';
      if (line.includes(',')) {
        const parts = line.split(',');
        keyword = parts[0].trim().replace(/^["']|["']$/g, '');
        target_url = parts[1].trim().replace(/^["']|["']$/g, '');
      }
      return {
        id: Date.now() + Math.random(),
        keyword,
        target_url,
        clientId,
        contentType: target_url ? 'content_refresh' : contentType,
        targetWordCount,
        status: 'pending', // pending | processing | completed | failed
        projectId: null
      };
    });

    setQueue(prev => [...prev, ...newItems]);
    setKeywordsText('');
  };

  const addToQueue = () => {
    parseAndAddKeywords(keywordsText);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        parseAndAddKeywords(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        parseAndAddKeywords(content);
      }
    };
    reader.readAsText(file);
  };

  const removeFromQueue = (id) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    if (!confirm('Clear all items from the queue?')) return;
    setQueue([]);
  };

  useEffect(() => {
    let interval;
    if (processing || bulkJobId) {
      interval = setInterval(async () => {
        if (!clientId) return;
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_URL}/bulk/${clientId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const activeJob = res.data.find(j => j.id === bulkJobId || j.status !== 'completed');
          if (activeJob) {
            setBulkJobId(activeJob.id);
            setQueue(activeJob.items);
            setProcessing(activeJob.status !== 'completed');
          } else {
            setProcessing(false);
          }
        } catch (e) {}
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [processing, bulkJobId, clientId]);

  const processQueue = async () => {
    const pendingItems = queue.filter(q => q.status === 'pending');
    if (pendingItems.length === 0) {
      alert("No pending items in queue to process.");
      return;
    }
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/bulk`, {
        client_id: clientId || null,
        items: queue,
        name: `Bulk Pipeline (${pendingItems.length} items) - ${new Date().toLocaleTimeString()}`
      }, { headers: { Authorization: `Bearer ${token}` } });
      setBulkJobId(res.data.job_id);
    } catch(err) {
      console.error(err);
      alert('Failed to start bulk processing. Check backend logs.');
      setProcessing(false);
    }
  };

  const doneCount = queue.filter(q => q.status === 'completed' || q.status === 'done').length;
  const errorCount = queue.filter(q => q.status === 'failed' || q.status === 'error').length;
  const pendingCount = queue.filter(q => q.status === 'pending').length;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1080px', margin: '0 auto' }}>
      
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--primary-accent)', fontWeight: 600, marginBottom: '6px' }}>
            <Layers size={14} /> Batch Automation
          </div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Bulk Content Generation Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Automate SERP research, content brief creation, and full AI article drafting in mass.
          </p>
        </div>

        {queue.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={clearQueue} disabled={processing} style={{ fontSize: '0.85rem' }}>
              Clear Queue
            </button>
            <button 
              className="btn btn-primary" 
              onClick={processQueue} 
              disabled={processing || pendingCount === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 600 }}
            >
              {processing ? (
                <>
                  <Loader size={16} className="spinner" style={{ border: 'none' }} />
                  Processing Pipeline...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run Pipeline ({pendingCount} items)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Grid: Config & Input */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '28px' }}>
        
        {/* Left: Input Textarea & Batch Settings */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 16px 0', fontWeight: 700 }}>1. Configure Batch Target</h2>
          
          <div className="grid-2" style={{ marginBottom: '16px' }}>
            <div className="input-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Assign Client Profile</label>
              <select className="input" value={clientId} onChange={e => setClientId(e.target.value)} style={{ fontSize: '0.88rem' }}>
                <option value="">No Client (General Tone)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Default Content Format</label>
              <select className="input" value={contentType} onChange={e => setContentType(e.target.value)} style={{ fontSize: '0.88rem' }}>
                <option value="blog_post">Blog Post / Article</option>
                <option value="content_refresh">Content Refresh (Optimizer)</option>
                <option value="product_page">Product Page</option>
                <option value="location_page">Local SEO Landing Page</option>
                <option value="service_page">Service Page</option>
                <option value="info_page">Comprehensive Topic Pillar</option>
              </select>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Target Word Count: <span style={{ color: 'var(--primary-accent)' }}>{targetWordCount} words</span></label>
            <input 
              type="range" 
              min="800" 
              max="4000" 
              step="100" 
              value={targetWordCount} 
              onChange={(e) => setTargetWordCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary-accent)' }}
            />
          </div>

          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Keywords (one per line) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— format as: keyword, URL (optional)</span>
            </label>
            <textarea
              className="input"
              style={{ minHeight: '130px', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5' }}
              placeholder={"best project management software 2025\nhow to do SEO for ecommerce, https://example.com/seo\ntop 10 b2b marketing strategies\nsaas customer retention guide"}
              value={keywordsText}
              onChange={e => setKeywordsText(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={addToQueue} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Layers size={16} /> Add Keywords to Queue
          </button>
        </div>

        {/* Right: Drag & Drop CSV / File Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div 
            className="card"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{ 
              padding: '24px', 
              border: isDragging ? '2px dashed var(--primary-accent)' : '2px dashed var(--border-color)',
              background: isDragging ? 'var(--primary-light)' : 'var(--bg-secondary)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              minHeight: '220px'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".csv,.txt" 
              onChange={handleFileUpload} 
            />
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '50%', marginBottom: '12px', color: 'var(--primary-accent)' }}>
              <UploadCloud size={30} />
            </div>
            <h3 style={{ fontSize: '1rem', margin: '0 0 6px 0', fontWeight: 600 }}>Drop CSV or TXT File</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 14px 0', maxWidth: '280px' }}>
              Upload keyword spreadsheets (.csv or .txt) with keywords and optional URLs.
            </p>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
              Select File
            </button>
          </div>

          {/* Quick Help Box */}
          <div className="card" style={{ padding: '16px 20px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--primary-accent)', fontWeight: 600, fontSize: '0.85rem' }}>
              <Sparkles size={15} /> Automated Pipeline Workflow
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <li>Extracts live SERP data & competitor headings for each topic.</li>
              <li>Builds detailed content brief & outline.</li>
              <li>Generates full multi-section article with SEO metadata.</li>
            </ul>
          </div>

        </div>

      </div>

      {/* Queue List */}
      {queue.length > 0 ? (
        <div className="card" style={{ padding: '24px' }}>
          
          <div className="flex-between" style={{ marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Execution Queue ({queue.length} items)</h2>
              <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pending: <strong>{pendingCount}</strong></span>
                <span style={{ color: '#10B981' }}>Completed: <strong>{doneCount}</strong></span>
                {errorCount > 0 && <span style={{ color: '#EF4444' }}>Failed: <strong>{errorCount}</strong></span>}
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={processQueue} 
              disabled={processing || pendingCount === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600 }}
            >
              {processing ? (
                <>
                  <Loader size={16} className="spinner" style={{ border: 'none' }} />
                  Processing Pipeline...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Start Pipeline
                </>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map((item, idx) => (
              <div 
                key={item.id || idx} 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '14px', 
                  padding: '12px 16px',
                  background: 'var(--bg-secondary)', 
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  opacity: item.status === 'failed' ? 0.7 : 1
                }}
              >
                {/* Status Indicator */}
                <div style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                  {item.status === 'pending' && (
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--text-muted)' }} title="Pending" />
                  )}
                  {item.status === 'processing' && (
                    <Loader size={18} className="spinner" style={{ border: 'none', color: 'var(--primary-accent)' }} title="Processing..." />
                  )}
                  {(item.status === 'done' || item.status === 'completed') && (
                    <CheckCircle2 size={18} style={{ color: '#10B981' }} title="Completed" />
                  )}
                  {(item.status === 'error' || item.status === 'failed') && (
                    <AlertCircle size={18} style={{ color: '#EF4444' }} title="Failed" />
                  )}
                </div>

                {/* Keyword & Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    {item.keyword}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '10px', marginTop: '2px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{item.contentType?.replace('_', ' ') || 'Blog Post'}</span>
                    {item.target_url && <span>• Target: {item.target_url}</span>}
                    {item.clientId && <span>• Client: {clients.find(c => String(c.id) === String(item.clientId))?.name || 'Assigned'}</span>}
                  </div>
                </div>

                {/* Action button */}
                <div>
                  {(item.status === 'done' || item.status === 'completed') && item.projectId ? (
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => navigate(`/editor/${item.projectId}`)}
                    >
                      Open in Editor <ArrowRight size={13} />
                    </button>
                  ) : item.status === 'pending' ? (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '6px', color: 'var(--danger)', border: 'none' }}
                      title="Remove"
                      onClick={() => removeFromQueue(item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

        </div>
      ) : null}

    </div>
  );
}
