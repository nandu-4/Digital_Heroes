const { test } = require('node:test');
const assert = require('node:assert');
const { analyzeHtml, validateUrl } = require('../lib/analyze');

// --- analyzeHtml: happy path ---

test('parses a well-formed page correctly', () => {
  const html = `
    <html>
      <head>
        <title> My Store </title>
        <meta name="description" content="Best store online.">
      </head>
      <body>
        <h1>Welcome</h1>
        <img src="a.jpg" alt="Product A">
        <img src="b.jpg">
        <img src="c.jpg" alt="">
        <p>one two three four five</p>
        <script>var junk = "should not count";</script>
      </body>
    </html>`;
  const r = analyzeHtml(html);
  assert.strictEqual(r.title, 'My Store');
  assert.strictEqual(r.metaDescription, 'Best store online.');
  assert.strictEqual(r.h1Count, 1);
  assert.strictEqual(r.imageCount, 3);
  assert.strictEqual(r.imagesMissingAlt, 2); // no alt + empty alt both count
  assert.strictEqual(r.wordCount, 6); // "Welcome" + 5 words; script text excluded
});

// --- analyzeHtml: failure / edge cases ---

test('handles a page with nothing in it', () => {
  const r = analyzeHtml('<html><head></head><body></body></html>');
  assert.strictEqual(r.title, null);
  assert.strictEqual(r.metaDescription, null);
  assert.strictEqual(r.h1Count, 0);
  assert.strictEqual(r.imagesMissingAlt, 0);
  assert.strictEqual(r.wordCount, 0);
});

test('does not crash on garbage that is not HTML', () => {
  const r = analyzeHtml('{"this": "is json, not html"}');
  assert.strictEqual(r.title, null);
  assert.strictEqual(r.h1Count, 0);
  assert.ok(r.wordCount >= 0);
});

test('counts multiple h1s and case-insensitive meta name', () => {
  const html = `
    <head><META NAME="Description" content="hi"></head>
    <body><h1>a</h1><h1>b</h1><h1>c</h1></body>`;
  const r = analyzeHtml(html);
  assert.strictEqual(r.h1Count, 3);
  assert.strictEqual(r.metaDescription, 'hi');
});

// --- validateUrl ---

test('accepts a normal https URL', () => {
  assert.strictEqual(validateUrl('https://example.com/page').hostname, 'example.com');
});

test('adds https:// when the scheme is missing', () => {
  assert.strictEqual(validateUrl('example.com').href, 'https://example.com/');
});

test('rejects empty and malformed input', () => {
  for (const bad of ['', '   ', null, undefined, 'ht!tp://x', 'https://']) {
    assert.throws(() => validateUrl(bad), (e) => e.code === 'INVALID_URL');
  }
});

test('rejects non-http protocols', () => {
  assert.throws(() => validateUrl('ftp://example.com'), (e) => e.code === 'INVALID_URL');
  assert.throws(() => validateUrl('file:///etc/passwd'), (e) => e.code === 'INVALID_URL');
});

test('rejects local and private addresses', () => {
  for (const bad of ['http://localhost:3000', 'http://127.0.0.1', 'http://192.168.1.1', 'http://10.0.0.5', 'http://172.16.0.1']) {
    assert.throws(() => validateUrl(bad), (e) => e.code === 'INVALID_URL');
  }
});
