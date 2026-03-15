import axios from 'axios';
import { load } from 'cheerio';
import { extractJSONLD } from './jsonLdParser.js';

/**
 * Enhanced OpenGraph scraper with JSON-LD support
 * Priority: JSON-LD > OpenGraph > Twitter Cards > Meta tags
 */
export const scrapeOpenGraphMetadata = async (url) => {
  if (!url) return null;

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = response.data;
    const $ = load(html);

    // Step 1: Extract JSON-LD (highest priority)
    const jsonLdData = extractJSONLD(html);

    // Step 2: Extract OpenGraph and Twitter Cards
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

    const ogTitle =
      get(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      $('title').first().text().trim() ||
      '';

    const ogDescription = get([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
      'meta[itemprop="description"]',
    ]);

    const ogImage = get([
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
    ]);

    // Extract favicon
    const favicon =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="apple-touch-icon"]').attr('href') ||
      '';

    // Resolve relative favicon URLs
    let resolvedFavicon = favicon;
    if (favicon && !favicon.startsWith('http')) {
      try {
        const urlObj = new URL(url);
        resolvedFavicon = favicon.startsWith('/')
          ? `${urlObj.origin}${favicon}`
          : `${urlObj.origin}/${favicon}`;
      } catch {
        resolvedFavicon = favicon;
      }
    }

    // Extract author from meta tags
    const author = get([
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[property="og:article:author"]',
    ]);

    // Merge with priority: JSON-LD > OpenGraph > Meta tags
    const result = {
      source: 'server_scraper',
      title: jsonLdData?.title || ogTitle || '',
      description: jsonLdData?.description || ogDescription || '',
      image: jsonLdData?.image || ogImage || '',
      favicon: resolvedFavicon,
      author: jsonLdData?.author || author || '',
      authorImage: jsonLdData?.authorImage || '',
      timestamp: jsonLdData?.timestamp || '',
      type: jsonLdData?.type || '',
    };

    return result;
  } catch (err) {
    console.error('[Metadata] OpenGraph scrape failed:', err.message);
    return null;
  }
};

