import { getSession } from '../utils/sessionStore.js';

export const requireSession = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.session;
    if (!sessionId) {
      return res.status(401).json({
        ok: false,
        error: 'Not authenticated',
      });
    }

    const session = await getSession(sessionId);
    if (!session || !session.userId) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid session',
      });
    }

    req.auth = {
      userId: session.userId,
    };

    return next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: 'Session validation failed',
    });
  }
};

