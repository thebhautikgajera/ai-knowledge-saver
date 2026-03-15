/**
 * Merge metadata from three layers with priority:
 * Extension DOM (Layer 1) > OpenGraph/JSON-LD (Layer 2) > Headless Browser (Layer 3)
 * 
 * Note: JSON-LD data is already extracted in Layer 2 (OpenGraph scraper) and Layer 3 (headless),
 * so we prioritize extension data first, then server-scraped data, then headless data.
 */
export const mergeMetadata = (extensionMeta, ogMeta, headlessMeta) => {
  const ext = extensionMeta || {};
  const og = ogMeta || {};
  const hd = headlessMeta || {};

  // Priority: Extension > OpenGraph/JSON-LD > Headless
  const pick = (field) => {
    const extVal = ext[field];
    const ogVal = og[field];
    const hdVal = hd[field];
    
    // Return first non-empty value in priority order
    if (extVal && extVal.toString().trim()) return extVal.toString().trim();
    if (ogVal && ogVal.toString().trim()) return ogVal.toString().trim();
    if (hdVal && hdVal.toString().trim()) return hdVal.toString().trim();
    return '';
  };

  const final = {
    title: pick('title'),
    description: pick('description'),
    content: pick('content'),
    image: pick('image'),
    favicon: pick('favicon'),
    author: pick('author'),
    authorImage: pick('authorImage'),
    timestamp: pick('timestamp'),
    platform: ext.platform || og.platform || hd.platform || 'website',
    type: ext.type || og.type || hd.type || '',
  };

  // Fallbacks to avoid empty metadata
  if (!final.title) {
    if (ext.url) {
      try {
        const urlObj = new URL(ext.url);
        final.title = urlObj.hostname + urlObj.pathname;
      } catch {
        final.title = ext.url || 'Untitled';
      }
    } else {
      final.title = 'Untitled';
    }
  }
  
  if (!final.description) {
    final.description = final.title;
  }

  // Determine metadata source (which layer provided the most complete data)
  let metadataSource = 'unknown';
  const extFields = [ext.title, ext.description, ext.image].filter(Boolean).length;
  const ogFields = [og.title, og.description, og.image].filter(Boolean).length;
  const hdFields = [hd.title, hd.description, hd.image].filter(Boolean).length;

  if (extFields >= ogFields && extFields >= hdFields && ext.source) {
    metadataSource = 'extension_dom';
  } else if (ogFields >= hdFields && og.source) {
    metadataSource = 'server_scraper';
  } else if (hd.source) {
    metadataSource = 'headless_browser';
  }

  return { final, metadataSource };
};

