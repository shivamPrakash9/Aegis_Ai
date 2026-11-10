// Authentication Routes

import { Router } from 'express';
import {
  getMe,
  login,
  logout,
  refresh,
  register
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema
} from '../schemas';

const router = Router();

router.post(
  '/login',
  validate(loginSchema, 'body'),
  login
);

router.post(
  '/register',
  validate(registerSchema, 'body'),
  register
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
