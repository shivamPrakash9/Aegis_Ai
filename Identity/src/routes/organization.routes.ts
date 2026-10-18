// Organization Routes

import { Router } from 'express';
import {
  createOrganization,
  getOrganization,
  updateOrganization
} from '../controllers/organization.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createOrganizationSchema,
  updateOrganizationSchema
} from '../schemas';

const router = Router();

router.post(
  '/',
  validate(createOrganizationSchema, 'body'),
  createOrganization
);

router.get(
  '/:organizationId',
  authenticateToken,
  requirePermission('organization:read'),
  getOrganization
);

router.patch(
  '/:organizationId',
  authenticateToken,
  requirePermission('organization:update'),
  validate(updateOrganizationSchema, 'body'),
  updateOrganization
);

export const organizationRoutes = router;
