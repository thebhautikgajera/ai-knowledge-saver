import express from 'express';
import { Item } from '../models/Item.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Protect all item routes
router.use(requireAuth);

// POST /api/items - create a new saved item
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

  if (hostname.includes('reddit.com') || hostname.includes('medium.com')) {
    return 'article';
  }

  return 'article';
};

router.post('/', async (req, res, next) => {
  try {
    const {
      title,
      url,
      description: incomingDescription,
      domain,
      favicon: incomingFavicon,
      type,
      previewImage: incomingPreviewImage,
      extraMetadata,
    } = req.body || {};

    // Temporary debug log to verify incoming metadata from extension / clients
    console.log('[AI Knowledge Saver][items] Incoming create payload summary:', {
      title,
      url,
      domain,
      favicon: incomingFavicon,
      type,
      hasPreviewImage: !!incomingPreviewImage,
      descriptionLength:
        typeof incomingDescription === 'string' ? incomingDescription.length : 0,
    });

    if (!title || !url) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: title, url',
      });
    }

    let resolvedDomain = domain ?? '';
    if (!resolvedDomain) {
      try {
        const parsed = new URL(url);
        resolvedDomain = parsed.hostname;
      } catch {
        resolvedDomain = '';
      }
    }

    const resolvedType = type || inferTypeFromUrl(url);

    // Ensure we always have some reasonable description text
    let resolvedDescription =
      typeof incomingDescription === 'string' ? incomingDescription.trim() : '';
    if (!resolvedDescription) {
      resolvedDescription = title.trim();
    }

    // Best-effort favicon if the client couldn't extract one
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

    // Try to infer a preview image when missing, especially for YouTube
    let resolvedPreviewImage =
      typeof incomingPreviewImage === 'string'
        ? incomingPreviewImage.trim()
        : '';

    if (!resolvedPreviewImage && resolvedType === 'video') {
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
          resolvedPreviewImage = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
        }
      } catch {
        // ignore and keep empty
      }
    }

    const item = await Item.create({
      title: title.trim(),
      url: url.trim(),
      description: resolvedDescription,
      domain: resolvedDomain,
      favicon: resolvedFavicon,
      type: resolvedType,
      previewImage: resolvedPreviewImage,
      extraMetadata: extraMetadata && typeof extraMetadata === 'object' ? extraMetadata : {},
      userId: req.auth.userId,
    });

    return res.status(201).json({
      ok: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/items - fetch all items for the authenticated user
router.get('/', async (req, res, next) => {
  try {
    const { q, type } = req.query || {};

    const query = {
      userId: req.auth.userId,
    };

    if (type && ['article', 'video', 'tweet'].includes(type)) {
      query.type = type;
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [
        { title: regex },
        { description: regex },
        { domain: regex },
      ];
    }

    const items = await Item.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      ok: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/items/:id - delete a saved item
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await Item.findOneAndDelete({
      _id: id,
      userId: req.auth.userId,
    }).lean();

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: 'Item not found',
      });
    }

    return res.json({
      ok: true,
      data: { id },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

