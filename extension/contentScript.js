// contentScript.js
// Runs in the context of web pages to extract metadata for the AI Knowledge Saver.

const ksGetMetaContent = (selectors) => {
  for (const selector of selectors) {
    const el = document.querySelector(selector);

    if (!el) continue;

    const value =
      el.getAttribute("content") ||
      el.getAttribute("value") ||
      el.content ||
      "";

    if (value) return value;
  }

  return "";
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
      const href = el.getAttribute("href");

      if (!href) continue;

      if (href.startsWith("http")) return href;

      return location.origin + href;
    }
  }

  return "";
};

const ksDetectYouTubeMetadata = () => {
  const extraMetadata = {};

  try {
    const channelEl =
      document.querySelector("#channel-name a") ||
      document.querySelector(".ytd-channel-name a") ||
      document.querySelector('meta[itemprop="channelId"]');

    if (channelEl) {
      extraMetadata.channelName =
        channelEl.textContent?.trim() || channelEl.content || "";
    }
  } catch {}

  try {
    const durationEl =
      document.querySelector(".ytp-time-duration") ||
      document.querySelector('meta[itemprop="duration"]');

    if (durationEl) {
      extraMetadata.duration =
        durationEl.textContent?.trim() || durationEl.content || "";
    }
  } catch {}

  return extraMetadata;
};

/**
 * Universal metadata extractor
 */
const extractPageMetadata = () => {
  const url = window.location.href;

  const title =
    ksGetMetaContent([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]'
    ]) ||
    document.title ||
    "";

  const description =
    ksGetMetaContent([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
      'meta[itemprop="description"]'
    ]) ||
    "";

  const previewImageFromOgTwitter =
    ksGetMetaContent([
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
      'meta[name="twitter:image:src"]'
    ]) ||
    "";

  const favicon = ksGetFavicon();

  let domain = "";
  try {
    const parsed = new URL(url);
    domain = parsed.hostname.replace(/^www\./i, "");
  } catch {}

  let type = "article";
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
    type = "video";
  } else if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) {
    type = "tweet";
  }

  const metadata = {
    title,
    url,
    description,
    previewImage: previewImageFromOgTwitter,
    favicon,
    domain,
    type,
    extraMetadata: {}
  };

  // ---------- YouTube Special Handling ----------
  if (domain === "youtube.com" || domain === "youtu.be") {
    try {
      const urlObj = new URL(url);
      let videoId = urlObj.searchParams.get("v");

      if (!videoId && urlObj.hostname.includes("youtu.be")) {
        videoId = urlObj.pathname.replace("/", "") || null;
      }

      if (videoId) {
        if (
          !metadata.previewImage ||
          metadata.previewImage.includes("yt_1200.png")
        ) {
          metadata.previewImage =
            `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
        }
      }
    } catch {}

    metadata.extraMetadata = ksDetectYouTubeMetadata();
  }

  // ---------- Image fallback ----------
  if (!metadata.previewImage) {
    const firstImg =
      document.querySelector("article img") ||
      document.querySelector("main img") ||
      document.querySelector("img");

    if (firstImg?.src) {
      metadata.previewImage = firstImg.src;
    }
  }

  // ---------- favicon fallback ----------
  if (!metadata.favicon) {
    metadata.favicon = `${location.origin}/favicon.ico`;
  }

  try {
    console.log("[AI Knowledge Saver] Extracted metadata:", metadata);
  } catch {}

  return metadata;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_PAGE_METADATA") return;

  // Delay for SPA websites like YouTube / X
  setTimeout(() => {
    try {
      const metadata = extractPageMetadata();

      sendResponse({
        ok: true,
        data: metadata
      });
    } catch (error) {
      console.error("[AI Knowledge Saver] Metadata extraction error:", error);

      sendResponse({
        ok: false,
        error: "Failed to extract page metadata"
      });
    }
  }, 500);

  return true;
});