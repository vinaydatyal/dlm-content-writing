import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PenTool, CheckCircle, TrendingUp, Users, FileText } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}><div className="spinner" style={{ borderColor: 'var(--primary-accent)', borderTopColor: 'transparent', width: '40px', height: '40px' }} /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Welcome back to Digital Leap Content Dashboard.</p>
        </div>
        <button onClick={() => navigate('/new')} className="btn btn-primary">
          <PenTool size={18} />
          Create New Article
        </button>
      </div>

      <div className="grid-4" style={{ marginBottom: '40px' }}>
        <div className="card interactive" onClick={() => navigate('/library')}>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Total Articles</h3>
            <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '8px', color: 'var(--primary-accent)' }}>
              <FileText size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {stats?.total_articles || 0}
          </div>
        </div>

        <div className="card interactive" onClick={() => navigate('/library')}>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Generated This Week</h3>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '8px', borderRadius: '8px', color: '#10B981' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {stats?.articles_this_week || 0}
          </div>
        </div>

        <div className="card">
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Total Words</h3>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '8px', color: '#F59E0B' }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {stats?.total_words?.toLocaleString() || 0}
          </div>
        </div>

        <div className="card interactive" onClick={() => navigate('/clients')}>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Active Clients</h3>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '8px', borderRadius: '8px', color: '#3B82F6' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {stats?.total_clients || 0}
          </div>
        </div>
      </div>

      <h2 style={{ marginBottom: '24px' }}>Recent Projects</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-base)' }}>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500 }}>Keyword</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500 }}>Client</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 500 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {stats?.recent_projects?.length > 0 ? (
              stats.recent_projects.map(project => (
                <tr 
                  key={project.id} 
                  className="table-row-interactive"
                  onClick={() => navigate(`/editor/${project.id}`)}
                  style={{ borderBottom: '1px solid var(--border-color)' }}
                >
                  <td style={{ padding: '16px 24px', fontWeight: 500 }}>{project.keyword}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span className="badge" style={{ backgroundColor: project.client_color ? `${project.client_color}22` : 'var(--primary-light)', color: project.client_color || 'var(--primary-accent)' }}>
                      {project.client_name || 'No Client'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span className={`badge ${project.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                    {new Date(project.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No recent projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
