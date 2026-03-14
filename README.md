## AI Knowledge Saver v2

AI Knowledge Saver v2 builds on v1 and adds a production‑grade metadata pipeline plus a much better authentication story for the browser extension. The extension now sends rich, platform‑aware metadata to the backend, which then runs a multi‑layer enrichment pipeline (DOM → OpenGraph → headless browser) and stores a normalized record in MongoDB. The extension also no longer needs manually pasted JWTs – it uses a secure, cookie‑based session that’s shared with the web dashboard.

> **Note:** v1 behavior (JWT‑based `/api/items` for the SPA dashboard) is still supported and unchanged. The v2 changes are additive: a new `/save` pipeline, new metadata schema, and new extension UX.

---

### What’s New in v2

- **Three‑layer metadata extraction (Pocket / Notion / Readwise style)**
  - **Layer 1 – Extension DOM extractor**
    - Implemented in `extension/main/contentScript.js`.
    - Runs in the page and extracts:
      - `title`, `description`, `content`, `image`, `favicon`, `author`, `authorImage`, `timestamp`, `url`, `platform`.
    - Platform detection:
      - `twitter` for `twitter.com` / `x.com`.
      - `youtube` for `youtube.com` / `youtu.be`.
      - `linkedin` for `linkedin.com`.
      - `website` for everything else.
    - Platform‑specific extraction:
      - **X/Twitter**: tweet text (`data-testid="tweetText"`), username, profile image, timestamp.
      - **YouTube**: title, description, thumbnail (`og:image` or `i.ytimg.com/vi/.../maxresdefault.jpg`), channel name.
      - **LinkedIn**: post text, author name, author profile image, timestamp, preview image (with best‑effort selectors for feed posts).
    - Generic fallback:
      - Picks the first reasonable `<img>` as `image` when OG/Twitter image tags are missing.
      - Ensures `favicon` is always set (`/favicon.ico` fallback).
    - Output shape:
      ```js
      {
        source: "extension_dom",
        platform: "twitter" | "youtube" | "linkedin" | "website",
        title,
        description,
        content,
        image,
        favicon,
        author,
        authorImage,
        timestamp,
        url
      }
      ```

  - **Layer 2 – Server OpenGraph scraper**
    - Implemented in `server/src/utils/openGraphScraper.js` using **axios** + **cheerio**.
    - Fetches the URL and extracts meta tags:
      - `og:title`, `og:description`, `og:image`, `twitter:title`, `twitter:description`, `twitter:image`, `meta[name="description"]`, `<title>`, and `link[rel="icon"]`.
    - Returns:
      ```js
      {
        source: "server_scraper",
        title,
        description,
        image,
        favicon
      }
      ```

  - **Layer 3 – Headless browser scraper**
    - Implemented in `server/src/utils/headlessScraper.js` using **Playwright** (`chromium`).
    - Flow:
      1. Launch browser.
      2. Open URL.
      3. Wait for `networkidle`.
      4. Evaluate DOM inside the page using platform‑specific selectors (similar to the extension) plus OG/Twitter meta tags.
      5. Extract `title`, `description`, `image`, `content`, `author`, `authorImage`, `timestamp`, `favicon`.
    - Returns:
      ```js
      {
        source: "headless_browser",
        title,
        description,
        image,
        content,
        author,
        authorImage,
        timestamp,
        favicon
      }
      ```

- **Metadata merge service**
  - Implemented in `server/src/utils/metadataMerge.js`.
  - Combines the three layers with a strict priority:
    - Extension DOM (Layer 1) → OpenGraph (Layer 2) → Headless (Layer 3).
  - Example resolution:
    - `final.title = extension.title || og.title || headless.title`
    - `final.description = extension.description || og.description || headless.description`
    - Similar logic for `content`, `image`, `favicon`, `author`, `authorImage`, `timestamp`.
  - Ensures **no empty metadata**:
    - If `title` is missing, falls back to `url`.
    - If `description` is missing, falls back to `title`.
  - Returns:
    ```js
    {
      final: {
        title,
        description,
        content,
        image,
        favicon,
        author,
        authorImage,
        timestamp,
        platform
      },
      metadataSource: "extension_dom" | "server_scraper" | "headless_browser" | "unknown"
    }
    ```

