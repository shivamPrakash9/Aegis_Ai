// Session & Token Verification Routes

import { Router } from 'express';
import { verifySession } from '../controllers/session.controller';
import { validate } from '../middleware/validate';
import { verifySessionSchema } from '../schemas';

const router = Router();

router.post(
  '/verify',
  validate(verifySessionSchema, 'body'),
  verifySession
);

export const sessionRoutes = router;
