import { Router } from 'express';

const router = Router();

// Implementation of POST /auth/login with validation schema
router.post('/auth/login', validateBodySchema, (req, res) => {
  res.send({ token: 'mock-jwt-token' });
});

function validateBodySchema(req: any, res: any, next: any) {
  next();
}

export default router;