- **Background enrichment with BullMQ + Redis**
  - Implemented in `server/src/utils/metadataQueue.js`.
  - New queue: `metadata-enrichment` using **BullMQ**.
  - Flow:
    1. User saves a link from the extension.
    2. Backend immediately creates an `Item` document with Layer 1 data.
    3. Enqueues a job with `{ itemId, url, extensionMetadata }`.
    4. Worker (`startMetadataWorker`) consumes jobs:
       - Runs OpenGraph scraper.
       - If OG is incomplete or missing, runs headless Playwright scraper.
       - Merges all three layers using `metadataMerge`.
       - Updates the existing `Item` with enriched metadata and `metadataSource`.
  - The queue is **optional**:
    - If `REDIS_URL` is not set, the code degrades gracefully:
      - Save still works.
      - Metadata jobs are skipped with a warning instead of crashing the server.

- **New metadata schema (MongoDB)**
  - `server/src/models/Item.js` extended to support richer metadata:
    ```js
    {
      title: String,
      url: String,
      description: String,
      content: String,
      domain: String,
      favicon: String,
      image: String,
      type: "article" | "video" | "tweet",
      platform: "website" | "twitter" | "youtube" | "linkedin" | ...,
      extraMetadata: Mixed,
      author: String,
      authorImage: String,
      userId: ObjectId,
      createdAt: Date,
      updatedAt: Date,
      metadataSource: String
    }
    ```
  - Backwards compatible with v1: existing fields like `type`, `domain`, and `extraMetadata` remain, but richer fields (`content`, `image`, `platform`, `author`, `authorImage`, `metadataSource`) have been added.

- **Dedicated `/save` endpoint for the extension**
  - New route: `server/src/routes/save.js`.
  - Uses **cookie‑based session auth** via `requireSession` middleware (Redis‑backed session store).
  - Accepts:
    ```json
    {
      "extensionMetadata": {
        "source": "extension_dom",
        "platform": "twitter",
        "title": "...",
        "description": "...",
        "content": "...",
        "image": "...",
        "favicon": "...",
        "author": "...",
        "authorImage": "...",
        "timestamp": "...",
        "url": "..."
      }
    }
    ```
  - Creates an `Item` document immediately (Layer 1) and enqueues a BullMQ enrichment job for Layers 2 and 3.
  - Also exposes `GET /save/status` so the extension can check whether the user is “connected” (i.e. has a valid session cookie).

- **Cookie‑based session authentication for the extension**
  - New session store: `server/src/utils/sessionStore.js` (Redis‑backed).
    - `createSession(userId)` → generates opaque `session` id, stores `{ userId, createdAt }` in Redis.
    - `getSession(sessionId)` → loads and parses the entry.
    - `destroySession(sessionId)` → deletes it.
  - New middleware: `server/src/middleware/sessionAuth.js`.
    - Reads `req.cookies.session`.
    - Loads session from Redis.
    - If valid, sets `req.auth.userId` and proceeds.
    - Otherwise returns `401 Not authenticated`.
  - Login (`POST /api/auth/login`) now:
    - Still issues access + refresh JWTs for the SPA (v1 behavior).
    - Additionally creates a `session` cookie:
      - `HttpOnly`.
      - `Secure` in production.
      - `SameSite=None` in production (for cross‑site extension requests), `SameSite=Lax` in development to work on `http://localhost`.
  - Logout (`POST /api/auth/logout`) now:
    - Clears the `session` cookie and destroys the Redis session in addition to revoking JWTs.

