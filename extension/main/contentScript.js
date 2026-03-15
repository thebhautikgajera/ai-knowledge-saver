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

/**
 * Normalize image URL - convert relative URLs to absolute
 */
const ksNormalizeImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  
  // Already absolute
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Convert relative to absolute
  try {
    return new URL(imageUrl, location.origin).href;
  } catch {
    return imageUrl;
  }
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
  if (lowerUrl.includes('pinterest.com')) {
    return 'pinterest';
  }
  if (lowerUrl.includes('reddit.com')) {
    return 'reddit';
  }

  return 'website';
};

// ---------- Platform-specific helpers ----------

/**
 * Twitter extractor - DO NOT MODIFY core logic
 * This function is working perfectly and must remain unchanged.
 * Only adding image extraction for media tweets.
 */
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

    // Extract media image if present (without modifying core logic)
    let image = '';
    const mediaImg = article.querySelector('img[src*="pbs.twimg.com/media"]') ||
                     article.querySelector('img[src*="media"]') ||
                     article.querySelector('div[data-testid="tweetPhoto"] img');
    if (mediaImg?.src) {
      image = mediaImg.src;
    }

    return {
      platform: 'twitter',
      content,
      author,
      authorImage,
      timestamp,
      image: image ? ksNormalizeImageUrl(image) : '',
    };
  } catch {
    return {};
  }
};

/**
 * YouTube extractor - DO NOT MODIFY core logic
 * This function is working perfectly and must remain unchanged.
 * Only improving author extraction with more fallbacks.
 */
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
      document.querySelector('meta[itemprop="channelId"]') ||
      document.querySelector('ytd-channel-name a') ||
      document.querySelector('a[href*="/channel/"]') ||
      document.querySelector('a[href*="/user/"]') ||
      document.querySelector('a[href*="/c/"]');

    if (channelEl) {
      channelName =
        channelEl.textContent?.trim() || 
        channelEl.getAttribute('content') || 
        channelEl.getAttribute('title') || 
        channelEl.innerText?.trim() || '';
    }
    
    // Fallback: try meta tag for channel name
    if (!channelName) {
      channelName = ksGetMetaContent([
        'meta[itemprop="author"]',
        'meta[name="author"]',
      ]);
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

/**
 * LinkedIn extractor - Improved with better selectors and fallbacks
 */
const ksExtractLinkedIn = () => {
  try {
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

    if (!article) {
      console.warn('[AI Knowledge Saver] LinkedIn: No article found');
      return {};
    }

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

    // Only extract title/description if we have meaningful content
    let title = undefined;
    let description = undefined;
    
    if (content && content.length > 10) {
      // Extract title from content (first sentence or first 100 chars)
      const firstSentenceMatch = content.match(/^[^.!?]+[.!?]/);
      if (firstSentenceMatch) {
        title = firstSentenceMatch[0].trim();
      } else {
        // Fallback to first 100 chars
        title = content.substring(0, 100).trim();
        if (content.length > 100) {
          title += '...';
        }
      }

      // Extract description from content (full content or first 200 chars)
      if (content.length <= 200) {
        description = content;
      } else {
        description = content.substring(0, 200).trim() + '...';
      }
    }

    // Author extraction with multiple fallbacks
    let author = '';
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
        // Get text from the author link
        let authorText = authorEl.innerText?.trim() || 
                        authorEl.textContent?.trim() || 
                        authorEl.getAttribute('title') || 
                        authorEl.getAttribute('aria-label') || '';
        
        // Clean up author name - remove extra whitespace and newlines
        authorText = authorText.split('\n')[0].trim();
        
        // Only use if it looks like a name (has letters, not just numbers/symbols)
        if (authorText && /[a-zA-Z]/.test(authorText) && authorText.length > 1) {
          author = authorText;
          break;
        }
      }
    }

    // Author image extraction - ONLY profile images
    let authorImage = '';
    const profileImg =
      article.querySelector('img[src*="profile-displayphoto"]') ||
      article.querySelector('.feed-shared-actor__avatar img') ||
      article.querySelector('.update-components-actor__avatar img') ||
      article.querySelector('img[alt*="profile" i]');
    
    if (profileImg?.src && profileImg.src.includes('profile-displayphoto')) {
      authorImage = profileImg.src;
    }

    const timeEl =
      article.querySelector('time') ||
      article.querySelector('span[datetime]') ||
      article.querySelector('.feed-shared-actor__sub-description time');

    const timestamp =
      timeEl?.getAttribute('datetime') || 
      timeEl?.getAttribute('title') ||
      timeEl?.innerText?.trim() || '';

    // Post image extraction - EXCLUDE profile images
    let image = '';
    
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
          image = src;
          break;
        }
      }
    }
    
    // Fallback: try specific selectors for post images
    if (!image) {
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
          image = src;
        }
      }
    }

    // Normalize image URLs
    if (image) {
      image = ksNormalizeImageUrl(image);
    }
    if (authorImage) {
      authorImage = ksNormalizeImageUrl(authorImage);
    }

    // Build result object - only include fields that have values
    const result = {
      platform: 'linkedin',
    };
    
    // Only add fields if they have meaningful values
    if (title) result.title = title;
    if (description) result.description = description;
    if (content) result.content = content;
    if (author) result.author = author;
    if (authorImage) result.authorImage = authorImage;
    if (timestamp) result.timestamp = timestamp;
    if (image) result.image = image;
    
    return result;
  } catch (error) {
    console.error('[AI Knowledge Saver] LinkedIn extraction error:', error);
    return {};
  }
};

