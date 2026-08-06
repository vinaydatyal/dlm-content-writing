import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Compass, Network, Target, Sparkles, Plus, Calendar, 
  ArrowRight, Search, CheckCircle2, ChevronRight, Layers, 
  Trash2, ExternalLink, RefreshCw, BarChart2, ShieldAlert, 
  Zap, Link2, FileText, ChevronDown, Check, Download, AlertCircle, Clock
} from 'lucide-react';
import { useToast } from '../components/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ContentPlanner() {
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Active Tab: 'clusters' | 'competitor_gaps' | 'roadmap'
  const [activeTab, setActiveTab] = useState('clusters');

  // Common Data
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('all');
  const [loadingClients, setLoadingClients] = useState(true);

  // ─────────────────────────────────────────
  // TAB 1: TOPIC CLUSTERS STATE
  // ─────────────────────────────────────────
  const [clusters, setClusters] = useState([]);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [activeCluster, setActiveCluster] = useState(null); // Selected cluster for deep inspection
  
  // AI Cluster Generator Modal
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [generatingCluster, setGeneratingCluster] = useState(false);
  const [clusterForm, setClusterForm] = useState({
    pillar_keyword: '',
    client_id: '',
    niche: '',
    target_audience: '',
    search_intent: 'informational',
    target_word_count: 3000
  });
  const [generatedPreview, setGeneratedPreview] = useState(null);

  // Batch Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleClusterId, setScheduleClusterId] = useState(null);
  const [scheduleStartDate, setScheduleStartDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [scheduleCadence, setScheduleCadence] = useState('weekly'); // 'weekly' | 'biweekly' | 'twice_weekly'
  const [scheduling, setScheduling] = useState(false);

  // ─────────────────────────────────────────
  // TAB 2: COMPETITOR CONTENT GAPS STATE
  // ─────────────────────────────────────────
  const [gapForm, setGapForm] = useState({
    client_id: '',
    seed_topic: '',
    competitor_urls: ''
  });
  const [miningGaps, setMiningGaps] = useState(false);
  const [gapResults, setGapResults] = useState(null);
  const [gapFilter, setGapFilter] = useState('all'); // 'all' | 'missing_topic' | 'weak_coverage' | 'paa_question'
  const [convertingGapId, setConvertingGapId] = useState(null);

  // Initial Data Fetching
  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/clients`, { headers: { Authorization: `Bearer ${token}` } });
      setClients(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchClusters = async () => {
    setLoadingClusters(true);
    try {
      const token = localStorage.getItem('token');
      const url = selectedClient !== 'all' ? `${API_URL}/planning/clusters?client_id=${selectedClient}` : `${API_URL}/planning/clusters`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setClusters(res.data || []);
      if (res.data?.length > 0 && !activeCluster) {
        setActiveCluster(res.data[0]);
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to load topic clusters', 'error');
    } finally {
      setLoadingClusters(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [selectedClient]);

  // ─────────────────────────────────────────
  // CLUSTER GENERATION HANDLERS
  // ─────────────────────────────────────────
  const handleGenerateClusterAI = async (e) => {
    e.preventDefault();
    if (!clusterForm.pillar_keyword.trim()) {
      addToast('Please enter a Pillar Keyword', 'error');
      return;
    }

    setGeneratingCluster(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/planning/generate-cluster`, {
        pillar_keyword: clusterForm.pillar_keyword.trim(),
        client_id: clusterForm.client_id || null,
        niche: clusterForm.niche,
        target_audience: clusterForm.target_audience
      }, { headers: { Authorization: `Bearer ${token}` } });

      setGeneratedPreview(res.data.cluster);
      addToast('Topical Cluster generated successfully!', 'success');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to generate cluster', 'error');
    } finally {
      setGeneratingCluster(false);
    }
  };

  const handleSaveCluster = async () => {
    if (!generatedPreview) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/planning/clusters`, {
        client_id: clusterForm.client_id || null,
        pillar_keyword: generatedPreview.pillar.keyword,
        pillar_title: generatedPreview.pillar.title,
        search_intent: generatedPreview.pillar.search_intent || 'informational',
        target_word_count: generatedPreview.pillar.target_words || 3000,
        cluster_topics: generatedPreview.cluster_topics,
        status: 'planned'
      }, { headers: { Authorization: `Bearer ${token}` } });

      addToast('Topic Cluster saved to strategy hub!', 'success');
      setShowClusterModal(false);
      setGeneratedPreview(null);
      setClusterForm({
        pillar_keyword: '',
        client_id: '',
        niche: '',
        target_audience: '',
        search_intent: 'informational',
        target_word_count: 3000
      });
      fetchClusters();
    } catch (err) {
      console.error(err);
      addToast('Failed to save cluster', 'error');
    }
  };

  const handleDeleteCluster = async (id, e) => {
    e?.stopPropagation();
    if (!confirm('Delete this Topic Cluster? Connected projects will remain intact.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/planning/clusters/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Topic Cluster deleted', 'success');
      if (activeCluster?.id === id) setActiveCluster(null);
      fetchClusters();
    } catch (err) {
      addToast('Failed to delete cluster', 'error');
    }
  };

  // ─────────────────────────────────────────
  // BATCH SCHEDULE CLUSTER HANDLERS
  // ─────────────────────────────────────────
  const handleOpenScheduleModal = (cluster) => {
    setScheduleClusterId(cluster.id);
    setShowScheduleModal(true);
  };

  const handleExecuteBatchSchedule = async () => {
    if (!scheduleClusterId) return;
    setScheduling(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/planning/batch-schedule-cluster`, {
        cluster_id: scheduleClusterId,
        start_date: scheduleStartDate,
        cadence: scheduleCadence
      }, { headers: { Authorization: `Bearer ${token}` } });

      addToast(`🎉 Scheduled ${res.data.scheduled_count} articles on your Content Calendar!`, 'success');
      setShowScheduleModal(false);
      fetchClusters();
    } catch (err) {
      console.error(err);
      addToast('Failed to batch schedule cluster', 'error');
    } finally {
      setScheduling(false);
    }
  };

  // ─────────────────────────────────────────
  // 1-CLICK LAUNCH SINGLE SPOKE TO EDITOR
  // ─────────────────────────────────────────
  const handleLaunchSpokeInEditor = async (spoke, cluster) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/projects`, {
        keyword: spoke.keyword || spoke.title,
        title: spoke.title,
        client_id: cluster.client_id || null,
        cluster_id: cluster.id,
        content_type: spoke.search_intent === 'commercial' ? 'product_page' : 'blog_post',
        target_word_count: spoke.target_words || 1500,
        status: 'draft'
      }, { headers: { Authorization: `Bearer ${token}` } });

      addToast(`Created project for "${spoke.title}"! Launching editor...`, 'success');
      navigate(`/editor/${res.data.id}`);
    } catch (err) {
      console.error(err);
      addToast('Failed to launch editor', 'error');
    }
  };

  // ─────────────────────────────────────────
  // COMPETITOR GAP MINING HANDLERS
  // ─────────────────────────────────────────
  const handleMineCompetitorGaps = async (e) => {
    e.preventDefault();
    if (!gapForm.seed_topic.trim() && !gapForm.client_id) {
      addToast('Please enter a seed topic or select a client', 'error');
      return;
    }

    setMiningGaps(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/planning/competitor-gaps`, {
        seed_topic: gapForm.seed_topic.trim(),
        client_id: gapForm.client_id || null,
        competitor_urls: gapForm.competitor_urls.trim()
      }, { headers: { Authorization: `Bearer ${token}` } });

      setGapResults(res.data.data);
      addToast('Competitor Content Gap analysis complete!', 'success');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to mine competitor gaps', 'error');
    } finally {
      setMiningGaps(false);
    }
  };

  const handleConvertGapToProject = async (gap) => {
    setConvertingGapId(gap.id);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/planning/convert-gap-to-project`, {
        keyword: gap.keyword,
        title: gap.title,
        client_id: gapForm.client_id || null,
        content_type: gap.search_intent === 'commercial' ? 'product_page' : 'blog_post',
        target_word_count: gap.suggested_words || 1800,
        notes: `[Gap Mining Opportunity] ${gap.why_target} | Competitor: ${gap.competitor_url || 'SERP competitor'}`
      }, { headers: { Authorization: `Bearer ${token}` } });

      addToast(`⚡ Converted "${gap.keyword}" to project! Launching editor...`, 'success');
      navigate(`/editor/${res.data.project.id}`);
    } catch (err) {
      console.error(err);
      addToast('Failed to convert gap to project', 'error');
    } finally {
      setConvertingGapId(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.82rem', color: 'var(--primary-accent)', fontWeight: 600, marginBottom: '6px' }}>
            <Compass size={15} /> Strategic SEO Architecture
          </div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Content Planning & Topic Strategy Studio
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.92rem' }}>
            Architect high-authority topic clusters, discover competitor content gaps, and execute calendar publishing sprints.
          </p>
        </div>

        {/* Global Client Switcher & New Action */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            className="input" 
            value={selectedClient} 
            onChange={e => setSelectedClient(e.target.value)}
            style={{ width: 'auto', padding: '8px 14px', fontSize: '0.88rem', fontWeight: 600 }}
          >
            <option value="all">🏢 All Client Portfolios</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button 
            className="btn btn-primary"
            onClick={() => {
              setGeneratedPreview(null);
              setShowClusterModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700 }}
          >
            <Sparkles size={18} /> Generate Topic Cluster
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        borderBottom: '1px solid var(--border-color)', 
        marginBottom: '28px',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('clusters')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'clusters' ? 'var(--primary-accent)' : 'var(--text-muted)',
            borderBottom: activeTab === 'clusters' ? '3px solid var(--primary-accent)' : '3px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <Network size={18} /> Topic Clusters & Pillar Hub
          <span style={{ 
            fontSize: '0.75rem', 
            background: activeTab === 'clusters' ? 'rgba(99,102,241,0.2)' : 'var(--bg-secondary)', 
            padding: '2px 8px', 
            borderRadius: '10px',
            fontWeight: 700
          }}>
            {clusters.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('competitor_gaps')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'competitor_gaps' ? 'var(--primary-accent)' : 'var(--text-muted)',
            borderBottom: activeTab === 'competitor_gaps' ? '3px solid var(--primary-accent)' : '3px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <Target size={18} /> Competitor Gap Mining Engine
          <span style={{ 
            fontSize: '0.72rem', 
            background: 'rgba(239, 68, 68, 0.15)', 
            color: '#EF4444',
            padding: '2px 8px', 
            borderRadius: '10px',
            fontWeight: 700
          }}>
            Live AI
          </span>
        </button>

        <button
          onClick={() => navigate('/calendar')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <Calendar size={18} /> Publishing Calendar View
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: TOPIC CLUSTERS & PILLAR HUB
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'clusters' && (
        <div>
          {loadingClusters ? (
            <div className="spinner" style={{ margin: '80px auto' }} />
          ) : clusters.length === 0 ? (
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '650px', margin: '40px auto' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: 'var(--primary-accent)' }}>
                <Network size={32} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px 0' }}>No Topic Clusters Architected Yet</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '24px' }}>
                Topic Clusters organize your content into a high-authority <strong>Hub and Spoke</strong> hierarchy. The central Pillar guide establishes authority, while interconnected Spoke articles capture long-tail search intent.
              </p>
              <button 
                className="btn btn-primary"
                onClick={() => setShowClusterModal(true)}
                style={{ padding: '12px 24px', fontSize: '0.95rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Sparkles size={18} /> Architect Your First Topic Cluster
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Left Column: Cluster Selector List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="flex-between" style={{ padding: '0 4px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Active Topic Hubs ({clusters.length})
                  </span>
                  <button 
                    onClick={() => setShowClusterModal(true)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> New Hub
                  </button>
                </div>

                {clusters.map(c => {
                  const isSelected = activeCluster?.id === c.id;
                  const topicsCount = c.cluster_topics?.length || 0;
                  return (
                    <div 
                      key={c.id}
                      onClick={() => setActiveCluster(c)}
                      className="card"
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--primary-accent)' : 'var(--border-color)',
                        background: isSelected ? 'rgba(99,102,241,0.06)' : 'var(--bg-secondary)',
                        boxShadow: isSelected ? '0 0 0 1px var(--primary-accent)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div className="flex-between" style={{ marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(99,102,241,0.15)',
                          color: 'var(--primary-accent)'
                        }}>
                          🏛️ Pillar Guide Hub
                        </span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button 
                            onClick={(e) => handleDeleteCluster(c.id, e)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            title="Delete Cluster"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', marginBottom: '6px' }}>
                        {c.pillar_keyword}
                      </div>

                      {c.client_name && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.client_color || 'var(--primary-accent)' }} />
                          {c.client_name}
                        </div>
                      )}

                      <div className="flex-between" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '6px' }}>
                        <span>🔗 {topicsCount} Spoke Topics</span>
                        <span style={{ color: 'var(--primary-accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          View Blueprint <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Detailed Hub & Spoke Strategy Blueprint */}
              {activeCluster ? (
                <div className="card" style={{ padding: '28px' }}>
                  
                  {/* Pillar Header Card */}
                  <div style={{ 
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.15) 100%)',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    marginBottom: '28px'
                  }}>
                    <div className="flex-between" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: 'var(--primary-accent)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Central Anchor Hub
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Target Intent: <strong>{activeCluster.search_intent}</strong>
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Length: <strong>~{activeCluster.target_word_count} words</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleOpenScheduleModal(activeCluster)}
                          className="btn btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                          <Calendar size={15} /> Batch Schedule Cluster ({activeCluster.cluster_topics?.length || 0} Articles)
                        </button>
                        <button
                          onClick={() => handleLaunchSpokeInEditor({ keyword: activeCluster.pillar_keyword, title: activeCluster.pillar_title, search_intent: activeCluster.search_intent, target_words: activeCluster.target_word_count }, activeCluster)}
                          className="btn btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
                        >
                          <Zap size={15} /> Write Pillar Guide <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>

                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                      {activeCluster.pillar_title || activeCluster.pillar_keyword}
                    </h2>
                    <div style={{ fontSize: '0.9rem', color: 'var(--primary-accent)', fontWeight: 600 }}>
                      Primary Keyword: <strong>{activeCluster.pillar_keyword}</strong>
                    </div>
                  </div>

                  {/* Internal Linking Architecture Header */}
                  <div className="flex-between" style={{ marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                        Internal Linking & Spoke Architecture ({activeCluster.cluster_topics?.length || 0} Sub-Topics)
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        Every supporting article links to the pillar anchor while cross-linking sibling spokes to establish maximum Google topical authority.
                      </p>
                    </div>
                  </div>

                  {/* Spoke Cards Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {activeCluster.cluster_topics?.map((spoke, idx) => (
                      <div 
                        key={spoke.id || idx}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '18px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div className="flex-between" style={{ marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)',
                              color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.78rem', fontWeight: 800
                            }}>
                              {idx + 1}
                            </span>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                              {spoke.title}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                              background: spoke.search_intent === 'commercial' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                              color: spoke.search_intent === 'commercial' ? '#10B981' : 'var(--primary-accent)',
                              textTransform: 'uppercase'
                            }}>
                              {spoke.search_intent}
                            </span>

                            {spoke.opportunity && (
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                                background: spoke.opportunity === 'Quick Win' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                color: spoke.opportunity === 'Quick Win' ? '#10B981' : '#F59E0B'
                              }}>
                                ⚡ {spoke.opportunity}
                              </span>
                            )}

                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              ~{spoke.target_words || 1500} words
                            </span>

                            <button
                              onClick={() => handleLaunchSpokeInEditor(spoke, activeCluster)}
                              className="btn btn-primary"
                              style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                            >
                              Write Article <ArrowRight size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Keyword & Angle */}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          Target Keyword: <strong style={{ color: 'var(--text-main)' }}>"{spoke.keyword}"</strong>
                          {spoke.angle && <span> • <em>{spoke.angle}</em></span>}
                        </div>

                        {/* Internal Linking Blueprint Box */}
                        {spoke.internal_linking && (
                          <div style={{
                            background: 'rgba(99, 102, 241, 0.05)',
                            border: '1px dashed rgba(99, 102, 241, 0.25)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px',
                            fontSize: '0.8rem'
                          }}>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                <Link2 size={13} /> Upward Link to Pillar:
                              </div>
                              <div style={{ color: 'var(--text-main)', fontStyle: 'italic' }}>
                                Anchor text: <strong>"{spoke.internal_linking.to_pillar_anchor || activeCluster.pillar_keyword}"</strong>
                              </div>
                            </div>

                            <div>
                              <div style={{ fontWeight: 700, color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                <Network size={13} /> Cross-Spoke Sibling Link:
                              </div>
                              <div style={{ color: 'var(--text-main)', fontStyle: 'italic' }}>
                                Anchor text: <strong>"{spoke.internal_linking.cross_spoke_anchor || 'related topic'}"</strong> ({spoke.internal_linking.cross_spoke_recommendation || 'sibling article'})
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              ) : null}

            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: COMPETITOR GAP MINING ENGINE
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'competitor_gaps' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Mining Controls Form */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={18} />
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>SERP Gap Scanner</h2>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
              Analyze your competitor domain footprint to discover high-volume keywords, thin competitor guides, and Position Zero PAA questions where you can outrank them.
            </p>

            <form onSubmit={handleMineCompetitorGaps}>
              
              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Client Brand</label>
                <select 
                  className="input" 
                  value={gapForm.client_id}
                  onChange={e => setGapForm({ ...gapForm, client_id: e.target.value })}
                >
                  <option value="">Select Client (or analyze general niche)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Target Niche / Seed Topic *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. B2B Account Based Marketing"
                  value={gapForm.seed_topic}
                  onChange={e => setGapForm({ ...gapForm, seed_topic: e.target.value })}
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Competitor Domains / URLs (Optional)</label>
                <textarea 
                  className="input" 
                  style={{ minHeight: '75px', fontSize: '0.85rem' }}
                  placeholder="e.g. competitor.com, rivalblog.io/marketing-guide"
                  value={gapForm.competitor_urls}
                  onChange={e => setGapForm({ ...gapForm, competitor_urls: e.target.value })}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={miningGaps}
                style={{ width: '100%', padding: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {miningGaps ? (
                  <>Mining Competitor Gaps...</>
                ) : (
                  <><Sparkles size={16} /> Scan & Mine Content Gaps</>
                )}
              </button>
            </form>
          </div>

          {/* Mining Results Display */}
          <div>
            {!gapResults ? (
              <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <Target size={42} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px 0' }}>Ready to Mine Competitor Opportunities</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto' }}>
                  Enter a seed topic or select a client on the left to scan Google SERP competitors and discover instant content opportunities.
                </p>
              </div>
            ) : (
              <div>
                
                {/* Summary KPI Ribbon */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                  <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-accent)' }}>
                      {gapResults.gaps?.length || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Gaps Discovered</div>
                  </div>

                  <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>
                      {gapResults.gaps?.filter(g => g.opportunity_score === 'High').length || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>High Impact Opportunities</div>
                  </div>

                  <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981' }}>
                      {gapResults.gaps?.filter(g => g.opportunity_score === 'Quick Win').length || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>⚡ Quick Win Targets</div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setGapFilter('all')}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '5px 12px', fontSize: '0.8rem', fontWeight: 600,
                      background: gapFilter === 'all' ? 'var(--primary-accent)' : 'var(--bg-secondary)',
                      color: gapFilter === 'all' ? '#fff' : 'var(--text-main)'
                    }}
                  >
                    All Gaps ({gapResults.gaps?.length || 0})
                  </button>
                  <button 
                    onClick={() => setGapFilter('missing_topic')}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '5px 12px', fontSize: '0.8rem', fontWeight: 600,
                      background: gapFilter === 'missing_topic' ? 'var(--primary-accent)' : 'var(--bg-secondary)',
                      color: gapFilter === 'missing_topic' ? '#fff' : 'var(--text-main)'
                    }}
                  >
                    🚫 Missing Topics
                  </button>
                  <button 
                    onClick={() => setGapFilter('weak_coverage')}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '5px 12px', fontSize: '0.8rem', fontWeight: 600,
                      background: gapFilter === 'weak_coverage' ? 'var(--primary-accent)' : 'var(--bg-secondary)',
                      color: gapFilter === 'weak_coverage' ? '#fff' : 'var(--text-main)'
                    }}
                  >
                    📉 Weak Competitor Guides
                  </button>
                  <button 
                    onClick={() => setGapFilter('paa_question')}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '5px 12px', fontSize: '0.8rem', fontWeight: 600,
                      background: gapFilter === 'paa_question' ? 'var(--primary-accent)' : 'var(--bg-secondary)',
                      color: gapFilter === 'paa_question' ? '#fff' : 'var(--text-main)'
                    }}
                  >
                    ❓ PAA / Snippet Targets
                  </button>
                </div>

                {/* Gaps List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {gapResults.gaps
                    ?.filter(g => gapFilter === 'all' || g.gap_type === gapFilter)
                    .map((gap, idx) => (
                      <div 
                        key={gap.id || idx}
                        className="card"
                        style={{
                          padding: '18px',
                          borderLeft: `4px solid ${gap.opportunity_score === 'Quick Win' ? '#10B981' : gap.opportunity_score === 'High' ? '#EF4444' : '#F59E0B'}`
                        }}
                      >
                        <div className="flex-between" style={{ marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                              background: gap.gap_type === 'missing_topic' ? 'rgba(239,68,68,0.15)' : gap.gap_type === 'weak_coverage' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                              color: gap.gap_type === 'missing_topic' ? '#EF4444' : gap.gap_type === 'weak_coverage' ? '#F59E0B' : 'var(--primary-accent)'
                            }}>
                              {gap.gap_type === 'missing_topic' ? '🚫 Missing Topic' : gap.gap_type === 'weak_coverage' ? '📉 Skyscraper Opportunity' : '❓ Position Zero PAA'}
                            </span>

                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                              {gap.title}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                              background: gap.opportunity_score === 'Quick Win' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                              color: gap.opportunity_score === 'Quick Win' ? '#10B981' : '#EF4444'
                            }}>
                              {gap.opportunity_score} Opportunity
                            </span>

                            <button
                              onClick={() => handleConvertGapToProject(gap)}
                              disabled={convertingGapId === gap.id}
                              className="btn btn-primary"
                              style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              {convertingGapId === gap.id ? 'Converting...' : <><Zap size={14} /> 1-Click Launch</>}
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          Primary Keyword: <strong style={{ color: 'var(--text-main)' }}>"{gap.keyword}"</strong>
                          {gap.est_search_volume && <span> • Vol: <strong>{gap.est_search_volume}</strong></span>}
                          {gap.suggested_words && <span> • Target: <strong>~{gap.suggested_words} words</strong></span>}
                        </div>

                        <div style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-main)',
                          background: 'var(--bg-primary)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          lineHeight: 1.5
                        }}>
                          <strong>Why Target:</strong> {gap.why_target}
                        </div>
                      </div>
                    ))}
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: AI TOPIC CLUSTER GENERATOR & BLUEPRINT BUILDER
      ───────────────────────────────────────────────────────────── */}
      {showClusterModal && (
        <div className="modal-overlay" onClick={() => setShowClusterModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div className="flex-between" style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} style={{ color: 'var(--primary-accent)' }} /> AI Topic Cluster Architect
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Generates an interconnected Hub-and-Spoke pillar strategy with internal linking anchors.
                </span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowClusterModal(false)}>
                ✕
              </button>
            </div>

            {!generatedPreview ? (
              <form onSubmit={handleGenerateClusterAI}>
                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>Target Pillar Keyword *</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. SEO Audit Methodology"
                    value={clusterForm.pillar_keyword}
                    onChange={e => setClusterForm({ ...clusterForm, pillar_keyword: e.target.value })}
                    required
                  />
                </div>

                <div className="grid-2" style={{ marginBottom: '14px' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>Client Brand</label>
                    <select 
                      className="input" 
                      value={clusterForm.client_id}
                      onChange={e => setClusterForm({ ...clusterForm, client_id: e.target.value })}
                    >
                      <option value="">No Client (Generic Strategy)</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>Target Niche / Industry</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. B2B SaaS, FinTech, E-Commerce"
                      value={clusterForm.niche}
                      onChange={e => setClusterForm({ ...clusterForm, niche: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>Target Audience Persona</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. Marketing Directors, Enterprise SEO Managers"
                    value={clusterForm.target_audience}
                    onChange={e => setClusterForm({ ...clusterForm, target_audience: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowClusterModal(false)}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={generatingCluster}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                  >
                    {generatingCluster ? 'Architecting Cluster...' : <><Sparkles size={16} /> Generate Strategy Blueprint</>}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ background: 'rgba(99,102,241,0.08)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-accent)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Generated Pillar Hub
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {generatedPreview.pillar.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Keyword: <strong>"{generatedPreview.pillar.keyword}"</strong> • ~{generatedPreview.pillar.target_words} words
                  </div>
                </div>

                <div style={{ marginBottom: '14px', fontWeight: 700, fontSize: '0.92rem' }}>
                  Spoke Articles Blueprint ({generatedPreview.cluster_topics?.length || 0}):
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto', marginBottom: '24px' }}>
                  {generatedPreview.cluster_topics?.map((spoke, i) => (
                    <div key={i} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div className="flex-between">
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {i + 1}. {spoke.title}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-accent)' }}>
                          {spoke.search_intent}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Keyword: "{spoke.keyword}" • Anchor up: <em>"{spoke.internal_linking?.to_pillar_anchor}"</em>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setGeneratedPreview(null)}
                  >
                    ← Edit Input
                  </button>

                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleSaveCluster}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                  >
                    <CheckCircle2 size={16} /> Save & Add to Strategy Hub
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: BATCH SCHEDULE CLUSTER TO CALENDAR
      ───────────────────────────────────────────────────────────── */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            
            <div className="flex-between" style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--primary-accent)' }} /> Batch Schedule Cluster Sprint
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Automatically spaces and schedules the entire topic cluster across your calendar.
                </span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowScheduleModal(false)}>
                ✕
              </button>
            </div>

            <div className="input-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>Publishing Sprint Start Date</label>
              <input 
                type="date" 
                className="input" 
                value={scheduleStartDate}
                onChange={e => setScheduleStartDate(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>Publishing Frequency Cadence</label>
              <select 
                className="input" 
                value={scheduleCadence}
                onChange={e => setScheduleCadence(e.target.value)}
              >
                <option value="weekly">📅 Weekly (1 Article Every 7 Days)</option>
                <option value="twice_weekly">⚡ Twice Weekly (Every 3-4 Days)</option>
                <option value="biweekly">🗓️ Bi-Weekly (Every 14 Days)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                disabled={scheduling}
                onClick={handleExecuteBatchSchedule}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                {scheduling ? 'Scheduling...' : <><Calendar size={16} /> Distribute on Calendar</>}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
