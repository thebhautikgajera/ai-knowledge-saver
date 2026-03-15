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
      // Extract JSON-LD
      const extractJSONLD = () => {
        try {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          const result = {
            title: '',
            description: '',
            image: '',
            author: '',
            authorImage: '',
            timestamp: '',
          };

          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent);
              const items = Array.isArray(data) ? data : [data];

              for (const item of items) {
                const itemType = item['@type'] || '';
                if (['Article', 'NewsArticle', 'BlogPosting'].includes(itemType)) {
                  result.title = result.title || item.headline || item.name || '';
                  result.description = result.description || item.description || '';
                  result.image = result.image || (item.image?.url || item.image || '');
                  result.author = result.author || (item.author?.name || (Array.isArray(item.author) ? item.author[0]?.name : '') || '');
                  result.authorImage = result.authorImage || (item.author?.image || (Array.isArray(item.author) ? item.author[0]?.image : '') || '');
                  result.timestamp = result.timestamp || item.datePublished || item.dateCreated || '';
                }
                if (itemType === 'VideoObject') {
                  result.title = result.title || item.name || '';
                  result.description = result.description || item.description || '';
                  result.image = result.image || item.thumbnailUrl || '';
                  result.timestamp = result.timestamp || item.uploadDate || '';
                }
              }
            } catch (e) {
              continue;
            }
          }
          return result;
        } catch {
          return {};
        }
      };

      const jsonLdData = extractJSONLD();

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
        jsonLdData.title ||
        getMeta([
          'meta[property="og:title"]',
          'meta[name="twitter:title"]',
        ]) ||
        document.title ||
        '';

      const baseDescription =
        jsonLdData.description ||
        getMeta([
          'meta[property="og:description"]',
          'meta[name="twitter:description"]',
          'meta[name="description"]',
        ]) ||
        '';

      const baseImage =
        jsonLdData.image ||
        getMeta([
          'meta[property="og:image"]',
          'meta[property="og:image:url"]',
          'meta[name="twitter:image"]',
        ]) ||
        '';

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
        author: jsonLdData.author || '',
        authorImage: jsonLdData.authorImage || '',
        timestamp: jsonLdData.timestamp || '',
        favicon: favicon || '',
      };

      // Platform-specific extraction
      if (platformInside === 'twitter') {
        const article = document.querySelector('article');
        const textEl = article?.querySelector('[data-testid="tweetText"]');
        const authorEl =
          article?.querySelector('div[dir="ltr"] span') || null;
        const profileImg = article?.querySelector(
          'img[src*="profile_images"]'
        );
        const timeEl = article?.querySelector('time');
        const mediaImg = article?.querySelector('img[src*="pbs.twimg.com/media"]');

        result.content = textEl?.innerText?.trim() || result.content;
        result.author = authorEl?.innerText?.trim() || result.author;
        result.authorImage = profileImg?.src || result.authorImage;
        result.timestamp =
          timeEl?.getAttribute('datetime') || result.timestamp || '';
        result.image = mediaImg?.src || result.image;
      } else if (platformInside === 'youtube') {
        const channelEl =
          document.querySelector('#channel-name a') ||
          document.querySelector('.ytd-channel-name a');
        result.author =
          channelEl?.textContent?.trim() || result.author || '';
      } else if (platformInside === 'linkedin') {
        // Try multiple strategies to find the post article
        let article = null;
        
        // Strategy 1: Look for article with activity ID in URL
        const urlMatch = window.location.href.match(/urn:li:activity:(\d+)/);
        if (urlMatch) {
          const activityId = urlMatch[1];
          article = document.querySelector(`[data-id*="${activityId}"]`) ||
                    document.querySelector(`[data-activity-id*="${activityId}"]`);
        }
        
        // Strategy 2: Look for main article element
        if (!article) {
          article = document.querySelector('main article') ||
                    document.querySelector('article[data-id*="urn:li:activity"]') ||
                    document.querySelector('article');
        }
        
        // Strategy 3: Look for feed update container
        if (!article) {
          article = document.querySelector('[data-view-name*="feed"]') ||
                    document.querySelector('[data-id*="urn:li:activity"]') ||
                    document.querySelector('.feed-shared-update-v2') ||
                    document.querySelector('.update-components-update-v2');
        }
        
        if (article) {
          // Content extraction with comprehensive fallbacks
          let content = '';
          let textEl = null;
          
          // Try multiple selectors in order of specificity
          const contentSelectors = [
            '[data-test-id="feed-detail"]',
            '.feed-shared-update-v2__description',
            '.feed-shared-text',
            '.feed-shared-update-v2__commentary',
            '.update-components-text',
            'div[dir="ltr"]',
            'span.break-words',
            '.feed-shared-update-v2__text-view',
            'p',
          ];
          
          for (const selector of contentSelectors) {
            textEl = article.querySelector(selector);
            if (textEl) {
              content = textEl.innerText?.trim() || textEl.textContent?.trim() || '';
              // Only use if we got meaningful content (more than just whitespace)
              if (content && content.length > 10) {
                break;
              }
            }
          }
          
          // If still no content, try getting all text from article and filtering
          if (!content || content.length <= 10) {
            const allText = article.innerText || article.textContent || '';
            // Remove common LinkedIn UI elements
            const cleanedText = allText
              .replace(/\s*Comment\s*/gi, '')
              .replace(/\s*Like\s*/gi, '')
              .replace(/\s*Share\s*/gi, '')
              .replace(/\s*Repost\s*/gi, '')
              .replace(/\s*Send\s*/gi, '')
              .replace(/\d+\s*(comment|like|share|repost)s?/gi, '')
              .trim();
            
            if (cleanedText && cleanedText.length > 10) {
              content = cleanedText;
            }
          }

          // Only set content, title, and description if we found meaningful content
          if (content && content.length > 10) {
            result.content = content;

            // Extract title from content (first sentence or first 100 chars)
            const firstSentenceMatch = content.match(/^[^.!?]+[.!?]/);
            if (firstSentenceMatch) {
              result.title = firstSentenceMatch[0].trim();
            } else {
              const titleText = content.substring(0, 100).trim();
              result.title = content.length > 100 ? titleText + '...' : titleText;
            }

            // Extract description from content (full content or first 200 chars)
            if (content.length <= 200) {
              result.description = content;
            } else {
              result.description = content.substring(0, 200).trim() + '...';
            }
          }
          // If no content found, don't override base title/description

          // Author extraction with multiple fallbacks
          const authorSelectors = [
            'a[href*="/in/"][href*="/overlay/"]', // Author link in overlay
            '.feed-shared-actor__name a',
            '.update-components-actor__name a',
            'a[data-control-name="actor"]',
            'a[href*="/in/"]',
          ];
          
          for (const selector of authorSelectors) {
            const authorEl = article.querySelector(selector);
            if (authorEl) {
              let authorText = authorEl.innerText?.trim() || 
                              authorEl.textContent?.trim() || 
                              authorEl.getAttribute('title') || 
                              authorEl.getAttribute('aria-label') || '';
              
              authorText = authorText.split('\n')[0].trim();
              
              // Only use if it looks like a name (has letters, not just numbers/symbols)
              if (authorText && /[a-zA-Z]/.test(authorText) && authorText.length > 1) {
                result.author = authorText;
                break;
              }
            }
          }

          // Author image extraction - ONLY profile images
          const profileImg =
            article.querySelector('img[src*="profile-displayphoto"]') ||
            article.querySelector('.feed-shared-actor__avatar img') ||
            article.querySelector('.update-components-actor__avatar img') ||
            article.querySelector('img[alt*="profile" i]');
          
          if (profileImg?.src && profileImg.src.includes('profile-displayphoto')) {
            result.authorImage = profileImg.src;
          }

          const timeEl = 
            article.querySelector('time') ||
            article.querySelector('span[datetime]') ||
            article.querySelector('.feed-shared-actor__sub-description time');
          
          result.timestamp =
            timeEl?.getAttribute('datetime') || 
            timeEl?.getAttribute('title') ||
            timeEl?.innerText?.trim() || 
            result.timestamp || '';

          // Post image extraction - EXCLUDE profile images
          let postImage = '';
          
          // Get all images in the article
          const allImages = article.querySelectorAll('img');
          
          for (const img of allImages) {
            const src = img.src || '';
            
            // Skip profile images
            if (src.includes('profile-displayphoto') || 
                src.includes('avatar') ||
                img.alt?.toLowerCase().includes('profile') ||
                img.alt?.toLowerCase().includes('avatar')) {
              continue;
            }
            
            // Look for post content images
            if (src.includes('media.licdn.com') && 
                !src.includes('profile') &&
                !src.includes('avatar')) {
              // Check if it's in a media/image container
              const parent = img.closest('.feed-shared-image, .update-components-image, .feed-shared-update-v2__image, [data-test-reduced-motion-media-img]');
              if (parent || img.hasAttribute('data-test-reduced-motion-media-img')) {
                postImage = src;
                break;
              }
            }
          }
          
          // Fallback: try specific selectors for post images
          if (!postImage) {
            const previewImg =
              article.querySelector('img[data-test-reduced-motion-media-img]') ||
              article.querySelector('.feed-shared-image img') ||
              article.querySelector('.update-components-image img') ||
              article.querySelector('.feed-shared-update-v2__image img');
            
            if (previewImg?.src) {
              const src = previewImg.src;
              // Double-check it's not a profile image
              if (!src.includes('profile-displayphoto') && 
                  !src.includes('avatar') &&
                  !previewImg.alt?.toLowerCase().includes('profile')) {
                postImage = src;
              }
            }
          }
          
          if (postImage) {
            result.image = postImage;
          }
        }
      } else if (platformInside === 'reddit') {
        const titleEl = document.querySelector('h1[data-test-id="post-content"]') ||
                        document.querySelector('h1');
        const contentEl = document.querySelector('[data-test-id="post-content"]');
        const authorEl = document.querySelector('a[data-testid="post_author_link"]');
        const imageEl = document.querySelector('img[src*="i.redd.it"]');

        result.title = titleEl?.innerText?.trim() || result.title;
        result.content = contentEl?.innerText?.trim() || result.content;
        result.author = authorEl?.innerText?.trim() || result.author;
        result.image = imageEl?.src || result.image;
      } else if (platformInside === 'medium') {
        const titleEl = document.querySelector('h1') ||
                        document.querySelector('[data-testid="storyTitle"]');
        const authorEl = document.querySelector('a[data-action="show-user-card"]');
        const authorImgEl = document.querySelector('img[alt*="profile picture"]');
        const heroImgEl = document.querySelector('article img[src*="https"]');

        result.title = titleEl?.innerText?.trim() || result.title;
        result.author = authorEl?.innerText?.trim() || result.author;
        result.authorImage = authorImgEl?.src || result.authorImage;
        result.image = heroImgEl?.src || result.image;
      }

      // Fallback image
      if (!result.image) {
        const firstImg =
          document.querySelector('article img') ||
          document.querySelector('main img') ||
          document.querySelector('img');
        if (firstImg?.src) {
          result.image = firstImg.src;
        }
      }

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

