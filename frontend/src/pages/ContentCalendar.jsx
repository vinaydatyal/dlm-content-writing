import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Calendar as CalIcon, ChevronLeft, ChevronRight, Plus, 
  Eye, Filter, CheckCircle2, Clock, CalendarDays, 
  Sparkles, ArrowRight, X, Layers, FileText, AlertCircle, Trash2, Edit3, Network, Zap
} from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function ContentCalendar() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Filters
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedCluster, setSelectedCluster] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'planned' | 'in_progress' | 'completed'

  // Day Inspector Modal & Plan Topic Modal
  const [selectedDayInfo, setSelectedDayInfo] = useState(null); // { date: Date, projects: [] }
  const [planModalDate, setPlanModalDate] = useState(null); // Date string 'YYYY-MM-DD'
  const [planFormData, setPlanFormData] = useState({
    keyword: '',
    client_id: '',
    cluster_id: '',
    content_type: 'blog_post',
    target_word_count: 1500,
    planned_notes: ''
  });
  const [savingPlan, setSavingPlan] = useState(false);

  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [projRes, clientRes, clusterRes] = await Promise.all([
        axios.get(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/clients`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/planning/clusters`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProjects(projRes.data || []);
      setClients(clientRes.data || []);
      setClusters(clusterRes.data || []);
    } catch (err) {
      console.error('Failed to fetch calendar data', err);
      addToast('Failed to load calendar data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Filter projects
  const filteredProjects = projects.filter(p => {
    if (selectedClient !== 'all' && String(p.client_id) !== String(selectedClient)) return false;
    if (selectedCluster !== 'all' && String(p.cluster_id) !== String(selectedCluster)) return false;
    if (selectedType !== 'all' && p.content_type !== selectedType) return false;
    if (selectedStatus === 'completed' && p.article_status !== 'completed') return false;
    if (selectedStatus === 'in_progress' && (p.article_status === 'completed' || p.status === 'planned')) return false;
    if (selectedStatus === 'planned' && p.status !== 'planned') return false;
    return true;
  });

  // Group projects by target_publish_date or created_at
  const projectsByDate = {};
  filteredProjects.forEach(p => {
    let dateStr = p.target_publish_date;
    if (!dateStr) {
      const d = new Date(p.created_at);
      dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (!projectsByDate[dateStr]) projectsByDate[dateStr] = [];
    projectsByDate[dateStr].push(p);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Month Statistics
  const currentMonthProjects = filteredProjects.filter(p => {
    const dStr = p.target_publish_date || p.created_at;
    const d = new Date(dStr);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const completedCount = currentMonthProjects.filter(p => p.article_status === 'completed').length;
  const inProgressCount = currentMonthProjects.filter(p => p.article_status !== 'completed' && p.status !== 'planned').length;
  const plannedCount = currentMonthProjects.filter(p => p.status === 'planned').length;

  // Handle Planning New Content
  const handleOpenPlanModal = (day) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setPlanModalDate(formattedDate);
    setPlanFormData({
      keyword: '',
      client_id: selectedClient !== 'all' ? selectedClient : '',
      cluster_id: selectedCluster !== 'all' ? selectedCluster : '',
      content_type: 'blog_post',
      target_word_count: 1500,
      planned_notes: ''
    });
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!planFormData.keyword.trim()) {
      addToast('Please enter a target keyword', 'error');
      return;
    }

    setSavingPlan(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/projects`, {
        keyword: planFormData.keyword.trim(),
        client_id: planFormData.client_id || null,
        cluster_id: planFormData.cluster_id || null,
        content_type: planFormData.content_type,
        target_word_count: planFormData.target_word_count,
        target_publish_date: planModalDate,
        planned_notes: planFormData.planned_notes,
        status: 'planned'
      }, { headers: { Authorization: `Bearer ${token}` } });

      addToast(`Topic planned for ${planModalDate}!`, 'success');
      setPlanModalDate(null);
      fetchData();
    } catch (err) {
      console.error(err);
      addToast('Failed to schedule planned topic', 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  // Seamless Calendar-to-Editor 1-Click Launch
  const handleLaunchInEditor = async (project) => {
    try {
      // If project is planned, activate to drafting
      if (project.status === 'planned') {
        const token = localStorage.getItem('token');
        await axios.patch(`${API_URL}/projects/${project.id}/status`, { status: 'draft' }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      navigate(`/editor/${project.id}`);
    } catch (err) {
      console.error(err);
      navigate(`/editor/${project.id}`);
    }
  };

  const handleDeleteProject = async (id, e) => {
    e?.stopPropagation();
    if (!confirm('Delete this project from calendar?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Project removed', 'success');
      setSelectedDayInfo(null);
      fetchData();
    } catch (err) {
      addToast('Failed to delete project', 'error');
    }
  };

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1360px', margin: '0 auto' }}>
      
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--primary-accent)', fontWeight: 600, marginBottom: '6px' }}>
            <CalendarDays size={14} /> Editorial Publishing Pipeline
          </div>
          <h1 style={{ fontSize: '1.9rem', margin: 0, fontWeight: 800 }}>Content Publishing & Editorial Calendar</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Schedule upcoming keywords, execute topic cluster sprints, and launch articles straight to the SEO editor.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/planner')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <Network size={16} /> Strategy & Topic Clusters
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => handleOpenPlanModal(new Date().getDate())}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Clock size={16} /> Plan Topic
          </button>
          <button onClick={() => navigate('/new')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
            <Plus size={18} /> New Article
          </button>
        </div>
      </div>

      {/* Control Bar: Month Navigation & Multi-Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Month Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={prevMonth} style={{ padding: '8px' }} title="Previous Month">
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, minWidth: '180px', textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </h2>
          <button className="btn btn-secondary" onClick={nextMonth} style={{ padding: '8px' }} title="Next Month">
            <ChevronRight size={18} />
          </button>
          <button className="btn btn-secondary" onClick={goToToday} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}>
            Today
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Client Filter */}
          <select 
            className="input" 
            value={selectedClient} 
            onChange={e => setSelectedClient(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">🏢 All Clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Topic Cluster Filter */}
          <select 
            className="input" 
            value={selectedCluster} 
            onChange={e => setSelectedCluster(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">🌐 All Topic Clusters</option>
            {clusters.map(cl => (
              <option key={cl.id} value={cl.id}>Cluster: {cl.pillar_keyword}</option>
            ))}
          </select>

          {/* Format Filter */}
          <select 
            className="input" 
            value={selectedType} 
            onChange={e => setSelectedType(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">All Formats</option>
            <option value="blog_post">Blog Post</option>
            <option value="content_refresh">Content Refresh</option>
            <option value="product_page">Product Page</option>
            <option value="location_page">Location Page</option>
            <option value="service_page">Service Page</option>
            <option value="info_page">Topic Pillar Guide</option>
          </select>

          {/* Status Filter */}
          <select 
            className="input" 
            value={selectedStatus} 
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">All Statuses</option>
            <option value="planned">📅 Planned / Scheduled</option>
            <option value="in_progress">✍️ In Active Drafting</option>
            <option value="completed">✅ Published / Done</option>
          </select>

        </div>

      </div>

      {/* Calendar Grid Container */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        
        {/* Day Header Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '8px' }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Month Day Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {cells.map((day, i) => {
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
            const dayProjects = dateStr ? (projectsByDate[dateStr] || []) : [];
            const isToday = day && new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === day;
            const isFuture = day && new Date(year, month, day) > new Date(new Date().setHours(0,0,0,0));

            return (
              <div 
                key={i} 
                onClick={() => day && setSelectedDayInfo({ date: new Date(year, month, day), dateStr, projects: dayProjects })}
                style={{
                  minHeight: '115px',
                  padding: '8px',
                  background: day ? (isToday ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)') : 'transparent',
                  borderRadius: '8px',
                  border: isToday ? '2px solid var(--primary-accent)' : day ? '1px solid var(--border-color)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: day ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => { if (day) e.currentTarget.style.borderColor = 'var(--primary-accent)'; }}
                onMouseLeave={e => { if (day && !isToday) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                {day && (
                  <>
                    {/* Date Number & Quick Plan Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: isToday ? 800 : 600,
                        color: isToday ? 'var(--primary-accent)' : isFuture ? 'var(--text-main)' : 'var(--text-muted)',
                        background: isToday ? 'rgba(99,102,241,0.2)' : 'transparent',
                        padding: isToday ? '2px 6px' : '0',
                        borderRadius: '4px'
                      }}>
                        {day}
                      </span>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenPlanModal(day); }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-muted)',
                          padding: '2px', cursor: 'pointer', borderRadius: '4px',
                          display: 'flex', alignItems: 'center'
                        }}
                        title={`Plan article on ${dateStr}`}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-accent)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Day Projects List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '82px' }}>
                      {dayProjects.slice(0, 3).map(p => {
                        const isDone = p.article_status === 'completed';
                        const isPlanned = p.status === 'planned';
                        return (
                          <div 
                            key={p.id}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              background: isDone ? 'rgba(16,185,129,0.15)' : isPlanned ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)',
                              color: isDone ? '#10B981' : isPlanned ? '#8B5CF6' : '#F59E0B',
                              borderLeft: `3px solid ${p.client_color || (isDone ? '#10B981' : isPlanned ? '#8B5CF6' : '#F59E0B')}`,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontWeight: 600
                            }}
                            title={`${p.keyword} (${p.client_name || 'No client'})`}
                          >
                            {isPlanned ? '📅 ' : isDone ? '✅ ' : '✍️ '}
                            {p.keyword}
                          </div>
                        );
                      })}

                      {dayProjects.length > 3 && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>
                          +{dayProjects.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Monthly Velocity & Publishing KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary-accent)', fontFamily: 'var(--font-display)' }}>
            {currentMonthProjects.length}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '4px' }}>
            Total Scheduled Sprints
          </div>
        </div>

        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10B981', fontFamily: 'var(--font-display)' }}>
            {completedCount}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '4px' }}>
            ✅ Published / Live
          </div>
        </div>

        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'var(--font-display)' }}>
            {inProgressCount}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '4px' }}>
            ✍️ In Active Drafting
          </div>
        </div>

        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#8B5CF6', fontFamily: 'var(--font-display)' }}>
            {plannedCount}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '4px' }}>
            📅 Planned Topics
          </div>
        </div>

      </div>

      {/* Modal 1: Day Inspector Drawer with 1-Click Launch */}
      {selectedDayInfo && (
        <div className="modal-overlay" onClick={() => setSelectedDayInfo(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="flex-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Schedule for {selectedDayInfo.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {selectedDayInfo.projects.length} article(s) planned or published
                </span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setSelectedDayInfo(null)}>
                <X size={16} />
              </button>
            </div>

            {selectedDayInfo.projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <CalIcon size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
                <p style={{ color: 'var(--text-muted)', margin: '0 0 16px 0', fontSize: '0.9rem' }}>No articles scheduled for this date.</p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => { 
                    const d = selectedDayInfo.date.getDate(); 
                    setSelectedDayInfo(null); 
                    handleOpenPlanModal(d); 
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> Plan an Article for this Day
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                {selectedDayInfo.projects.map(p => (
                  <div key={p.id} style={{
                    padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px',
                    border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main)' }}>
                        {p.keyword}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ textTransform: 'capitalize' }}>{p.content_type?.replace('_', ' ')}</span>
                        {p.client_name && <span>• {p.client_name}</span>}
                        {p.target_word_count && <span>• ~{p.target_word_count} words</span>}
                        {p.cluster_id && <span style={{ color: 'var(--primary-accent)', fontWeight: 600 }}>• 🌐 Topic Cluster</span>}
                      </div>
                      {p.planned_notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--primary-accent)', marginTop: '4px', fontStyle: 'italic' }}>
                          Note: "{p.planned_notes}"
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                        onClick={() => handleLaunchInEditor(p)}
                      >
                        <Zap size={14} /> {p.status === 'planned' ? 'Launch Writer' : 'Open Editor'} <ArrowRight size={14} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', color: '#EF4444', border: 'none' }}
                        title="Delete"
                        onClick={(e) => handleDeleteProject(p.id, e)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  const d = selectedDayInfo.date.getDate();
                  setSelectedDayInfo(null);
                  handleOpenPlanModal(d);
                }}
                style={{ fontSize: '0.85rem' }}
              >
                + Add Another Topic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Plan Future Topic Modal */}
      {planModalDate && (
        <div className="modal-overlay" onClick={() => setPlanModalDate(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="flex-between" style={{ marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Plan Content Topic</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--primary-accent)', fontWeight: 600 }}>
                  Target Publish Date: {planModalDate}
                </span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setPlanModalDate(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePlan}>
              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Target Primary Keyword *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. B2B SaaS Customer Retention Strategies"
                  value={planFormData.keyword}
                  onChange={e => setPlanFormData({ ...planFormData, keyword: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2" style={{ marginBottom: '14px' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Client Brand</label>
                  <select 
                    className="input" 
                    value={planFormData.client_id}
                    onChange={e => setPlanFormData({ ...planFormData, client_id: e.target.value })}
                  >
                    <option value="">No Client (Generic)</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Topic Cluster (Optional)</label>
                  <select 
                    className="input" 
                    value={planFormData.cluster_id}
                    onChange={e => setPlanFormData({ ...planFormData, cluster_id: e.target.value })}
                  >
                    <option value="">Standalone Topic</option>
                    {clusters.map(cl => (
                      <option key={cl.id} value={cl.id}>{cl.pillar_keyword}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Content Format</label>
                <select 
                  className="input" 
                  value={planFormData.content_type}
                  onChange={e => setPlanFormData({ ...planFormData, content_type: e.target.value })}
                >
                  <option value="blog_post">Blog Post / Informational Guide</option>
                  <option value="content_refresh">Content Refresh (Optimizer)</option>
                  <option value="product_page">Product Page</option>
                  <option value="location_page">Location SEO Landing Page</option>
                  <option value="service_page">Service Page</option>
                  <option value="info_page">Comprehensive Topic Pillar</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Target Length: {planFormData.target_word_count} words</label>
                <input 
                  type="range" 
                  min="800" 
                  max="4000" 
                  step="100"
                  value={planFormData.target_word_count}
                  onChange={e => setPlanFormData({ ...planFormData, target_word_count: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--primary-accent)' }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Editorial Planning Notes (Optional)</label>
                <textarea 
                  className="input" 
                  style={{ minHeight: '70px', fontSize: '0.85rem' }}
                  placeholder="e.g. Include interview quotes, competitor gap angle, internal link to pillar..."
                  value={planFormData.planned_notes}
                  onChange={e => setPlanFormData({ ...planFormData, planned_notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPlanModalDate(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingPlan} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {savingPlan ? 'Scheduling...' : <><CheckCircle2 size={16} /> Schedule on Calendar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
