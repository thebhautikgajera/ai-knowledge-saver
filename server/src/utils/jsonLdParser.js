import { load } from 'cheerio';

/**
 * Extract JSON-LD structured data from HTML
 * Supports Article, NewsArticle, BlogPosting, VideoObject, Person, Organization schemas
 */
export const extractJSONLD = (html) => {
  if (!html) return null;

  try {
    const $ = load(html);
    const scripts = $('script[type="application/ld+json"]');
    
    const result = {
      title: '',
      description: '',
      image: '',
      author: '',
      authorImage: '',
      timestamp: '',
      type: '',
    };

    scripts.each((_, el) => {
      try {
        const text = $(el).html() || $(el).text();
        if (!text) return;

        const data = JSON.parse(text);
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (!item || typeof item !== 'object') continue;

          const itemType = item['@type'] || '';

          // Article schemas (Article, NewsArticle, BlogPosting)
          if (['Article', 'NewsArticle', 'BlogPosting'].includes(itemType)) {
            result.title = result.title || item.headline || item.name || '';
            result.description = result.description || item.description || '';
            result.type = result.type || 'article';
            
            // Handle image (can be string, object with url, or array)
            if (!result.image) {
              if (typeof item.image === 'string') {
                result.image = item.image;
              } else if (item.image?.url) {
                result.image = item.image.url;
              } else if (Array.isArray(item.image) && item.image.length > 0) {
                result.image = typeof item.image[0] === 'string' 
                  ? item.image[0] 
                  : item.image[0]?.url || '';
              }
            }

            // Handle author (can be object or array)
            if (!result.author) {
              if (typeof item.author === 'string') {
                result.author = item.author;
              } else if (item.author?.name) {
                result.author = item.author.name;
                result.authorImage = result.authorImage || item.author.image || '';
              } else if (Array.isArray(item.author) && item.author.length > 0) {
                const firstAuthor = item.author[0];
                result.author = firstAuthor?.name || '';
                result.authorImage = result.authorImage || firstAuthor?.image || '';
              }
            }

            // Handle dates
            if (!result.timestamp) {
              result.timestamp = item.datePublished || item.dateCreated || item.dateModified || '';
            }
          }

          // VideoObject schema
          if (itemType === 'VideoObject') {
            result.title = result.title || item.name || '';
            result.description = result.description || item.description || '';
            result.type = result.type || 'video';
            result.image = result.image || item.thumbnailUrl || '';
            result.timestamp = result.timestamp || item.uploadDate || item.datePublished || '';
            
            if (!result.author && item.uploader) {
              result.author = typeof item.uploader === 'string' 
                ? item.uploader 
                : item.uploader.name || '';
            }
          }

          // Person/Organization (for author info)
          if (['Person', 'Organization'].includes(itemType)) {
            if (!result.author) {
              result.author = item.name || '';
            }
            if (!result.authorImage) {
              result.authorImage = item.image || '';
            }
          }
        }
      } catch (parseErr) {
        // Skip invalid JSON-LD blocks
        console.warn('[JSON-LD] Failed to parse block:', parseErr.message);
      }
    });

    // Return null if we didn't extract anything meaningful
    if (!result.title && !result.description && !result.image) {
      return null;
    }

    return result;
  } catch (err) {
    console.error('[JSON-LD] Extraction error:', err.message);
    return null;
  }
};
