// Main API Router Mounting All Service Endpoints

import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { healthRoutes } from './health.routes';
import { organizationRoutes } from './organization.routes';
import { serviceAccountRoutes } from './serviceAccount.routes';
import { sessionRoutes } from './session.routes';
import { userRoutes } from './user.routes';

const router = Router();

// Health checks
router.use('/health', healthRoutes);

// Version 1 API routes
const v1Router = Router();
v1Router.use('/organizations', organizationRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/service-accounts', serviceAccountRoutes);
v1Router.use('/sessions', sessionRoutes);

router.use('/v1', v1Router);

export const mainRouter = router;
