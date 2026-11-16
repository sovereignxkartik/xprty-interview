import { Router, Request, Response } from 'express';
import { db } from '../services/database.service';

const router = Router();

// Get current mock or authenticated user
router.get('/users', (req: Request, res: Response) => {
  return res.json(db.getAllUsers());
});

router.get('/users/:id', (req: Request, res: Response) => {
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
});

export default router;
