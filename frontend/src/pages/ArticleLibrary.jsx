import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Search, Download, Edit2, Trash2, Copy, Filter, 
  LayoutGrid, List, FileText, ExternalLink, Sparkles, 
  Plus, CheckCircle2, Clock, Layers, ArrowUpDown, ChevronDown, Check
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ArticleLibrary() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [copiedId, setCopiedId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [projRes, clientRes] = await Promise.all([
        axios.get(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/clients`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
      ]);
      setProjects(projRes.data || []);
      setClients(clientRes.data || []);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, keyword) => {
    if (!confirm(`Are you sure you want to delete "${keyword}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      setDuplicatingId(id);
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/projects/${id}/duplicate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      alert('Failed to duplicate project');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDownloadMarkdown = async (project) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/projects/${project.id}/article`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const article = res.data;
      const content = article?.content || `# ${project.keyword}\n\nNo content written yet.`;
      
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.keyword.toLowerCase().replace(/[^a-z0-9]/g, '_')}_article.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download markdown');
    }
  };

  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => {
        const matchesSearch = 
          (p.keyword && p.keyword.toLowerCase().includes(search.toLowerCase())) ||
          (p.client_name && p.client_name.toLowerCase().includes(search.toLowerCase())) ||
          (p.meta_title && p.meta_title.toLowerCase().includes(search.toLowerCase())) ||
          (p.content_type && p.content_type.toLowerCase().includes(search.toLowerCase()));

        const matchesClient = selectedClient === 'all' || String(p.client_id) === String(selectedClient);
        const matchesType = selectedType === 'all' || p.content_type === selectedType;
        const currentStatus = p.article_status || p.status || 'draft';
        const matchesStatus = selectedStatus === 'all' || currentStatus === selectedStatus;

        return matchesSearch && matchesClient && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
        if (sortBy === 'words_high') return (b.word_count || 0) - (a.word_count || 0);
        if (sortBy === 'words_low') return (a.word_count || 0) - (b.word_count || 0);
        if (sortBy === 'alphabetical') return a.keyword.localeCompare(b.keyword);
        return 0;
      });
  }, [projects, search, selectedClient, selectedType, selectedStatus, sortBy]);

  const typeLabels = {
    blog_post: 'Blog Post',
    content_refresh: 'Content Refresh',
    product_page: 'Product Page',
    location_page: 'Local SEO Page',
    service_page: 'Service Page',
    info_page: 'Topic Pillar'
  };

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
        <div className="spinner" style={{ borderColor: 'var(--primary-accent)', borderTopColor: 'transparent', width: '40px', height: '40px' }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--primary-accent)', fontWeight: 600, marginBottom: '6px' }}>
            <FileText size={14} /> Repository
          </div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Content Library</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Manage, filter, export, and edit all SEO articles across your client roster.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/new')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> New Article
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card" style={{ marginBottom: '24px', padding: '18px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', gap: '12px', alignItems: 'center' }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input" 
              placeholder="Search keyword, client, title, type..." 
              style={{ paddingLeft: '38px', fontSize: '0.88rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Client Filter */}
          <select 
            className="input" 
            style={{ width: '150px', fontSize: '0.85rem', padding: '8px 12px' }}
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="all">All Clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Content Type Filter */}
          <select 
            className="input" 
            style={{ width: '160px', fontSize: '0.85rem', padding: '8px 12px' }}
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="all">All Content Types</option>
            <option value="blog_post">Blog Post</option>
            <option value="content_refresh">Content Refresh</option>
            <option value="product_page">Product Page</option>
            <option value="location_page">Local SEO Page</option>
            <option value="service_page">Service Page</option>
            <option value="info_page">Topic Pillar</option>
          </select>

          {/* Status Filter */}
          <select 
            className="input" 
            style={{ width: '140px', fontSize: '0.85rem', padding: '8px 12px' }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="brief">Briefing</option>
            <option value="outline">Outlining</option>
            <option value="draft">Drafting</option>
            <option value="review">In Review</option>
            <option value="completed">Completed</option>
          </select>

          {/* Sort By */}
          <select 
            className="input" 
            style={{ width: '140px', fontSize: '0.85rem', padding: '8px 12px' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="words_high">Words: High → Low</option>
            <option value="words_low">Words: Low → High</option>
            <option value="alphabetical">Keyword: A → Z</option>
          </select>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? 'var(--primary-accent)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Table View"
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'var(--primary-accent)' : 'transparent',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Grid Card View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

        </div>

        {/* Results Counter */}
        <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Showing <strong>{filteredProjects.length}</strong> of {projects.length} articles</span>
          {(search || selectedClient !== 'all' || selectedType !== 'all' || selectedStatus !== 'all') && (
            <button 
              onClick={() => { setSearch(''); setSelectedClient('all'); setSelectedType('all'); setSelectedStatus('all'); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Content Display: Table Mode vs Grid Mode */}
      {viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Target Keyword / Title</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Client Brand</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Words</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
                filteredProjects.map(project => {
                  const status = project.article_status || project.status || 'draft';
                  return (
                    <tr 
                      key={project.id} 
                      className="table-row-interactive"
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                      onClick={() => navigate(`/editor/${project.id}`)}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{project.keyword}</span>
                          {project.meta_title && project.meta_title !== project.keyword && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                              {project.meta_title}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className="badge" style={{ 
                          backgroundColor: project.client_color ? `${project.client_color}22` : 'var(--primary-light)', 
                          color: project.client_color || 'var(--primary-accent)',
                          fontWeight: 600
                        }}>
                          {project.client_name || 'General'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                        {typeLabels[project.content_type] || (project.content_type ? project.content_type.replace('_', ' ') : 'Blog Post')}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                        {project.word_count ? `${project.word_count.toLocaleString()} w` : '-'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className={`badge ${status === 'completed' ? 'badge-green' : 'badge-yellow'}`} style={{ textTransform: 'capitalize' }}>
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {new Date(project.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 8px' }}
                            title="Download Markdown"
                            onClick={() => handleDownloadMarkdown(project)}
                          >
                            <Download size={15} />
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 8px' }}
                            title="Duplicate Project"
                            disabled={duplicatingId === project.id}
                            onClick={() => handleDuplicate(project.id)}
                          >
                            <Copy size={15} />
                          </button>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            title="Open Editor"
                            onClick={() => navigate(`/editor/${project.id}`)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 8px', color: 'var(--danger)' }}
                            title="Delete"
                            onClick={() => handleDelete(project.id, project.keyword)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No matching articles found in library.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID CARD VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {filteredProjects.length > 0 ? (
            filteredProjects.map(project => {
              const status = project.article_status || project.status || 'draft';
              return (
                <div 
                  key={project.id} 
                  className="card interactive"
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px' }}
                  onClick={() => navigate(`/editor/${project.id}`)}
                >
                  <div>
                    {/* Header: Client & Status */}
                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                      <span className="badge" style={{ 
                        backgroundColor: project.client_color ? `${project.client_color}22` : 'var(--primary-light)', 
                        color: project.client_color || 'var(--primary-accent)',
                        fontWeight: 600
                      }}>
                        {project.client_name || 'General'}
                      </span>
                      <span className={`badge ${status === 'completed' ? 'badge-green' : 'badge-yellow'}`} style={{ textTransform: 'capitalize' }}>
                        {status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Target Keyword / Title */}
                    <h3 style={{ fontSize: '1.1rem', margin: '0 0 8px 0', fontWeight: 700, color: 'var(--text-main)' }}>
                      {project.keyword}
                    </h3>

                    {/* Meta Description / Snippet preview */}
                    {project.meta_description ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: '1.4', margin: '0 0 16px 0', maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {project.meta_description}
                      </p>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0 0 16px 0', fontStyle: 'italic' }}>
                        Type: {typeLabels[project.content_type] || project.content_type}
                      </p>
                    )}
                  </div>

                  {/* Footer Meta & Actions */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '12px' }}>
                    <div className="flex-between" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      <span>{project.word_count ? `${project.word_count.toLocaleString()} words` : 'Draft'}</span>
                      <span>{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        title="Download Markdown"
                        onClick={() => handleDownloadMarkdown(project)}
                      >
                        <Download size={14} /> MD
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        title="Clone / Duplicate"
                        disabled={duplicatingId === project.id}
                        onClick={() => handleDuplicate(project.id)}
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => navigate(`/editor/${project.id}`)}
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', color: 'var(--danger)' }}
                        title="Delete"
                        onClick={() => handleDelete(project.id, project.keyword)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="card" style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No matching articles found in library.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