- **Extension v2 UX and network flow**
  - Popup UI (`extension/main/popup.html` + `popup.js`):
    - Token input has been removed.
    - New UX:
      - **“Connect Extension with Website”** button:
        - Opens the dashboard (`http://localhost:5173/dashboard` by default) so the user can log in.
        - The act of logging in sets the `session` cookie, which the extension then uses automatically.
      - **“Save Current Page”** button:
        - Sends `extensionMetadata` to `POST http://localhost:4000/save` with `credentials: 'include'`.
    - Connection status:
      - On popup open, the extension calls `GET /save/status` with cookies.
      - If the session is valid, the connect button shows **“Connected”** and is disabled.
      - If not, it shows **“Connect Extension with Website”**.
    - Error handling:
      - If `/save` returns 401 → shows “Please login to the dashboard first, then try again.”
      - Other errors → “Failed to save page.” with console details.

- **CORS and host permissions updates**
  - **Server CORS** (`server/src/app.js`):
    - `FRONTEND_ORIGIN` (`http://localhost:5173`) and optional `EXTENSION_ORIGIN` are allowed with `credentials: true`.
  - **Extension manifest** (`extension/main/manifest.json`):
    - `host_permissions` now include both:
      - `http://localhost:4000/*` (dev).
      - `https://api.yoursite.com/*` (prod).

---

## AI Knowledge Saver v1

AI Knowledge Saver v1 is a full‑stack web application plus Chrome extension that lets you quickly save links and content (articles, tweets, videos, etc.) into your own personal, authenticated knowledge library. The browser extension captures metadata from the current tab and sends it to the backend, and the React dashboard lets you browse, search, and manage everything you’ve saved.

### Features

- **Chrome extension (v1.1.0)**
  - Save the current page to your AI Knowledge Saver account in a single click.
  - Extracts metadata such as title, description, domain, favicon, and preview images.
  - Infers item type (article, video, tweet) based on the URL.
  - Stores an access token securely in `chrome.storage.local`.
  - Quick link to open the web dashboard.

- **Web dashboard (client)**
  - Modern React (Vite) SPA UI with TailwindCSS and Redux Toolkit.
  - Auth flows (login/register) backed by the API.
  - Dashboard to view, search, and filter your saved items.
  - Basic item management (list and delete saved links).

- **Backend API (server)**
  - Node.js/Express API with JWT authentication and refresh tokens.
  - `POST /api/items` to create a saved item from the extension or client.
  - `GET /api/items` to list items for the authenticated user with query and type filters.
  - `DELETE /api/items/:id` to remove a saved item.
  - MongoDB via Mongoose; Redis and BullMQ hooks for background work; rate limiting and security middleware.

### Project Structure

- **`client/`** – React + Vite SPA for the dashboard (`cinescope-client`)
  - Uses React 19, React Router, Redux Toolkit, TailwindCSS 4, Zod, and Axios.
  - Entrypoint: `src/main.jsx`, routes in `src/router.jsx`, dashboard page in `src/pages/Dashboard.jsx`.
- **`server/`** – Node.js/Express backend (`cinescope-server`)
  - Entrypoint: `server.js` / `src/app.js`.
  - Routes: `src/routes/auth.js`, `src/routes/items.js`, `src/routes/user.js`.
  - Models: `src/models/User.js`, `src/models/Item.js`, `src/models/RefreshToken.js`.
- **`extension/`** – Chrome extension (Manifest v3)
  - `manifest.json`, `background.js`, `contentScript.js`, `popup.html`, `popup.js`, `styles.css`.

### Tech Stack

- **Frontend**
  - React 19, React Router, Redux Toolkit, React Redux
  - TailwindCSS 4, Vite
  - Zod for validation
  - Axios for HTTP

- **Backend**
  - Node.js, Express
  - MongoDB + Mongoose
  - JWT (`jsonwebtoken`), bcrypt, cookie-based auth helpers
  - Redis + BullMQ for queueing
  - Nodemailer + MJML for emails
  - Jest + Supertest for testing

- **Browser extension**
  - Chrome Manifest v3, background service worker, content script, popup UI
  - Uses `chrome.tabs`, `chrome.storage`, `chrome.notifications`, and context menus.

