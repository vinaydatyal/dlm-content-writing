import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  PenTool, CheckCircle2, TrendingUp, Users, FileText, Clock, 
  Sparkles, RefreshCw, Layers, Search, ArrowRight, LayoutTemplate, 
  Zap, BarChart3, ChevronRight, BookOpen, ShieldCheck, ArrowUpRight,
  Compass, Network, Target, CalendarDays, Plus
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const filteredProjects = useMemo(() => {
    if (!stats?.recent_projects) return [];
    return stats.recent_projects.filter(project => {
      const matchesSearch = 
        (project.keyword && project.keyword.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (project.client_name && project.client_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (project.content_type && project.content_type.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'completed' ? project.status === 'completed' || project.article_status === 'completed' :
        statusFilter === 'planned' ? project.status === 'planned' :
        project.status !== 'completed' && project.article_status !== 'completed' && project.status !== 'planned';

      return matchesSearch && matchesStatus;
    });
  }, [stats, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
        <div className="spinner" style={{ borderColor: 'var(--primary-accent)', borderTopColor: 'transparent', width: '40px', height: '40px' }} />
      </div>
    );
  }

  const pipeline = stats?.status_breakdown || { brief: 0, outline: 0, draft: 0, review: 0, completed: 0, planned: 0 };
  const totalPipeline = (pipeline.brief || 0) + (pipeline.outline || 0) + (pipeline.draft || 0) + (pipeline.review || 0) + (pipeline.completed || 0) + (pipeline.planned || 0);

  const typeLabels = {
    blog_post: 'Blog Posts',
    content_refresh: 'Content Refresh',
    product_page: 'Product Pages',
    location_page: 'Local SEO Pages',
    service_page: 'Service Pages',
    info_page: 'Topic Pillars'
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1360px', margin: '0 auto' }}>
      
      {/* Hero Strategic Command Header */}
      <div className="card" style={{ 
        marginBottom: '28px', 
        padding: '28px 32px', 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.28)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.2)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', color: 'var(--primary-accent)', fontWeight: 700, marginBottom: '10px' }}>
              <Sparkles size={14} /> Enterprise SEO Content Suite
            </div>
            <h1 style={{ fontSize: '1.9rem', margin: '0 0 8px 0', letterSpacing: '-0.02em', fontWeight: 800 }}>
              Strategic Content Operations Hub
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.94rem', maxWidth: '640px', lineHeight: '1.5' }}>
              Architect topical clusters, mine competitor search gaps, schedule publishing velocity, and write search-intent articles.
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => navigate('/planner')} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.9rem', fontWeight: 700 }}
            >
              <Compass size={16} />
              Topic Strategy Studio
            </button>
            <button 
              onClick={() => navigate('/calendar')} 
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '0.9rem', fontWeight: 600 }}
            >
              <CalendarDays size={16} />
              Publishing Calendar
            </button>
            <button 
              onClick={() => navigate('/new')} 
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '0.9rem' }}
            >
              <PenTool size={15} />
              New Article
            </button>
            <button 
              onClick={() => navigate('/bulk')} 
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '0.9rem' }}
            >
              <Layers size={15} />
              Bulk Generate
            </button>
          </div>
        </div>
      </div>

      {/* 4 High-Impact KPI Cards */}
      <div className="grid-4" style={{ marginBottom: '28px' }}>
        
        {/* Total Articles & Active Clusters */}
        <div className="card interactive" onClick={() => navigate('/planner')} style={{ padding: '20px' }}>
          <div className="flex-between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Topic Clusters</span>
            <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '8px', borderRadius: '10px', color: 'var(--primary-accent)' }}>
              <Network size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: '1.1' }}>
            {stats?.total_clusters || 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--primary-accent)', fontWeight: 700 }}>{stats?.planned_projects || 0}</span> planned spoke topics
          </div>
        </div>

        {/* Total Words & Hours Saved */}
        <div className="card" style={{ padding: '20px' }}>
          <div className="flex-between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Words Written</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '10px', color: '#F59E0B' }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: '1.1' }}>
            {stats?.total_words?.toLocaleString() || 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.8rem', color: '#10B981', fontWeight: 600 }}>
            <Clock size={13} />
            <span>~{stats?.hours_saved || 0} hrs</span> <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>writing time saved</span>
          </div>
        </div>

        {/* 7-Day Velocity */}
        <div className="card interactive" onClick={() => navigate('/calendar')} style={{ padding: '20px' }}>
          <div className="flex-between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weekly Velocity</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '8px', borderRadius: '10px', color: '#10B981' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: '1.1' }}>
            {stats?.articles_this_week || 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span className="badge badge-green" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>Active</span>
            <span>Articles in last 7 days</span>
          </div>
        </div>

        {/* Active Client Brands */}
        <div className="card interactive" onClick={() => navigate('/clients')} style={{ padding: '20px' }}>
          <div className="flex-between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Portfolios</span>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '8px', borderRadius: '10px', color: '#3B82F6' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: '1.1' }}>
            {stats?.total_clients || 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Brand voices & briefs active</span>
          </div>
        </div>

      </div>

      {/* Production Pipeline Progress Tracker */}
      <div className="card" style={{ marginBottom: '28px', padding: '20px 24px' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="var(--primary-accent)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Production & Publishing Pipeline</h3>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {totalPipeline} total workflow items
          </span>
        </div>

        {/* Pipeline Stage Cards (6 stages) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          
          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #8b5cf6' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>📅 Planned</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{pipeline.planned || 0}</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #6366f1' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>1. Briefing</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{pipeline.brief || 0}</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>2. Outlining</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{pipeline.outline || 0}</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>3. Drafting</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{pipeline.draft || 0}</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #06b6d4' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>4. Review & NLP</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{pipeline.review || 0}</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>5. Completed</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{pipeline.completed || 0}</div>
          </div>

        </div>
      </div>

      {/* Main Grid: Projects Table & Planning Spotlights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>
        
        {/* Left Column: Projects Table & Search */}
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Recent Content Projects</h2>
                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                  Click on any project to continue writing or optimizing in the SEO editor.
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '16px' }}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                <button 
                  className={`btn ${statusFilter === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '16px' }}
                  onClick={() => setStatusFilter('in_progress')}
                >
                  In Progress
                </button>
                <button 
                  className={`btn ${statusFilter === 'planned' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '16px' }}
                  onClick={() => setStatusFilter('planned')}
                >
                  Planned
                </button>
                <button 
                  className={`btn ${statusFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '16px' }}
                  onClick={() => setStatusFilter('completed')}
                >
                  Completed
                </button>
              </div>
            </div>

            {/* Search input */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="Search projects by keyword, client, or format..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
              />
            </div>

            {/* Projects Table */}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Target Keyword</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Client</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Words</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map(project => (
                      <tr 
                        key={project.id} 
                        className="table-row-interactive"
                        onClick={() => navigate(`/editor/${project.id}`)}
                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={15} color="var(--primary-accent)" />
                            <span>{project.keyword}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="badge" style={{ 
                            backgroundColor: project.client_color ? `${project.client_color}22` : 'var(--primary-light)', 
                            color: project.client_color || 'var(--primary-accent)',
                            fontWeight: 600
                          }}>
                            {project.client_name || 'General'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {project.content_type ? project.content_type.replace('_', ' ') : 'Blog Post'}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                          {project.word_count ? `${project.word_count.toLocaleString()} w` : '-'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge ${
                            project.status === 'completed' || project.article_status === 'completed' 
                              ? 'badge-green' 
                              : project.status === 'planned'
                              ? 'badge-purple'
                              : 'badge-yellow'
                          }`} style={{ textTransform: 'capitalize' }}>
                            {project.status ? project.status.replace('_', ' ') : 'Draft'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button 
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/editor/${project.id}`);
                            }}
                          >
                            Open <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <BookOpen size={28} style={{ opacity: 0.4, margin: '0 auto 8px auto', display: 'block' }} />
                        No content projects found. Click <strong>"New Article"</strong> or <strong>"Topic Strategy Studio"</strong> above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Library Link */}
            {stats?.recent_projects?.length > 0 && (
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => navigate('/library')}
                  style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                >
                  View Full Article Library ({stats?.total_articles || 0}) →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Strategic Topic Hubs & Competitor Gap Spotlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active Topic Clusters Spotlight Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="flex-between" style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={16} color="var(--primary-accent)" /> Active Topic Clusters
              </h3>
              <button 
                className="btn btn-secondary" 
                onClick={() => navigate('/planner')}
                style={{ padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}
              >
                Strategy Studio
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats?.recent_clusters?.length > 0 ? (
                stats.recent_clusters.map(cluster => (
                  <div 
                    key={cluster.id}
                    className="interactive"
                    onClick={() => navigate('/planner')}
                    style={{ 
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {cluster.pillar_keyword}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary-accent)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        {cluster.cluster_topics?.length || 0} Spokes
                      </span>
                    </div>
                    {cluster.client_name && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Brand: {cluster.client_name}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '14px 0' }}>
                  No topic clusters architected yet. <br />
                  <button className="btn btn-primary" onClick={() => navigate('/planner')} style={{ marginTop: '8px', fontSize: '0.8rem', padding: '6px 12px' }}>
                    <Plus size={14} /> Architect First Cluster
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Competitor Gap Mining Quick Action */}
          <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#EF4444', fontWeight: 700, fontSize: '0.9rem' }}>
              <Target size={16} /> Competitor SERP Gap Scanner
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-main)', margin: '0 0 12px 0', lineHeight: '1.5' }}>
              Scan rival domains to uncover missing topics, thin competitor guides, and Position Zero PAA questions.
            </p>
            <button 
              onClick={() => navigate('/planner')} 
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.82rem', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 700 }}
            >
              <Target size={15} /> Mine Competitor Gaps Now
            </button>
          </div>

          {/* Top Client Brands */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="flex-between" style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="#3B82F6" /> Top Client Portfolios
              </h3>
              <button 
                className="btn btn-secondary" 
                onClick={() => navigate('/clients')}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                Manage
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats?.top_clients?.length > 0 ? (
                stats.top_clients.map(client => (
                  <div 
                    key={client.id}
                    className="interactive"
                    onClick={() => navigate('/clients')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: client.color || 'var(--primary-accent)' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{client.name}</span>
                    </div>
                    <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                      {client.project_count || 0} articles
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No clients configured yet.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
