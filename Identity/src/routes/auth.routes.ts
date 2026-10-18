// Authentication Routes

import { Router } from 'express';
import {
  getMe,
  login,
  logout,
  refresh
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  loginSchema,
  logoutSchema,
  refreshSchema
} from '../schemas';

const router = Router();

router.post(
  '/login',
  validate(loginSchema, 'body'),
  login
);

router.post(
  '/refresh',
  validate(refreshSchema, 'body'),
  refresh
);

router.post(
  '/logout',
  validate(logoutSchema, 'body'),
  logout
);

router.get(
  '/me',
  authenticateToken,
  getMe
);

export const authRoutes = router;
