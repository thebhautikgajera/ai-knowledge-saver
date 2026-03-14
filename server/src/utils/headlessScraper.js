import { chromium } from 'playwright';
import { detectPlatform } from './platformDetection.js';

export const scrapeWithHeadlessBrowser = async (url) => {
  if (!url) return null;

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

    const platform = detectPlatform(url);

    const metadata = await page.evaluate((platformInside) => {
      const getMeta = (selectors) => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (!el) continue;
          const value =
            el.getAttribute('content') ||
            el.getAttribute('value') ||
            el.textContent ||
            '';
          if (value && value.trim()) return value.trim();
        }
        return '';
      };

      const baseTitle =
        getMeta([
          'meta[property="og:title"]',
          'meta[name="twitter:title"]',
        ]) || document.title || '';

      const baseDescription =
        getMeta([
          'meta[property="og:description"]',
          'meta[name="twitter:description"]',
          'meta[name="description"]',
        ]) || '';

      const baseImage =
        getMeta([
          'meta[property="og:image"]',
          'meta[property="og:image:url"]',
          'meta[name="twitter:image"]',
        ]) || '';

      const faviconEl =
        document.querySelector('link[rel="icon"]') ||
        document.querySelector('link[rel="shortcut icon"]');

      const favicon =
        faviconEl?.href ||
        (window.location && `${window.location.origin}/favicon.ico`);

      const result = {
        source: 'headless_browser',
        title: baseTitle,
        description: baseDescription,
        image: baseImage,
        content: '',
        author: '',
      };

      if (platformInside === 'twitter') {
        const article = document.querySelector('article');
        const textEl = article?.querySelector('[data-testid="tweetText"]');
        const authorEl =
          article?.querySelector('div[dir="ltr"] span') || null;
        const profileImg = article?.querySelector(
          'img[src*="profile_images"]'
        );
        const timeEl = article?.querySelector('time');

        result.content = textEl?.innerText?.trim() || result.content;
        result.author = authorEl?.innerText?.trim() || result.author;
        result.authorImage = profileImg?.src || '';
        result.timestamp =
          timeEl?.getAttribute('datetime') || result.timestamp || '';
      } else if (platformInside === 'youtube') {
        const channelEl =
          document.querySelector('#channel-name a') ||
          document.querySelector('.ytd-channel-name a');
        result.author =
          channelEl?.textContent?.trim() || result.author || '';
      } else if (platformInside === 'linkedin') {
        const article =
          document.querySelector('article') ||
          document.querySelector('[data-view-name*="feed"]');
        const textEl =
          article?.querySelector('[data-test-id="feed-detail"]') ||
          article?.querySelector('div[dir="ltr"]');
        const authorEl =
          article?.querySelector('a[href*="/in/"]') ||
          article?.querySelector('span[dir="ltr"]');
        const profileImg =
          article?.querySelector('img[alt*="profile"]') ||
          article?.querySelector('img[src*="profile-displayphoto"]');
        const timeEl = article?.querySelector('time');
        const previewImg =
          article?.querySelector('img[data-test-reduced-motion-media-img]') ||
          article?.querySelector('img[loading="lazy"]');

        result.content = textEl?.innerText?.trim() || result.content;
        result.author = authorEl?.innerText?.trim() || result.author;
        result.authorImage = profileImg?.src || '';
        result.timestamp =
          timeEl?.getAttribute('datetime') || result.timestamp || '';
        result.image = previewImg?.src || result.image || '';
      }

      if (!result.image) {
        const firstImg =
          document.querySelector('article img') ||
          document.querySelector('main img') ||
          document.querySelector('img');
        if (firstImg?.src) {
          result.image = firstImg.src;
        }
      }

      result.favicon = favicon || '';

      return result;
    }, platform);

    return metadata;
  } catch (err) {
    console.error('[Metadata] Headless scrape failed:', err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

