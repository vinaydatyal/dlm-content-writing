// backend/routes/export.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = require('docx');

const router = express.Router();
router.use(authenticate);

// Export as DOCX
router.post('/docx', async (req, res) => {
  const { title, content, meta_title, meta_description } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  try {
    const lines = content.split('\n').filter(l => l.trim());
    const children = [];

    // Add meta info at top
    if (meta_title) {
      children.push(new Paragraph({
        text: `SEO Title: ${meta_title}`,
        heading: HeadingLevel.HEADING_1,
        shading: { fill: 'E8F4F8' },
      }));
    }
    if (meta_description) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Meta Description: ', bold: true }),
          new TextRun({ text: meta_description }),
        ],
        spacing: { after: 300 },
      }));
    }

    // Parse markdown-like content
    for (const line of lines) {
      if (line.startsWith('# ')) {
        children.push(new Paragraph({
          text: line.replace(/^# /, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }));
      } else if (line.startsWith('## ')) {
        children.push(new Paragraph({
          text: line.replace(/^## /, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }));
      } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
          text: line.replace(/^### /, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(new Paragraph({
          text: line.replace(/^[-*] /, ''),
          bullet: { level: 0 },
        }));
      } else if (line.trim()) {
        // Parse bold text
        const parts = line.split(/(\*\*[^*]+\*\*)/);
        const runs = parts.map(part => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return new TextRun({ text: part.slice(2, -2), bold: true });
          }
          return new TextRun({ text: part });
        });
        children.push(new Paragraph({ children: runs, spacing: { after: 150 } }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${(title || 'article').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('DOCX export error:', err);
    res.status(500).json({ error: 'Failed to export DOCX: ' + err.message });
  }
});

// Export as HTML
router.post('/html', (req, res) => {
  const { title, content, meta_title, meta_description, faq_schema, keyword, article_schema } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  try {
    const htmlContent = markdownToHtml(content);

    const faqJsonLd = faq_schema && faq_schema.length > 0 ? `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    ${faq_schema.map(f => `{
      "@type": "Question",
      "name": "${escapeHtml(f.question)}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${escapeHtml(f.answer)}"
      }
    }`).join(',\n    ')}
  ]
}
</script>` : '';

    const articleSchemaBlock = article_schema ? `
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", ...article_schema }, null, 2)}
</script>` : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta_title || title || keyword || 'Article')}</title>
  <meta name="description" content="${escapeHtml(meta_description || '')}">
  ${faqJsonLd}
  ${articleSchemaBlock}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; line-height: 1.7; }
    h1 { font-size: 2rem; color: #1a1a2e; margin-bottom: 1.5rem; }
    h2 { font-size: 1.5rem; color: #16213e; margin: 2rem 0 1rem; border-bottom: 2px solid #e8e8e8; padding-bottom: 0.5rem; }
    h3 { font-size: 1.2rem; color: #0f3460; margin: 1.5rem 0 0.75rem; }
    p { margin-bottom: 1rem; }
    ul, ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
    strong { color: #1a1a2e; }
    .meta-info { background: #f0f4ff; border-left: 4px solid #6366f1; padding: 1rem; margin-bottom: 2rem; border-radius: 4px; font-size: 0.9rem; color: #666; }
  </style>
</head>
<body>
  ${meta_title ? `<div class="meta-info"><strong>SEO Title:</strong> ${escapeHtml(meta_title)}<br><strong>Meta Description:</strong> ${escapeHtml(meta_description || '')}</div>` : ''}
  ${htmlContent}
</body>
</html>`;

    const filename = `${(title || 'article').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err) {
    console.error('HTML export error:', err);
    res.status(500).json({ error: 'Failed to export HTML' });
  }
});

function markdownToHtml(markdown) {
  let html = markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n+/g, '\n</p><p>\n')
    .replace(/^(?!<[hul])/gm, '');

  return `<p>${html}</p>`.replace(/<p>\s*<\/p>/g, '');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;
