import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  History, RotateCcw, Clock, Trash2, X, Eye, FileText, Check, Sparkles, 
  ArrowRight, ShieldCheck, Wand2, RefreshCw
} from 'lucide-react';

export default function RevisionsModal({
  isOpen,
  history = [],
  currentContent = '',
  onRestore,
  onClearHistory,
  onClose
}) {
  const [selectedRevisionIdx, setSelectedRevisionIdx] = useState(
    history.length > 0 ? history.length - 1 : null
  );
  const [previewTab, setPreviewTab] = useState('preview'); // 'preview' | 'raw'

  if (!isOpen) return null;

  const selectedRev = selectedRevisionIdx !== null ? history[selectedRevisionIdx] : null;

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
        ' (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
    } catch {
      return isoString;
    }
  };

  const getActionIcon = (label = '') => {
    const l = label.toLowerCase();
    if (l.includes('inline')) return <Wand2 size={13} color="#38BDF8" />;
    if (l.includes('humanize')) return <Sparkles size={13} color="#A78BFA" />;
    if (l.includes('brand') || l.includes('fact')) return <ShieldCheck size={13} color="#10B981" />;
    if (l.includes('regen') || l.includes('section')) return <RefreshCw size={13} color="#F59E0B" />;
    return <Clock size={13} color="var(--text-muted)" />;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '24px'
    }}>
      <div className="card animate-fade-in" style={{
        width: '100%',
        maxWidth: '1050px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        padding: 0
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={20} color="var(--primary-accent)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Revision History Timeline ({history.length} Snapshots)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Inspect past versions and roll back instantly with full safety.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {history.length > 0 && onClearHistory && (
              <button
                onClick={onClearHistory}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '5px 10px', color: 'var(--text-muted)' }}
                title="Clear revision history stack"
              >
                <Trash2 size={13} /> Clear History
              </button>
            )}
            <button onClick={onClose} className="btn-icon" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY (2 COLUMNS: TIMELINE LIST + REVISION PREVIEW) */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          overflow: 'hidden',
          minHeight: '440px',
          maxHeight: 'calc(90vh - 140px)'
        }}>
          {/* TIMELINE LIST */}
          <div style={{
            borderRight: '1px solid var(--border-color)',
            background: 'var(--bg-base)',
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <Clock size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                No revisions recorded yet. Revisions are created automatically whenever you use AI, regenerate sections, or save changes.
              </div>
            ) : (
              history.map((rev, idx) => {
                const isSelected = selectedRevisionIdx === idx;
                const wordCount = (rev.content || '').trim() ? rev.content.trim().split(/\s+/).length : 0;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedRevisionIdx(idx)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--bg-surface-hover)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getActionIcon(rev.label)}
                        <strong style={{ fontSize: '0.8rem', color: isSelected ? '#fff' : 'var(--text-main)' }}>
                          {rev.label || `Snapshot #${idx + 1}`}
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        #{idx + 1}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>🕒 {formatTime(rev.timestamp)}</span>
                      <span>📝 {wordCount} words</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PREVIEW PANE */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            overflow: 'hidden'
          }}>
            {selectedRev ? (
              <>
                {/* PREVIEW TOOLBAR */}
                <div style={{
                  padding: '10px 16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                      Previewing Revision: {selectedRev.label}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      ({(selectedRev.content || '').split(/\s+/).filter(Boolean).length} words)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-base)', padding: '2px', borderRadius: '4px' }}>
                      <button
                        onClick={() => setPreviewTab('preview')}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          border: 'none',
                          borderRadius: '3px',
                          background: previewTab === 'preview' ? 'var(--primary-accent)' : 'transparent',
                          color: previewTab === 'preview' ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Formatted
                      </button>
                      <button
                        onClick={() => setPreviewTab('raw')}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          border: 'none',
                          borderRadius: '3px',
                          background: previewTab === 'raw' ? 'var(--primary-accent)' : 'transparent',
                          color: previewTab === 'raw' ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Markdown Raw
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        onRestore(selectedRev.content, selectedRev.label);
                        onClose();
                      }}
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.75rem', gap: '6px' }}
                    >
                      <RotateCcw size={13} /> Restore This Snapshot
                    </button>
                  </div>
                </div>

                {/* PREVIEW CONTENT */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '24px',
                  lineHeight: '1.7'
                }}>
                  {previewTab === 'preview' ? (
                    <div className="markdown-preview" style={{ color: '#F3F4F6', fontSize: '0.92rem' }}>
                      <ReactMarkdown>{selectedRev.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <pre style={{
                      fontFamily: 'monospace',
                      fontSize: '0.82rem',
                      whiteSpace: 'pre-wrap',
                      color: '#D1D5DB',
                      margin: 0
                    }}>
                      {selectedRev.content}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}>
                Select a revision from the left to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
