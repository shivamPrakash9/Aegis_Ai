// Session Controller for Gateway / Inter-Service Credential Verification

import { NextFunction, Request, Response } from 'express';
import { sessionService } from '../services/session.service';

export async function verifySession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = req.body;
    const result = await sessionService.verifyCredential(token);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
