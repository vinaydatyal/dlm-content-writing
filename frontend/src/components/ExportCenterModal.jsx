import React, { useState } from 'react';
import { 
  Download, Copy, Check, FileText, Code, FileCode, CheckCircle2, 
  X, Layers, Globe, Sparkles, Share2
} from 'lucide-react';

export default function ExportCenterModal({
  isOpen,
  project,
  article,
  onClose,
  onExportDownload
}) {
  const [activeTab, setActiveTab] = useState('formats'); // 'formats' | 'schema'
  const [copiedKey, setCopiedKey] = useState(null);

  if (!isOpen) return null;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyRichText = async () => {
    try {
      // Create HTML blob for clipboard
      const contentHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
          ${article?.content ? article.content.replace(/\n\n/g, '<p></p>').replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^### (.+)$/gm, '<h3>$1</h3>') : ''}
        </div>
      `;
      const blob = new Blob([contentHtml], { type: 'text/html' });
      const textBlob = new Blob([article?.content || ''], { type: 'text/plain' });
      const clipboardItem = new ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob
      });
      await navigator.clipboard.write([clipboardItem]);
      setCopiedKey('rich_text');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      // Fallback to plain text
      navigator.clipboard.writeText(article?.content || '');
      setCopiedKey('rich_text');
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const articleSchemaString = article?.article_schema 
    ? (typeof article.article_schema === 'string' ? article.article_schema : JSON.stringify(article.article_schema, null, 2))
    : '';

  const faqSchemaString = article?.faq_schema && article.faq_schema.length > 0
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": (typeof article.faq_schema === 'string' ? JSON.parse(article.faq_schema) : article.faq_schema).map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      }, null, 2)
    : '';

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
        maxWidth: '850px',
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
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Download size={20} color="var(--primary-accent)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#fff' }}>
                1-Click Multi-Format Export Center
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Export for WordPress, Google Docs, Notion, Word, or direct SEO HTML.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* TABS */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 24px 0',
          background: 'rgba(0,0,0,0.1)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setActiveTab('formats')}
            style={{
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'formats' ? '#fff' : 'var(--text-muted)',
              borderBottom: activeTab === 'formats' ? '2px solid var(--primary-accent)' : '2px solid transparent'
            }}
          >
            📦 Download Formats & Copying
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            style={{
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'schema' ? '#10B981' : 'var(--text-muted)',
              borderBottom: activeTab === 'schema' ? '2px solid #10B981' : '2px solid transparent'
            }}
          >
            🏷️ JSON-LD Schema Snippets
          </button>
        </div>

        {/* CONTENT */}
        <div style={{
          padding: '24px',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {activeTab === 'formats' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {/* GOOGLE DOCS / NOTION RICH TEXT */}
              <div style={{
                padding: '18px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Copy size={18} color="var(--primary-accent)" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff' }}>Copy Rich Text</h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Paste in Google Docs / Notion</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Copies formatted headings, bold words, and bullet lists directly to clipboard for direct pasting.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleCopyRichText}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px' }}
                >
                  {copiedKey === 'rich_text' ? <><Check size={14} /> Copied to Clipboard!</> : <><Copy size={14} /> Copy Rich Text</>}
                </button>
              </div>

              {/* CLEAN HTML WITH SCHEMA */}
              <div style={{
                padding: '18px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code size={18} color="#38BDF8" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff' }}>HTML Document</h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Complete semantic web page</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Standalone `.html` file complete with SEO meta tags, OpenGraph preview, and Schema.org markup.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => onExportDownload('html')}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px', color: '#38BDF8', borderColor: 'rgba(56,189,248,0.4)' }}
                >
                  <Download size={14} /> Download .html
                </button>
              </div>

              {/* WORD DOCUMENT */}
              <div style={{
                padding: '18px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#F59E0B" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff' }}>Word Document (.docx)</h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ready for client delivery</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Formatted DOCX file compatible with Microsoft Word, LibreOffice, and Google Drive upload.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => onExportDownload('docx')}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.4)' }}
                >
                  <Download size={14} /> Download .docx
                </button>
              </div>

              {/* RAW MARKDOWN */}
              <div style={{
                padding: '18px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={18} color="#A78BFA" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff' }}>Markdown (.md)</h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Git & CMS friendly</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Raw Markdown source with headers, lists, and tables intact for developers and static site generators.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const blob = new Blob([article?.content || ''], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${project?.keyword ? project.keyword.replace(/\s+/g, '_') : 'article'}.md`;
                    a.click();
                  }}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px', color: '#A78BFA', borderColor: 'rgba(167,139,250,0.4)' }}
                >
                  <Download size={14} /> Download .md
                </button>
              </div>
            </div>
          )}

          {activeTab === 'schema' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* FAQ SCHEMA */}
              <div style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#10B981' }}>
                    ❓ FAQPage JSON-LD Schema
                  </h4>
                  <button
                    onClick={() => handleCopy(faqSchemaString, 'faq_schema')}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                    disabled={!faqSchemaString}
                  >
                    {copiedKey === 'faq_schema' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Schema</>}
                  </button>
                </div>
                {faqSchemaString ? (
                  <pre style={{
                    margin: 0,
                    padding: '12px',
                    background: 'var(--bg-base)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    color: '#A7F3D0',
                    fontFamily: 'monospace',
                    maxHeight: '160px',
                    overflowY: 'auto'
                  }}>
                    {faqSchemaString}
                  </pre>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No FAQ schema generated yet. Run Final Polish in the editor to generate one automatically.
                  </div>
                )}
              </div>

              {/* ARTICLE SCHEMA */}
              <div style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#38BDF8' }}>
                    📰 Article / BlogPosting Schema
                  </h4>
                  <button
                    onClick={() => handleCopy(articleSchemaString, 'article_schema')}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                    disabled={!articleSchemaString}
                  >
                    {copiedKey === 'article_schema' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Schema</>}
                  </button>
                </div>
                {articleSchemaString ? (
                  <pre style={{
                    margin: 0,
                    padding: '12px',
                    background: 'var(--bg-base)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    color: '#BAE6FD',
                    fontFamily: 'monospace',
                    maxHeight: '160px',
                    overflowY: 'auto'
                  }}>
                    {articleSchemaString}
                  </pre>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No Article schema generated yet. Run Final Polish to generate structured data.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
