import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Plus, Eye } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function ContentCalendar() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
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
    fetchProjects();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));

  // Group projects by their creation date
  const projectsByDate = {};
  projects.forEach(p => {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!projectsByDate[key]) projectsByDate[key] = [];
    projectsByDate[key].push(p);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />;

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1>Content Calendar</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track your publishing schedule at a glance.</p>
        </div>
        <button onClick={() => navigate('/new')} className="btn btn-primary">
          <Plus size={18} /> New Article
        </button>
      </div>

      <div className="card">
        {/* Month nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button className="btn btn-secondary" onClick={prev} style={{ padding: '8px' }}><ChevronLeft size={20} /></button>
          <h2 style={{ margin: 0 }}>{MONTHS[month]} {year}</h2>
          <button className="btn btn-secondary" onClick={next} style={{ padding: '8px' }}><ChevronRight size={20} /></button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '4px' }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '8px' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {cells.map((day, i) => {
            const key = day ? `${year}-${month}-${day}` : null;
            const dayProjects = key ? (projectsByDate[key] || []) : [];
            const isToday = day && new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === day;

            return (
              <div key={i} style={{
                minHeight: '90px', padding: '6px',
                background: day ? (isToday ? 'rgba(99,102,241,0.1)' : 'var(--bg-base)') : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: isToday ? '2px solid var(--primary-accent)' : day ? '1px solid var(--border-color)' : 'none'
              }}>
                {day && (
                  <>
                    <div style={{ fontSize: '0.75rem', fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--primary-accent)' : 'var(--text-muted)', marginBottom: '4px' }}>
                      {day}
                    </div>
                    {dayProjects.map(p => (
                      <div key={p.id}
                        onClick={() => navigate(`/editor/${p.id}`)}
                        style={{
                          fontSize: '0.65rem', padding: '3px 5px', borderRadius: '3px', marginBottom: '2px', cursor: 'pointer',
                          background: p.article_status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color: p.article_status === 'completed' ? '#10B981' : '#F59E0B',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}
                        title={p.keyword}
                      >
                        {p.keyword}
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid-4" style={{ marginTop: '24px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--primary-accent)' }}>
            {projects.filter(p => { const d = new Date(p.created_at); return d.getMonth() === month && d.getFullYear() === year; }).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Articles This Month</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: '#10B981' }}>
            {projects.filter(p => { const d = new Date(p.created_at); return d.getMonth() === month && d.getFullYear() === year && p.article_status === 'completed'; }).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: '#F59E0B' }}>
            {projects.filter(p => { const d = new Date(p.created_at); return d.getMonth() === month && d.getFullYear() === year && p.article_status !== 'completed'; }).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>In Progress</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {projects.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All Time Total</div>
        </div>
      </div>
    </div>
  );
}
