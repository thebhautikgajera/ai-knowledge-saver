// contentScript.js
// Layer 1 — ultra-fast DOM metadata extractor that runs in-page.
// Produces a normalized metadata object consumed by the backend enrichment pipeline.

const ksGetMetaContent = (selectors) => {
  for (const selector of selectors) {
    const el = document.querySelector(selector);

    if (!el) continue;

    const value =
      el.getAttribute('content') ||
      el.getAttribute('value') ||
      el.content ||
      '';

    if (value) return value.trim();
  }

  return '';
};

const ksGetFavicon = () => {
  const linkSelectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel*="icon"]',
    'link[rel="apple-touch-icon"]',
  ];

  for (const selector of linkSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const href = el.getAttribute('href');

      if (!href) continue;

      if (href.startsWith('http')) return href;

      return `${location.origin}${href.startsWith('/') ? '' : '/'}${href}`;
    }
  }

  return '';
};

const ksDetectPlatform = (url) => {
  const lower = (url || "").toLowerCase();

  if (lower.includes("twitter.com") || lower.includes("x.com/status")) {
    return "twitter";
  }

  if (lower.includes("youtube.com/watch") || lower.includes("youtu.be")) {
    return "youtube";
  }

  if (lower.includes("linkedin.com")) {
    return "linkedin";
  }

  if (lower.includes("pinterest.com")) {
    return "pinterest";
  }

  if (lower.includes("instagram.com")) {
    return "instagram";
  }

  return "website";
};

