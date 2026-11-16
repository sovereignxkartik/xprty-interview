import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById } from '../services/user.service';
import { UserRole } from '../types';

export const JWT_SECRET = process.env.JWT_SECRET || 'xprty_interview_enterprise_jwt_secret_2026';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    full_name: string;
  };
}

/**
 * Authentication verification middleware
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }

    try {
      const user = await findUserById(decoded.id);
      if (!user || !user.is_active) return res.status(403).json({ error: 'User account is deactivated or no longer exists.' });
      req.user = { id: user.id, email: user.email, role: user.role, full_name: user.full_name };
      next();
    } catch {
      return res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
    }
  });
}

/**
 * Role-Based Access Control (RBAC) middleware
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
      });
    }

    next();
  };
}
