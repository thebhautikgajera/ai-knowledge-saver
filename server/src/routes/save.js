import express from 'express';
import { Item } from '../models/Item.js';
import { requireSession } from '../middleware/sessionAuth.js';
import { detectPlatform } from '../utils/platformDetection.js';
import { enqueueMetadataEnrichment } from '../utils/metadataQueue.js';

const router = express.Router();

// Protect save endpoint with cookie-based session authentication
router.use(requireSession);

// GET /save/status - used by the extension to check if it's connected
router.get('/status', (req, res) => {
  // If we reached here, requireSession has already validated the session
  return res.json({
    ok: true,
    connected: true,
  });
});

/**
 * Check if platform requires full metadata extraction
 * Only Reddit, YouTube, Pinterest, and Twitter need full metadata
 */
const isSpecialPlatform = (platform) => {
  return ['reddit', 'youtube', 'pinterest', 'twitter'].includes(platform);
};

const inferTypeFromUrl = (rawUrl) => {
  if (!rawUrl) return 'article';

  let hostname = '';
  try {
    const parsed = new URL(rawUrl);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    hostname = rawUrl.toLowerCase();
  }

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'video';
  }

  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    return 'tweet';
  }

  return 'article';
};

// POST /save - primary endpoint for extension saves
router.post('/', async (req, res, next) => {
  try {
    const { extensionMetadata = {} } = req.body || {};

    const url = extensionMetadata.url;
    const title = extensionMetadata.title;

    const incomingDescription = extensionMetadata.description ?? '';
    const incomingFavicon = extensionMetadata.favicon ?? '';
    const incomingImage = extensionMetadata.image ?? '';

    const platform = extensionMetadata.platform || detectPlatform(url);

    console.log('[AI Knowledge Saver][save] Incoming extension payload:', {
      title,
      url,
      platform,
      hasImage: !!incomingImage,
      descriptionLength:
        typeof incomingDescription === 'string' ? incomingDescription.length : 0,
    });

    if (!title || !url) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: title, url',
      });
    }

    let resolvedDomain = '';
    try {
      const parsed = new URL(url);
      resolvedDomain = parsed.hostname;
    } catch {
      resolvedDomain = '';
    }

    // Infer type from URL or use extension-provided type
    const resolvedType = extensionMetadata.type || inferTypeFromUrl(url);

    // For non-special platforms, only store title and required fields
    if (!isSpecialPlatform(platform)) {
      const item = await Item.create({
        title: title.trim(),
        url: url.trim(),
        description: '', // Empty for non-special platforms
        content: '', // Empty for non-special platforms
        domain: resolvedDomain,
        favicon: '', // Empty for non-special platforms
        image: '', // Empty for non-special platforms
        type: resolvedType,
        platform,
        author: '', // Empty for non-special platforms
        authorImage: '', // Empty for non-special platforms
        extraMetadata: {},
        userId: req.auth.userId,
        metadataSource: extensionMetadata.source || 'extension_dom',
        updatedAt: new Date(),
      });

      // Skip metadata enrichment for non-special platforms
      return res.status(201).json({
        ok: true,
        data: item,
      });
    }

    // For special platforms (Reddit, YouTube, Pinterest, Twitter), extract full metadata
    let resolvedDescription =
      typeof incomingDescription === 'string'
        ? incomingDescription.trim()
        : '';
    if (!resolvedDescription) {
      resolvedDescription = title.trim();
    }

    let resolvedFavicon =
      typeof incomingFavicon === 'string' ? incomingFavicon.trim() : '';
    if (!resolvedFavicon && resolvedDomain) {
      try {
        const parsed = new URL(url);
        const protocol = parsed.protocol || 'https:';
        const hostname = parsed.hostname.replace(/^www\./i, '');
        resolvedFavicon = `${protocol}//${hostname}/favicon.ico`;
      } catch {
        const cleanDomain = resolvedDomain.replace(/^www\./i, '');
        resolvedFavicon = `https://${cleanDomain}/favicon.ico`;
      }
    }

    let resolvedImage =
      typeof incomingImage === 'string' ? incomingImage.trim() : '';

    if (!resolvedImage && resolvedType === 'video') {
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        let videoId = null;

        if (hostname.includes('youtube.com')) {
          videoId = parsed.searchParams.get('v');
        } else if (hostname.includes('youtu.be')) {
          videoId = parsed.pathname.replace('/', '') || null;
        }

        if (videoId) {
          resolvedImage = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
        }
      } catch {
        // ignore
      }
    }

    const item = await Item.create({
      title: title.trim(),
      url: url.trim(),
      description: resolvedDescription,
      content: extensionMetadata.content || '',
      domain: resolvedDomain,
      favicon: resolvedFavicon,
      image: resolvedImage,
      type: resolvedType,
      platform,
      author: extensionMetadata.author || '',
      authorImage: extensionMetadata.authorImage || '',
      extraMetadata: {},
      userId: req.auth.userId,
      metadataSource: extensionMetadata.source || 'extension_dom',
      updatedAt: new Date(),
    });

    enqueueMetadataEnrichment(item._id, url, extensionMetadata);

    return res.status(201).json({
      ok: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