function waitForTweet(timeout = 4000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const tweet = document.querySelector('[data-testid="tweetText"]');

      if (tweet) {
        resolve(true);
        return;
      }

      if (Date.now() - start > timeout) {
        resolve(false);
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

// ---------- Platform-specific helpers ----------

const ksExtractTwitter = () => {
  try {
    const article = document.querySelector("article");
    if (!article) return {};

    let tweetText = "";

    const tweetContainer =
      article.querySelector('[data-testid="tweetText"]') ||
      article.querySelector('div[lang]');

    if (tweetContainer) {
      tweetText = tweetContainer.innerText.trim();
    }

    const timestamp =
      article.querySelector("time")?.getAttribute("datetime") || "";

    const profileImage =
      article.querySelector('img[src*="profile_images"]')?.src || "";

    let username = "";

    const spans = [...article.querySelectorAll("span")];

    const handle = spans.find((el) => {
      const text = el.innerText.trim();
      return text.startsWith("@") && text.length > 1;
    });

    if (handle) {
      username = handle.innerText.replace("@", "").trim();
    }

    return {
      platform: "X (Formerly Twitter)",
      title: tweetText,
      description: tweetText,
      content: tweetText,
      author: username,
      authorImage: profileImage,
      timestamp,
    };
  } catch {
    return {};
  }
};

const ksExtractYouTube = () => {
  const title =
    document.querySelector("h1.ytd-watch-metadata")?.innerText ||
    ksGetMetaContent(["meta[property='og:title']"]);

  const description =
    document.querySelector("#description-inline-expander")?.innerText ||
    ksGetMetaContent(["meta[property='og:description']"]);

  const thumbnail =
    ksGetMetaContent(["meta[property='og:image']"]) || "";

  const channel =
    document.querySelector("#channel-name a")?.innerText ||
    document.querySelector("ytd-channel-name a")?.innerText ||
    "";

  const channelImage =
    document.querySelector("#channel-name img")?.src ||
    document.querySelector("#owner img")?.src ||
    document.querySelector("ytd-channel-name img")?.src ||
    "";

  return {
    platform: "youtube",
    title,
    description,
    image: thumbnail,
    author: channel,
    authorImage: channelImage,
  };
};

const ksExtractLinkedIn = () => {
  try {
    const article =
      document.querySelector("article") ||
      document.querySelector('[data-view-name*="feed"]');

    const text =
      article?.querySelector(".break-words")?.innerText ||
      article?.querySelector("div[dir='ltr']")?.innerText ||
      "";

    const author =
      article?.querySelector("span[dir='ltr']")?.innerText || "";

    const profileImg =
      article?.querySelector("img[src*='profile-displayphoto']")?.src || "";

    const time =
      article?.querySelector("time")?.getAttribute("datetime") || "";

    const image =
      article?.querySelector("img[data-test-reduced-motion-media-img]")?.src ||
      "";

    return {
      platform: "linkedin",
      content: text,
      description: text,
      author,
      authorImage: profileImg,
      timestamp: time,
      image,
      title: author ? `LinkedIn post by ${author}` : "LinkedIn Post",
    };
  } catch {
    return {};
  }
};

const ksExtractPinterest = () => {
  try {
    const title =
      ksGetMetaContent(["meta[property='og:title']"]) ||
      document.title ||
      "";

    const description =
      ksGetMetaContent(["meta[property='og:description']"]) || "";

    const image =
      ksGetMetaContent(["meta[property='og:image']"]) ||
      document.querySelector("img[src*='pinimg']")?.src ||
      "";

    const author =
      document.querySelector('a[href*="/"] span')?.innerText || "";

    return {
      platform: "pinterest",
      title,
      description,
      image,
      author,
    };
  } catch {
    return {};
  }
};

const ksExtractInstagram = () => {
  try {
    const title =
      ksGetMetaContent(["meta[property='og:title']"]) ||
      document.title ||
      "";

    const description =
      ksGetMetaContent(["meta[property='og:description']"]) || "";

    const image =
      ksGetMetaContent(["meta[property='og:image']"]) || "";

    let author = "";

    const match = title.match(/@([a-zA-Z0-9._]+)/);
    if (match) {
      author = match[1];
    }

    return {
      platform: "instagram",
      title,
      description,
      image,
      author,
    };
  } catch {
    return {};
  }
};

/**
 * Universal metadata extractor (Layer 1)
 */
const extractPageMetadata = () => {
  const url = window.location.href;
  const platform = ksDetectPlatform(url);

  const title =
    ksGetMetaContent([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ]) ||
    document.title ||
    '';

  const description =
    ksGetMetaContent([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
      'meta[itemprop="description"]',
    ]) || '';

  const imageFromMeta =
    ksGetMetaContent([
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
      'meta[name="twitter:image:src"]',
    ]) || '';

  const favicon = ksGetFavicon();

  const base = {
    source: 'extension_dom',
    platform,
    url,
    domain: location.hostname,
    savedAt: new Date().toISOString(),
    title,
    description,
    content: '',
    image: imageFromMeta,
    favicon,
    author: '',
    authorImage: '',
    timestamp: '',
  };

  let platformData = {};

  if (platform === "twitter") {
    platformData = ksExtractTwitter();
  }
  else if (platform === "youtube") {
    platformData = ksExtractYouTube();
  }
  else if (platform === "linkedin") {
    platformData = ksExtractLinkedIn();
  }
  else if (platform === "pinterest") {
    platformData = ksExtractPinterest();
  }
  else if (platform === "instagram") {
    platformData = ksExtractInstagram();
  }

  // Fallback for generic websites – basic image selection if still missing
  if (!platformData.image && !base.image) {
    const firstImg =
      document.querySelector('article img') ||
      document.querySelector('main img') ||
      document.querySelector('img');

    if (firstImg?.src) {
      platformData.image = firstImg.src;
    }
  }

  // Favicon fallback
  if (!base.favicon) {
    base.favicon = `${location.origin}/favicon.ico`;
  }

  const merged = {
    ...base,
    ...platformData,
  };

  try {
    console.log('[AI Knowledge Saver] Layer1 extension metadata:', merged);
  } catch {
    // ignore
  }

  return merged;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_PAGE_METADATA') return;

  (async () => {
    try {
      // IMPORTANT: wait for tweet DOM to load
      await waitForTweet();

      const metadata = extractPageMetadata();

      console.log("[AI Knowledge Saver] Extracted metadata:", metadata);

      sendResponse({
        ok: true,
        data: metadata,
      });

    } catch (error) {
      console.error("[AI Knowledge Saver] Metadata extraction error:", error);

      sendResponse({
        ok: false,
        error: "Failed to extract page metadata",
      });
    }
  })();

  return true;
});

