import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Loader, Save, X, LayoutTemplate } from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function Templates() {
  const { addToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('blog_post');
  const [instructions, setInstructions] = useState('');
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

  const handleEdit = (tpl) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setType(tpl.type);
    setInstructions(tpl.instructions || '');
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setType('blog_post');
    setInstructions('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return addToast('Template name is required', 'warning');
    
    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const payload = { name, type, instructions };

    try {
      if (editingId) {
        await axios.put(`${API_URL}/templates/${editingId}`, payload, { headers });
        addToast('Template updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/templates`, payload, { headers });
        addToast('Template created successfully', 'success');
      }
      resetForm();
      fetchTemplates();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save template', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Template deleted', 'success');
      fetchTemplates();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete template', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <Loader className="spinner" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LayoutTemplate color="var(--primary-accent)" /> 
            Prompt Templates
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage custom AI instructions for different content types.</p>
        </div>
      </div>

      <div className="grid-sidebar">
        {/* Templates List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {templates.map(tpl => (
            <div key={tpl.id} className="card" style={{ padding: '20px', borderLeft: tpl.is_default ? '4px solid var(--secondary-accent)' : '4px solid var(--primary-accent)' }}>
              <div className="flex-between" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{tpl.name}</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {tpl.is_default && <span className="badge badge-green">System Default</span>}
                  <span className="badge badge-blue">{tpl.type}</span>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {tpl.instructions}
              </p>
              
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  onClick={() => handleEdit(tpl)}
                  title="Edit template"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button 
                  className="btn btn-danger" 
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  onClick={() => handleDelete(tpl.id)}
                  disabled={tpl.is_default}
                  title={tpl.is_default ? "Cannot delete system templates" : "Delete template"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          
          {templates.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-muted)' }}>No templates found.</p>
            </div>
          )}
        </div>

        {/* Template Form */}
        <div>
          <div className="card" style={{ position: 'sticky', top: '24px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editingId ? <><Edit2 size={18} /> Edit Template</> : <><Plus size={18} /> New Template</>}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Template Name *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. Technical SEO Guide"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>Content Type *</label>
                <select 
                  className="input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                >
                  <option value="blog_post">Blog Post</option>
                  <option value="product_page">Product Page</option>
                  <option value="location_page">Location Page</option>
                  <option value="service_page">Service Page</option>
                  <option value="info_page">General Information Page</option>
                </select>
              </div>

              <div className="input-group">
                <label>AI Prompt Instructions *</label>
                <textarea 
                  className="input" 
                  placeholder="Detailed instructions for the AI on how to structure and write this type of content..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  style={{ minHeight: '150px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                  {isSubmitting ? <Loader className="spinner" size={16} /> : <><Save size={16} /> Save</>}
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
