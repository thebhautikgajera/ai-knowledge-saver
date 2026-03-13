/**
 * Role-based access control helpers.
 * Assumes `requireAuth` has already populated `req.auth`.
 */

export const requireRole = (roles) => {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const role = req.auth?.role;

    if (!role || !allowed.includes(role)) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: insufficient permissions',
      });
    }

    return next();
  };
};

export const requireAdmin = requireRole('admin');

