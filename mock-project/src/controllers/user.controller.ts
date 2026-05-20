import { Router } from 'express';

const router = Router();

// GET /users/me with auth middleware
router.get('/users/me', authMiddleware, (req, res) => {
  res.send({ id: 1, name: 'John Doe' });
});

function authMiddleware(req: any, res: any, next: any) {
  next();
}

export default router;
