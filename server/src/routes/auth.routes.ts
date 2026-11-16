import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../services/database.service';
import { JWT_SECRET, authenticateToken, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserRole } from '../types';
import { authenticateUser, findUserByEmail, findUserById, getProfile, registerUser } from '../services/user.service';

const router = Router();

// 1. Public registration is intentionally limited to candidates. Interviewers
// are provisioned by a super admin so every host belongs to an organization.
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role, organization, title, skills, phone, resume_url, portfolio_url } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);
    if (role && role !== 'candidate') {
      return res.status(403).json({ error: 'Interviewer accounts can only be created by an administrator.' });
    }
    const assignedRole: UserRole = 'candidate';

    const newUser = await registerUser({
      email, full_name, role: assignedRole, password, password_hash, organization, title, phone, resume_url, portfolio_url,
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map((s: string) => s.trim()) : [])
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. User Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or credentials.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been suspended or deactivated.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const profile = user.role === 'super_admin' ? null : await getProfile(user);

    return res.json({
      message: 'Authentication successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      profile
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Get Current Profile
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user = await findUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const profile = user.role === 'super_admin' ? null : await getProfile(user);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      avatar_url: user.avatar_url,
      is_active: user.is_active
    },
    profile
  });
});

// 4. Update Profile
router.patch('/profile', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const user = db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { full_name, avatar_url, ...profileUpdates } = req.body;
  if (full_name) {
    db.updateUser(userId, { full_name, avatar_url });
  }

  if (user.role === 'interviewer') {
    const current = db.getInterviewerProfile(userId);
    if (current) {
      const updated = { ...current, ...profileUpdates };
      db.setInterviewerProfile(updated);
    }
  } else if (user.role === 'candidate') {
    const current = db.getCandidateProfile(userId);
    if (current) {
      const updated = { ...current, ...profileUpdates };
      db.setCandidateProfile(updated);
    }
  }

  return res.json({ message: 'Profile updated successfully.' });
});

export default router;
