import { Router } from 'express';

const router = Router();

// GET /items (no auth/validation)
router.get('/items', (req, res) => {
  res.send([]);
});

// POST /items (missing auth and validation in code, but spec requires it!)
router.post('/items', (req, res) => {
  res.send({ id: 2 });
});

export default router;
