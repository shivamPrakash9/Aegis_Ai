// Legacy Employee REST Route wrapping SOAP 1.1 Operation
// Conforms to Web Services Assignment Module 1, 3, 4 Requirement 23 (WSDL and SOAP)

import { Router, Request, Response, NextFunction } from 'express';
import { legacyEmployeeClient } from '../integrations/soap/legacyEmployeeClient';

const router = Router();

// GET /v1/legacy-employees/:employeeId
router.get('/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = Array.isArray(req.params.employeeId) ? req.params.employeeId[0] : (req.params.employeeId || '');
    const result = await legacyEmployeeClient.checkEmployee(employeeId, req.correlationId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const legacyEmployeeRoutes = router;

