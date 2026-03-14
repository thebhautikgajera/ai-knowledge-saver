import axios from 'axios';
import { load } from 'cheerio';

export const scrapeOpenGraphMetadata = async (url) => {
  if (!url) return null;

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; AI-Knowledge-Saver/1.0; +https://yoursite.com)',
      },
    });

    const html = response.data;
    const $ = load(html);

    const get = (selectors) => {
      for (const selector of selectors) {
        const el = $(selector).first();
        if (!el || !el.length) continue;
        const value =
          el.attr('content') ??
          el.attr('value') ??
          el.text() ??
          '';
        if (value && value.trim()) return value.trim();
      }
      return '';
    };

    const title =
      get(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      $('title').first().text().trim();

    const description =
      get([
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[name="description"]',
      ]) || '';

    const image =
      get([
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
      ]) || '';

    const favicon =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      '';

    return {
      source: 'server_scraper',
      title: title || '',
      description,
      image,
      favicon,
    };
  } catch (err) {
    console.error('[Metadata] OpenGraph scrape failed:', err.message);
    return null;
  }
};

