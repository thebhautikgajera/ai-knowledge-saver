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
  const lowerUrl = (url || '').toLowerCase();

  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'twitter';
  }
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (lowerUrl.includes('linkedin.com')) {
    return 'linkedin';
  }

  return 'website';
};

// ---------- Platform-specific helpers ----------

const ksExtractTwitter = () => {
  try {
    const article = document.querySelector('article');
    if (!article) return {};

    const textEl = article.querySelector('[data-testid="tweetText"]');
    const timeEl = article.querySelector('time');
    const profileImg = article.querySelector('img[src*="profile_images"]');
    const usernameEl =
      article.querySelector('a[role="link"][href*="/status/"] span') ||
      article.querySelector('div[dir="ltr"] span');

    const content = textEl?.innerText?.trim() || '';
    const timestamp = timeEl?.getAttribute('datetime') || '';
    const authorImage = profileImg?.src || '';
    const author = usernameEl?.innerText?.trim() || '';

    return {
      platform: 'twitter',
      content,
      author,
      authorImage,
      timestamp,
    };
  } catch {
    return {};
  }
};

const ksExtractYouTube = () => {
  const metaTitle = ksGetMetaContent([
    'meta[property="og:title"]',
    'meta[name="title"]',
  ]);
  const metaDescription = ksGetMetaContent([
    'meta[property="og:description"]',
    'meta[name="description"]',
  ]);
  const ogImage = ksGetMetaContent([
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
  ]);

  let channelName = '';
  try {
    const channelEl =
      document.querySelector('#channel-name a') ||
      document.querySelector('.ytd-channel-name a') ||
      document.querySelector('meta[itemprop="channelId"]');

    if (channelEl) {
      channelName =
        channelEl.textContent?.trim() || channelEl.getAttribute('content') || '';
    }
  } catch {
    // ignore
  }

  let thumbnail = ogImage;
  try {
    const urlObj = new URL(window.location.href);
    let videoId = urlObj.searchParams.get('v');

    if (!videoId && urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.replace('/', '') || null;
    }

    if (videoId) {
      if (!thumbnail || thumbnail.includes('yt_1200.png')) {
        thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
  } catch {
    // ignore
  }

  return {
    platform: 'youtube',
    title: metaTitle,
    description: metaDescription,
    image: thumbnail,
    author: channelName,
  };
};

const ksExtractLinkedIn = () => {
  try {
    const article =
      document.querySelector('article') ||
      document.querySelector('[data-view-name*="feed"]');

    const textEl =
      article?.querySelector('[data-test-id="feed-detail"]') ||
      article?.querySelector('div[dir="ltr"]') ||
      article?.querySelector('span.break-words');

    const authorEl =
      article?.querySelector('a[href*="/in/"]') ||
      article?.querySelector('span[dir="ltr"]');

    const profileImg =
      article?.querySelector('img[alt*="profile"]') ||
      article?.querySelector('img[src*="profile-displayphoto"]');

    const timeEl =
      article?.querySelector('time') ||
      article?.querySelector('span[datetime]');

    const previewImg =
      article?.querySelector('img[data-test-reduced-motion-media-img]') ||
      article?.querySelector('img[loading="lazy"]');

    const content = textEl?.innerText?.trim() || '';
    const author = authorEl?.innerText?.trim() || '';
    const authorImage = profileImg?.src || '';
    const timestamp =
      timeEl?.getAttribute('datetime') || timeEl?.innerText?.trim() || '';
    const image = previewImg?.src || '';

    return {
      platform: 'linkedin',
      content,
      author,
      authorImage,
      timestamp,
      image,
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
  if (platform === 'twitter') {
    platformData = ksExtractTwitter();
  } else if (platform === 'youtube') {
    platformData = ksExtractYouTube();
  } else if (platform === 'linkedin') {
    platformData = ksExtractLinkedIn();
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

  // Small delay for SPA websites (Twitter/X, YouTube, LinkedIn)
  setTimeout(() => {
    try {
      const metadata = extractPageMetadata();

      sendResponse({
        ok: true,
        data: metadata,
      });
    } catch (error) {
      console.error('[AI Knowledge Saver] Metadata extraction error:', error);

      sendResponse({
        ok: false,
        error: 'Failed to extract page metadata',
      });
    }
  }, 500);

  return true;
});

