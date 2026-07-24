const express = require('express');
const path = require('path');
const { analyzeHtml, validateUrl } = require('./lib/analyze');

const app = express();
const PORT = process.env.PORT || 3000;

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 3 * 1024 * 1024; // 3 MB is plenty for any sane HTML page

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/audit', async (req, res) => {
  let url;
  try {
    url = validateUrl(req.query.url);
  } catch (err) {
    return res.status(400).json({ error: err });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const started = Date.now();

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'PagePulse/1.0 (+https://digitalheroesco.com)' },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: { code: 'TIMEOUT', message: `The page took longer than ${FETCH_TIMEOUT_MS / 1000}s to respond.` },
      });
    }
    return res.status(502).json({
      error: { code: 'FETCH_FAILED', message: 'Could not reach that URL. Check the address and try again.' },
    });
  }

  const responseTimeMs = Date.now() - started;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    clearTimeout(timer);
    return res.status(415).json({
      error: {
        code: 'NOT_HTML',
        message: `That URL returned "${contentType.split(';')[0] || 'unknown'}", not an HTML page.`,
      },
    });
  }

  let html;
  try {
    // Stream with a size cap so a huge or malicious response can't eat memory.
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    html = Buffer.concat(chunks).toString('utf-8');
  } catch (err) {
    return res.status(502).json({
      error: { code: 'READ_FAILED', message: 'The page started responding but the download failed.' },
    });
  } finally {
    clearTimeout(timer);
  }

  const report = analyzeHtml(html);
  res.json({
    url: response.url, // final URL after redirects
    httpStatus: response.status,
    responseTimeMs,
    ...report,
  });
});

app.listen(PORT, () => console.log(`Page Pulse running on http://localhost:${PORT}`));
