// Service Account Routes

import { Router } from 'express';
import {
  createServiceAccount,
  getServiceAccount,
  listServiceAccounts,
  revokeServiceAccount,
  rotateServiceAccount
} from '../controllers/serviceAccount.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createServiceAccountSchema,
  paginationQuerySchema
} from '../schemas';

const router = Router();

// All service account routes require authentication
router.use(authenticateToken);

router.post(
  '/',
  requirePermission('service_accounts:create'),
  validate(createServiceAccountSchema, 'body'),
  createServiceAccount
);

router.get(
  '/',
  requirePermission('service_accounts:read'),
  validate(paginationQuerySchema, 'query'),
  listServiceAccounts
);

router.get(
  '/:serviceAccountId',
  requirePermission('service_accounts:read'),
  getServiceAccount
);

router.post(
  '/:serviceAccountId/rotate',
  requirePermission('service_accounts:rotate'),
  rotateServiceAccount
);

router.post(
  '/:serviceAccountId/revoke',
  requirePermission('service_accounts:revoke'),
  revokeServiceAccount
);

export const serviceAccountRoutes = router;
