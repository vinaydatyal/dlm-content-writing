import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Download, Edit2, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ArticleLibrary() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProjects();
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  const filteredProjects = projects.filter(p => 
    p.keyword.toLowerCase().includes(search.toLowerCase()) || 
    (p.client_name && p.client_name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />;

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1>Content Library</h1>
          <p style={{ color: 'var(--text-muted)' }}>Browse all generated articles and projects.</p>
        </div>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="input" 
            placeholder="Search keyword or client..." 
            style={{ paddingLeft: '40px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-base)' }}>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500 }}>Keyword / Title</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500 }}>Client</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500 }}>Word Count</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length > 0 ? (
              filteredProjects.map(project => (
                <tr key={project.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 500, color: 'var(--text-main)' }}>
                    <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/editor/${project.id}`)}>
                      {project.keyword}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span className="badge" style={{ backgroundColor: project.client_color ? `${project.client_color}22` : 'var(--primary-light)', color: project.client_color || 'var(--primary-accent)' }}>
                      {project.client_name || 'No Client'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span className={`badge ${project.article_status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>
                      {(project.article_status || project.status).replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                    {project.word_count || 0}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => navigate(`/editor/${project.id}`)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => handleDelete(project.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