### Getting Started (v1)

#### Prerequisites

- Node.js 18+ and npm
- A running MongoDB instance
- (Optional) Redis for queues and rate limiting
- Chrome (or a Chromium-based browser) for loading the extension

#### 1. Clone the repository

```bash
git clone <your-repo-url> ai-knowledge-saver
cd ai-knowledge-saver
```

#### 2. Install dependencies

- **Client**

```bash
cd client
npm install
```

- **Server**

```bash
cd server
npm install
```

#### 3. Configure environment variables

- **Server (`server/.env`, example)**

```bash
PORT=4000
MONGODB_URI=mongodb://localhost:27017/ai-knowledge-saver
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
REDIS_URL=redis://localhost:6379
EMAIL_FROM=noreply@example.com
SMTP_HOST=localhost
SMTP_PORT=1025
```

- **Client (`client/.env`, example)**

```bash
VITE_API_BASE_URL=http://localhost:4000
```

Make sure the backend is reachable at `http://localhost:4000` so the Chrome extension and client can talk to it.

#### 4. Run the backend

```bash
cd server
npm run dev
```

The API will run on `http://localhost:4000` by default.

#### 5. Run the frontend

```bash
cd client
npm run dev
```

By default Vite serves the client on `http://localhost:5173`.

#### 6. Load the Chrome extension

1. Build or use the existing extension files under `extension/`.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `extension/` directory.
5. Confirm that the extension “AI Knowledge Saver” (version 1.1.0) appears.

### Using AI Knowledge Saver v1

- **Get an access token**
  - Sign up / log in through the web app.
  - Obtain your JWT access token (for v1 you can paste it directly into the extension).

- **Configure the extension**
  - Click the extension icon to open the popup.
  - Paste your access token into the token field and click **Save Token**.

- **Save a page**
  - Navigate to any article, tweet, or video.
  - Open the extension popup and click **Save Page**.
  - The extension will POST to `POST /api/items` with extracted metadata.

- **View your saved items**
  - Click **Open Dashboard** in the extension, or go to `http://localhost:5173/dashboard`.
  - From the dashboard you can browse, search, and manage your saved links.

### API Overview (v1)

- **`POST /api/auth/register` / `POST /api/auth/login`**
  - Create an account and obtain an access/refresh token pair.

- **`POST /api/items`**
  - Auth: `Authorization: Bearer <accessToken>`
  - Body (example):

```json
{
  "title": "Example Article",
  "url": "https://example.com/blog/ai",
  "description": "Short summary",
  "domain": "example.com",
  "favicon": "https://example.com/favicon.ico",
  "previewImage": "",
  "type": "article",
  "extraMetadata": {}
}
```

- **`GET /api/items`**
  - Query params: `q` (search term), `type` (`article` | `video` | `tweet`).

- **`DELETE /api/items/:id`**
  - Deletes one saved item belonging to the authenticated user.

### Development Notes

- The extension is currently wired to `http://localhost:4000` and the dashboard route `http://localhost:5173/dashboard`. Update `extension/popup.js` and `extension/manifest.json` if your URLs differ.
- The item type inference and preview image logic live in `server/src/routes/items.js` and use URL heuristics (YouTube, X/Twitter, Reddit, Medium, etc.).
- For production deployment, remember to:
  - Use strong secrets in environment variables.
  - Point `host_permissions` and API URLs to your production domain.
  - Configure HTTPS and CORS properly.

### Roadmap for v2+

- **Improved token handling**: automatic token refresh in the extension instead of pasting tokens manually.
- **Richer item model**: tags, collections, AI summaries, and embeddings.
- **Better search**: full‑text and semantic search over saved knowledge.
- **Multi‑platform support**: Firefox/Edge extensions and mobile‑friendly dashboard.

---

**Version:** AI Knowledge Saver v1 (extension 1.1.0, server 1.0.0, client 0.0.0) – initial integrated release.

