export const mergeMetadata = (extensionMeta, ogMeta, headlessMeta) => {
  const ext = extensionMeta || {};
  const og = ogMeta || {};
  const hd = headlessMeta || {};

  const pick = (field) => ext[field] || og[field] || hd[field] || '';

  const final = {
    title: pick('title'),
    description: pick('description'),
    content: pick('content'),
    image: pick('image'),
    favicon: pick('favicon'),
    author: pick('author'),
    authorImage: pick('authorImage'),
    timestamp: pick('timestamp'),
    platform: ext.platform || hd.platform || 'website',
  };

  // Fallbacks to avoid empty metadata
  if (!final.title && ext.url) {
    final.title = ext.url;
  }
  if (!final.description) {
    final.description = final.title;
  }

  const metadataSource =
    (ext.source && 'extension_dom') ||
    (og.source && 'server_scraper') ||
    (hd.source && 'headless_browser') ||
    'unknown';

  return { final, metadataSource };
};

