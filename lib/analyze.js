const cheerio = require('cheerio');

// Pure parsing logic — no network, so it's trivially testable.
function analyzeHtml(html) {
  const $ = cheerio.load(html || '');

  const title = $('head title').first().text().trim() || null;
  const metaDescription =
    $('head meta[name="description" i]').attr('content')?.trim() || null;

  const h1Count = $('h1').length;

  let imagesMissingAlt = 0;
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt.trim() === '') imagesMissingAlt++;
  });
  const imageCount = $('img').length;

  // Visible text only: drop script/style/noscript before counting words.
  $('script, style, noscript').remove();
  const text = $('body').length ? $('body').text() : $.root().text();
  const words = text.split(/\s+/).filter(Boolean);

  return {
    title,
    metaDescription,
    h1Count,
    imageCount,
    imagesMissingAlt,
    wordCount: words.length,
  };
}

// Returns a URL object or throws { code, message }.
function validateUrl(input) {
  if (!input || typeof input !== 'string' || !input.trim()) {
    throw { code: 'INVALID_URL', message: 'Provide a URL to audit.' };
  }
  let raw = input.trim();
  // Be forgiving: people paste "example.com" without a scheme — but only
  // prepend one when no scheme is present, so "ftp://x" stays rejectable.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = 'https://' + raw;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw { code: 'INVALID_URL', message: `"${input}" is not a valid URL.` };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw { code: 'INVALID_URL', message: 'Only http and https URLs are supported.' };
  }
  const host = url.hostname.toLowerCase();
  // Public web pages only: hostname must be a dotted domain or IPv4 address.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) {
    throw { code: 'INVALID_URL', message: `"${input}" does not look like a public web address.` };
  }
  // ponytail: basic SSRF guard by hostname only; resolve DNS and re-check the IP if this ever runs with internal network access
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.endsWith('.local') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw { code: 'INVALID_URL', message: 'Local and private addresses cannot be audited.' };
  }
  return url;
}

module.exports = { analyzeHtml, validateUrl };
