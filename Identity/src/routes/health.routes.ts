// Health Routes

import { Router } from 'express';
import { getLive, getReady } from '../controllers/health.controller';

const router = Router();

router.get('/live', getLive);
router.get('/ready', getReady);

export const healthRoutes = router;
