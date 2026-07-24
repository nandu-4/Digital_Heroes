# Page Pulse

A small web tool that audits any URL and reports its on-page health: HTTP status, response time, title, meta description, H1 count, images missing alt text, and word count.

Built for the **Digital Heroes** SDE internship task (Task A + Task B).

## Live demo

> **https://digital-heroes-718u.onrender.com**
>
> (Free-tier hosting sleeps when idle — the first visit may take ~30 seconds to wake up.)

## Tech stack

- **Node.js 18+** — uses the built-in `fetch` and `node:test`, so there is no test framework or HTTP client dependency.
- **Express** — serves the API and the static frontend from one process (one thing to deploy).
- **Cheerio** — battle-tested HTML parsing.
- **Vanilla HTML/CSS/JS frontend** — a single `public/index.html`, no build step.

## Project structure

```
page-pulse/
├── server.js            # Express app: /api/audit endpoint + static file serving
├── lib/
│   └── analyze.js       # Pure functions: HTML analysis + URL validation (no network)
├── public/
│   └── index.html       # Frontend (single file, no build step)
├── test/
│   └── analyze.test.js  # Tests for the parsing and validation logic
├── package.json
└── README.md
```

## Setup

```bash
npm install
npm start          # → http://localhost:3000
npm test           # run the test suite
```

No environment variables required. `PORT` is respected if the host sets one.

## API contract

### `GET /api/audit?url=<url>`

Audits the given URL. A missing scheme is tolerated (`example.com` → `https://example.com`).

**Success — `200 OK`**

```json
{
  "url": "https://example.com/",
  "httpStatus": 200,
  "responseTimeMs": 312,
  "title": "Example Domain",
  "metaDescription": null,
  "h1Count": 1,
  "imageCount": 4,
  "imagesMissingAlt": 2,
  "wordCount": 187
}
```

Notes:
- `url` is the **final** URL after redirects.
- `title` / `metaDescription` are `null` when absent, never empty strings.
- An image with `alt=""` counts as missing (empty alt on a content image is an accessibility gap).
- `wordCount` counts visible text only — `<script>`, `<style>`, and `<noscript>` content is excluded.

**Errors — always `{ "error": { "code", "message" } }`**

| HTTP | `code`         | When |
|------|----------------|------|
| 400  | `INVALID_URL`  | Empty/malformed URL, non-http(s) scheme, or a local/private address |
| 415  | `NOT_HTML`     | The URL responded with a non-HTML content type (PDF, JSON, image…) |
| 502  | `FETCH_FAILED` | DNS failure, connection refused, TLS error, etc. |
| 502  | `READ_FAILED`  | Connection dropped mid-download |
| 504  | `TIMEOUT`      | The page took longer than 10 seconds |

The server never crashes on bad input — every failure path returns a structured JSON error.

## Design decisions (and why)

1. **Parsing logic is a pure function, separated from the network layer.**
   `lib/analyze.js` takes a string of HTML and returns a report — no fetching, no Express. That is why the tests run in milliseconds with zero mocking: the risky, logic-heavy part of the app (parsing) is fully covered without ever touching the network. `server.js` only handles I/O concerns (timeouts, size caps, content types).

2. **`GET` with a query parameter instead of `POST` with a body.**
   An audit is a read operation with no side effects, so `GET` is semantically correct, trivially testable from a browser address bar or `curl`, and cache-friendly. A `POST` would add a JSON body parser and buy nothing.

3. **Defensive fetching: 10s timeout, 3 MB streamed size cap, content-type check, and a private-address block.**
   The server fetches attacker-controlled URLs by definition. `AbortController` bounds the time, streaming with a byte cap bounds the memory, the content-type check refuses to parse a 500 MB video as HTML, and rejecting `localhost`/private-range hosts prevents the endpoint from being used to probe the internal network (SSRF).

## What I'd change with another day

- Resolve DNS before fetching and re-check the resolved IP against private ranges (the current SSRF guard checks the hostname only, so a DNS record pointing at a private IP would slip through).
- Follow-up checks: canonical tag, Open Graph tags, and a broken-link sample.
- A tiny in-memory LRU cache so repeated audits of the same URL within a minute don't re-fetch.

## AI usage note

I used Claude to scaffold the Express boilerplate and the CSS for the report cards, then reviewed and reworked the output: I separated the parsing logic into a pure module so it could be tested without mocks, added the streamed size cap and private-address block after thinking through how the endpoint could be abused, and rewrote the error contract so every failure returns the same `{ error: { code, message } }` shape.

---

*Built for [Digital Heroes](https://digitalheroesco.com) Training Task.*