/**
 * Pinterest extractor - Improved with proper selectors and fallbacks
 */
const ksExtractPinterest = () => {
  try {
    // Extract title from og:title
    const title = ksGetMetaContent(['meta[property="og:title"]']);

    // Extract image from og:image
    let image = ksGetMetaContent(['meta[property="og:image"]']);

    // Fallback 1: try to find pinimg image (multiple selectors)
    if (!image) {
      const pinImg = 
        document.querySelector("img[src*='pinimg']") ||
        document.querySelector("img[src*='i.pinimg.com']") ||
        document.querySelector('.hCL kVc L4E MIw img') ||
        document.querySelector('.GrowthUnauthPinImage img') ||
        document.querySelector('[data-test-id="pinrep-image"] img') ||
        document.querySelector('img[alt*="Pin"]');
      
      if (pinImg?.src) {
        image = pinImg.src;
        // Try to get higher resolution version
        if (image.includes('/236x/') || image.includes('/474x/')) {
          image = image.replace(/\/\d+x\//, '/736x/');
        }
      }
    }

    // Fallback 2: any image in the main content
    if (!image) {
      const anyImg = document.querySelector('main img') || 
                     document.querySelector('article img') ||
                     document.querySelector('img[src*="http"]');
      if (anyImg?.src) {
        image = anyImg.src;
      }
    }

    // Extract author from pinterestapp:creator
    let author = ksGetMetaContent(['meta[name="pinterestapp:creator"]']);

    // Fallback: try to find author from DOM
    if (!author) {
      const authorEl =
        document.querySelector('a[href*="/"] span') ||
        document.querySelector('h2') ||
        document.querySelector('.tBJ.dyH.iFc.sAJ.O2T.zDA.IZT.swG') ||
        document.querySelector('[data-test-id="user-name"]') ||
        document.querySelector('.user-name');
      
      if (authorEl) {
        author = authorEl.innerText?.trim() || 
                 authorEl.textContent?.trim() || '';
      }
    }

    // Normalize image URL
    if (image) {
      image = ksNormalizeImageUrl(image);
    }

    return {
      platform: 'pinterest',
      title,
      image,
      author,
    };
  } catch {
    return {};
  }
};

/**
 * Reddit extractor - Perfect extraction with comprehensive selectors
 */
const ksExtractReddit = () => {
  try {
    // Extract title from og:title (most reliable)
    let title = ksGetMetaContent(['meta[property="og:title"]']);

    // Fallback: try to get title from DOM
    if (!title || title.trim() === '') {
      const titleEl =
        document.querySelector('h1[data-test-id="post-content"]') ||
        document.querySelector('h1[slot="title"]') ||
        document.querySelector('shreddit-post h1') ||
        document.querySelector('h1') ||
        document.querySelector('[data-testid="post-content"] h1') ||
        document.querySelector('h2');
      
      if (titleEl) {
        title = titleEl.innerText?.trim() || 
                titleEl.textContent?.trim() || '';
      }
    }

    // Extract image with comprehensive selectors
    let image = ksGetMetaContent(['meta[property="og:image"]']);

    // Fallback: try to find Reddit image from various sources
    if (!image) {
      // Priority 1: Reddit-hosted images
      const redditImg =
        document.querySelector('img[src*="i.redd.it"]') ||
        document.querySelector('img[src*="preview.redd.it"]') ||
        document.querySelector('img[src*="external-preview.redd.it"]') ||
        document.querySelector('shreddit-aspect-ratio img[src*="redd.it"]') ||
        document.querySelector('faceplate-img img[src*="redd.it"]');
      
      if (redditImg?.src) {
        image = redditImg.src;
        // Try to get full resolution if it's a preview
        if (image.includes('preview') || image.includes('thumbnail')) {
          image = image.replace(/\/preview\.|thumbnail/, '');
        }
      }
      
      // Priority 2: Post media container
      if (!image) {
        const mediaImg =
          document.querySelector('[data-test-id="post-content"] img[src*="http"]') ||
          document.querySelector('shreddit-post img[src*="http"]') ||
          document.querySelector('faceplate-media img[src*="http"]') ||
          document.querySelector('article img[src*="http"]') ||
          document.querySelector('main img[src*="http"]');
        
        if (mediaImg?.src && !mediaImg.src.includes('avatar') && !mediaImg.src.includes('icon')) {
          image = mediaImg.src;
        }
      }
    }

    // Extract author with comprehensive selectors
    let author = '';
    const authorEl = 
      document.querySelector("a[data-testid='post_author_link']") ||
      document.querySelector('a[href*="/user/"]') ||
      document.querySelector('a[href*="/u/"]') ||
      document.querySelector('shreddit-post a[href*="/user/"]') ||
      document.querySelector('faceplate-tracker a[href*="/user/"]') ||
      document.querySelector('[slot="authorName"]') ||
      document.querySelector('.author');
    
    if (authorEl) {
      author = authorEl.innerText?.trim() || 
               authorEl.textContent?.trim() || 
               authorEl.getAttribute('href')?.split('/').pop()?.replace('u_', '') || '';
      
      // Clean up author name (remove u/ prefix if present)
      if (author.startsWith('u/')) {
        author = author.substring(2);
      }
    }

    // Extract author image/profile picture
    let authorImage = '';
    const authorImgEl =
      document.querySelector('a[data-testid="post_author_link"] img') ||
      document.querySelector('a[href*="/user/"] img') ||
      document.querySelector('a[href*="/u/"] img') ||
      document.querySelector('shreddit-post img[alt*="avatar"]') ||
      document.querySelector('faceplate-tracker img[alt*="avatar"]') ||
      document.querySelector('[slot="authorName"] img');
    
    if (authorImgEl?.src && authorImgEl.src.includes('avatar')) {
      authorImage = authorImgEl.src;
    }

    // Extract content (post body text) with comprehensive selectors
    let content = '';
    
    // Priority 1: Look for markdown content container (most reliable for text posts)
    const mdContainer =
      document.querySelector('.md') ||
      document.querySelector('[data-test-id="post-content"] .md') ||
      document.querySelector('shreddit-post .md') ||
      document.querySelector('[slot="text-body"] .md');
    
    if (mdContainer) {
      content = mdContainer.innerText?.trim() || mdContainer.textContent?.trim() || '';
    }
    
    // Priority 2: Look for text-body slot or post content
    if (!content || content.trim() === '') {
      const textBodyEl =
        document.querySelector('[slot="text-body"]') ||
        document.querySelector('div[slot="text-body"]') ||
        document.querySelector('[data-test-id="post-content"] > div:not(:has(h1))') ||
        document.querySelector('shreddit-post > div:not(:has(h1))');
      
      if (textBodyEl) {
        const textContent = textBodyEl.innerText?.trim() || textBodyEl.textContent?.trim() || '';
        // Only use if it's not just the title
        if (textContent && textContent !== title) {
          content = textContent;
        }
      }
    }
    
    // Priority 3: Look for paragraph elements within post container
    if (!content || content.trim() === '') {
      const postContainer =
        document.querySelector('[data-test-id="post-content"]') ||
        document.querySelector('shreddit-post') ||
        document.querySelector('article');
      
      if (postContainer) {
        // Find all paragraphs, excluding title
        const paragraphs = postContainer.querySelectorAll('p');
        if (paragraphs.length > 0) {
          const textParts = Array.from(paragraphs)
            .map(p => p.innerText?.trim() || p.textContent?.trim() || '')
            .filter(text => text && text !== title);
          
          if (textParts.length > 0) {
            content = textParts.join('\n\n');
          }
        }
      }
    }
    
    // Priority 4: Fallback - try to get any text content from post area
    if (!content || content.trim() === '') {
      const fallbackEl =
        document.querySelector('[data-testid="post-content"] p') ||
        document.querySelector('shreddit-post p') ||
        document.querySelector('article p');
      
      if (fallbackEl) {
        const fallbackText = fallbackEl.innerText?.trim() || fallbackEl.textContent?.trim() || '';
        if (fallbackText && fallbackText !== title) {
          content = fallbackText;
        }
      }
    }
    
    // Clean up content - remove title if it appears at the start
    if (content && title) {
      if (content.startsWith(title)) {
        content = content.substring(title.length).trim();
      }
      // Remove common Reddit prefixes
      content = content.replace(/^r\/\w+\s*:\s*/i, '').trim();
    }

    // Normalize image URLs
    if (image) {
      image = ksNormalizeImageUrl(image);
    }
    if (authorImage) {
      authorImage = ksNormalizeImageUrl(authorImage);
    }

    // Build result object
    const result = {
      platform: 'reddit',
      image,
      author,
      authorImage,
      content,
    };

    // Only override title if we have a valid one
    if (title && title.trim() !== '') {
      result.title = title;
    }

    return result;
  } catch (error) {
    console.error('[AI Knowledge Saver] Reddit extraction error:', error);
    return {};
  }
};

/**
 * Generic website image extraction with fallbacks
 */
const ksExtractGenericImage = () => {
  // Priority 1: OpenGraph image
  let image = ksGetMetaContent([
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
  ]);

  if (image) {
    return ksNormalizeImageUrl(image);
  }

  // Priority 2: Twitter image
  image = ksGetMetaContent([
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  ]);

  if (image) {
    return ksNormalizeImageUrl(image);
  }

  // Priority 3: Article image
  const articleImg = document.querySelector('article img');
  if (articleImg?.src) {
    return ksNormalizeImageUrl(articleImg.src);
  }

  // Priority 4: Main image
  const mainImg = document.querySelector('main img');
  if (mainImg?.src) {
    return ksNormalizeImageUrl(mainImg.src);
  }

  // Priority 5: Any image
  const firstImg = document.querySelector('img');
  if (firstImg?.src) {
    return ksNormalizeImageUrl(firstImg.src);
  }

  return '';
};

/**
 * Check if platform requires full metadata extraction
 * Only Reddit, YouTube, Pinterest, and Twitter need full metadata
 */
const isSpecialPlatform = (platform) => {
  return ['reddit', 'youtube', 'pinterest', 'twitter'].includes(platform);
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

  // CRITICAL: Ensure title is never empty - use URL as fallback if needed
  const finalTitle = title.trim() || url || window.location.href || 'Untitled Page';

  // For non-special platforms, only extract title
  if (!isSpecialPlatform(platform)) {
    const minimalMetadata = {
      source: 'extension_dom',
      platform,
      url,
      title: finalTitle,
      description: '',
      content: '',
      image: '',
      favicon: '',
      author: '',
      authorImage: '',
      timestamp: '',
    };

    try {
      console.log('[AI Knowledge Saver] Layer1 extension metadata (title only):', minimalMetadata);
    } catch {
      // ignore
    }

    return minimalMetadata;
  }

  // For special platforms (Reddit, YouTube, Pinterest, Twitter), extract full metadata
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

  const favicon = ksGetFavicon() || `${location.origin}/favicon.ico`;

  // Base metadata object
  const base = {
    source: 'extension_dom',
    platform,
    url,
    title: finalTitle,
    description,
    content: '',
    image: imageFromMeta ? ksNormalizeImageUrl(imageFromMeta) : '',
    favicon,
    author: '',
    authorImage: '',
    timestamp: '',
  };

  // Platform-specific extraction
  let platformData = {};
  if (platform === 'twitter') {
    platformData = ksExtractTwitter();
  } else if (platform === 'youtube') {
    platformData = ksExtractYouTube();
  } else if (platform === 'linkedin') {
    platformData = ksExtractLinkedIn();
  } else if (platform === 'pinterest') {
    platformData = ksExtractPinterest();
  } else if (platform === 'reddit') {
    platformData = ksExtractReddit();
  }

  // Fallback: if platform extraction didn't provide image, try generic extraction
  if (!platformData.image) {
    // First try base image from meta tags
    if (base.image) {
      platformData.image = base.image;
    } else {
      // Then try generic image extraction
      const genericImage = ksExtractGenericImage();
      if (genericImage) {
        platformData.image = genericImage;
      }
    }
  }

  // Normalize all image URLs in platform data
  if (platformData.image) {
    platformData.image = ksNormalizeImageUrl(platformData.image);
  }
  if (platformData.authorImage) {
    platformData.authorImage = ksNormalizeImageUrl(platformData.authorImage);
  }

  // Merge: platform metadata overrides base metadata
  // Only include platform data fields that have actual values (not empty strings or undefined)
  const filteredPlatformData = {};
  for (const [key, value] of Object.entries(platformData)) {
    if (value !== undefined && value !== null && value !== '') {
      filteredPlatformData[key] = value;
    }
  }
  
  const merged = {
    ...base,
    ...filteredPlatformData,
  };

  // Ensure image is normalized in final merged object (final safety check)
  if (merged.image) {
    merged.image = ksNormalizeImageUrl(merged.image);
  }
  if (merged.authorImage) {
    merged.authorImage = ksNormalizeImageUrl(merged.authorImage);
  }

  // CRITICAL: Ensure required fields are always present
  // Title must never be empty - use URL as fallback if needed
  if (!merged.title || merged.title.trim() === '') {
    merged.title = merged.url || window.location.href || 'Untitled Page';
  }

  // URL must always be present
  if (!merged.url || merged.url.trim() === '') {
    merged.url = window.location.href;
  }

  try {
    console.log('[AI Knowledge Saver] Layer1 extension metadata:', merged);
  } catch {
    // ignore
  }

  return merged;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_PAGE_METADATA') return;

  // Delay for SPA websites - Reddit needs more time to load
  const platform = ksDetectPlatform(window.location.href);
  const delay = platform === 'reddit' ? 1500 : 500;

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
  }, delay);

  return true;
});
