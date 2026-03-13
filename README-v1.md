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

