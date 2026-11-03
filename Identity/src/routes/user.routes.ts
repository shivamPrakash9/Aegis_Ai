// User Management Routes

import { Router } from 'express';
import {
  createUser,
  disableUser,
  getUser,
  listUsers,
  updateUser
} from '../controllers/user.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createUserSchema,
  paginationQuerySchema,
  updateUserSchema
} from '../schemas';

const router = Router();

// All user management routes require authentication
router.use(authenticateToken);

router.post(
  '/',
  requirePermission('users:create'),
  validate(createUserSchema, 'body'),
  createUser
);

router.get(
  '/',
  requirePermission('users:read'),
  validate(paginationQuerySchema, 'query'),
  listUsers
);

router.get(
  '/:userId',
  requirePermission('users:read'),
  getUser
);

router.patch(
  '/:userId',
  requirePermission('users:update'),
  validate(updateUserSchema, 'body'),
  updateUser
);

router.post(
  '/:userId/disable',
  requirePermission('users:disable'),
  disableUser
);

export const userRoutes = router;
