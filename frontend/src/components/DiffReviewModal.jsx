import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Check, X, Copy, Columns, FileText, ArrowRight, ArrowLeftRight, 
  Sparkles, Plus, RefreshCw, Layers, CheckCircle2, ChevronRight
} from 'lucide-react';

// Word-level diff helper for visual highlighting
function computeWordDiff(oldText = '', newText = '') {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  
  // Simple LCS / diff array for highlighting additions and deletions
  // Fast token comparison
  const oldSet = new Set(oldWords.map(w => w.trim().toLowerCase()).filter(Boolean));
  const newSet = new Set(newWords.map(w => w.trim().toLowerCase()).filter(Boolean));

  const diffOld = oldWords.map((word, i) => {
    const isSpace = /^\s+$/.test(word);
    if (isSpace) return { text: word, type: 'space' };
    const clean = word.trim().toLowerCase();
    const isRemoved = !newSet.has(clean);
    return { text: word, type: isRemoved ? 'removed' : 'neutral' };
  });

  const diffNew = newWords.map((word, i) => {
    const isSpace = /^\s+$/.test(word);
    if (isSpace) return { text: word, type: 'space' };
    const clean = word.trim().toLowerCase();
    const isAdded = !oldSet.has(clean);
    return { text: word, type: isAdded ? 'added' : 'neutral' };
  });

  return { diffOld, diffNew };
}

export default function DiffReviewModal({
  isOpen,
  title = 'AI Content Revision Review',
  subtitle = 'Compare the existing draft with the AI generated revision before applying.',
  originalContent = '',
  newContent = '',
  onAccept,
  onAppend,
  onDiscard,
  onCopy
}) {
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'unified' | 'preview'
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const oldWordCount = (originalContent || '').trim() ? originalContent.trim().split(/\s+/).length : 0;
  const newWordCount = (newContent || '').trim() ? newContent.trim().split(/\s+/).length : 0;
  const wordDelta = newWordCount - oldWordCount;

  const oldCharCount = (originalContent || '').length;
  const newCharCount = (newContent || '').length;

  const { diffOld, diffNew } = computeWordDiff(originalContent, newContent);

  const handleCopy = () => {
    navigator.clipboard.writeText(newContent);
    setCopied(true);
    if (onCopy) onCopy();
    setTimeout(() => setCopied(false), 2000);
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
        maxWidth: '1150px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        padding: 0
      }}>
        {/* MODAL HEADER */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--primary-accent)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                {title}
              </h3>
              <span style={{
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: wordDelta >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: wordDelta >= 0 ? '#10B981' : '#EF4444',
                fontWeight: 600,
                border: `1px solid ${wordDelta >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
              }}>
                {wordDelta >= 0 ? `+${wordDelta} words` : `${wordDelta} words`}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          </div>

          {/* VIEW SWITCHER TABS */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-base)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setViewMode('split')}
              style={{
                padding: '5px 10px',
                fontSize: '0.75rem',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === 'split' ? 'var(--primary-accent)' : 'transparent',
                color: viewMode === 'split' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 500
              }}
            >
              <Columns size={13} /> Side-by-Side (2 Views)
            </button>
            <button
              onClick={() => setViewMode('preview')}
              style={{
                padding: '5px 10px',
                fontSize: '0.75rem',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === 'preview' ? 'var(--primary-accent)' : 'transparent',
                color: viewMode === 'preview' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 500
              }}
            >
              <FileText size={13} /> Rendered Preview
            </button>
          </div>
        </div>

        {/* STATS DELTA STRIP */}
        <div style={{
          padding: '8px 24px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '24px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            Original: <strong style={{ color: '#fff' }}>{oldWordCount} words</strong> ({oldCharCount} chars)
          </div>
          <div>
            AI Version: <strong style={{ color: '#10B981' }}>{newWordCount} words</strong> ({newCharCount} chars)
          </div>
          <div>
            Net Difference: <strong style={{ color: wordDelta >= 0 ? '#10B981' : '#F59E0B' }}>
              {wordDelta > 0 ? `+${wordDelta}` : wordDelta} words
            </strong>
          </div>
        </div>

        {/* COMPARISON BODY */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          maxHeight: 'calc(92vh - 220px)',
          background: 'var(--bg-base)'
        }}>
          {viewMode === 'split' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              height: '100%',
              minHeight: '380px'
            }}>
              {/* LEFT: ORIGINAL */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.03)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#EF4444' }}>
                      Current Draft (Original)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {oldWordCount} words
                  </span>
                </div>

                <div style={{
                  padding: '16px',
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  maxHeight: '420px',
                  color: '#D1D5DB'
                }}>
                  {originalContent ? (
                    diffOld.map((chunk, i) => (
                      <span
                        key={i}
                        style={{
                          backgroundColor: chunk.type === 'removed' ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                          color: chunk.type === 'removed' ? '#FCA5A5' : 'inherit',
                          textDecoration: chunk.type === 'removed' ? 'line-through' : 'none',
                          borderRadius: '2px',
                          padding: chunk.type === 'removed' ? '1px 2px' : '0'
                        }}
                      >
                        {chunk.text}
                      </span>
                    ))
                  ) : (
                    <em style={{ color: 'var(--text-muted)' }}>[Section was empty or newly generated]</em>
                  )}
                </div>
              </div>

              {/* RIGHT: AI VERSION */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.03)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#10B981' }}>
                      AI Generated Version (Revision)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {newWordCount} words
                    </span>
                    <button
                      onClick={handleCopy}
                      className="btn-icon"
                      title="Copy new version"
                      style={{ padding: '3px', color: copied ? '#10B981' : 'var(--text-muted)' }}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  maxHeight: '420px',
                  color: '#F3F4F6'
                }}>
                  {diffNew.map((chunk, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: chunk.type === 'added' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                        color: chunk.type === 'added' ? '#6EE7B7' : 'inherit',
                        fontWeight: chunk.type === 'added' ? 600 : 'normal',
                        borderRadius: '2px',
                        padding: chunk.type === 'added' ? '1px 2px' : '0'
                      }}
                    >
                      {chunk.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'preview' && (
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px 32px',
              color: '#F3F4F6',
              lineHeight: '1.8',
              maxHeight: '440px',
              overflowY: 'auto'
            }} className="markdown-preview">
              <ReactMarkdown>{newContent}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <button
            className="btn btn-secondary"
            onClick={onDiscard}
            style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '8px 16px' }}
          >
            <X size={15} /> Keep Original (Discard AI)
          </button>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {onAppend && originalContent && (
              <button
                className="btn btn-secondary"
                onClick={() => onAppend(newContent)}
                style={{ fontSize: '0.82rem', padding: '8px 16px', color: '#38BDF8', borderColor: 'rgba(56,189,248,0.4)' }}
              >
                <Plus size={15} /> Append Below Original
              </button>
            )}

            <button
              className="btn btn-primary"
              onClick={() => onAccept(newContent)}
              style={{
                fontSize: '0.85rem',
                padding: '8px 20px',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                borderColor: '#10B981',
                boxShadow: '0 4px 14px rgba(16,185,129,0.3)'
              }}
            >
              <CheckCircle2 size={16} /> Accept & Replace Section
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
