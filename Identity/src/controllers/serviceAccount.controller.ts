// Service Account Controller

import { NextFunction, Request, Response } from 'express';
import { serviceAccountService } from '../services/serviceAccount.service';

export async function createServiceAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await serviceAccountService.createServiceAccount(
      req.principal!,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listServiceAccounts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await serviceAccountService.listServiceAccounts(
      req.principal!,
      req.query as any
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getServiceAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const serviceAccountId = req.params.serviceAccountId as string;
    const result = await serviceAccountService.getServiceAccount(
      req.principal!,
      serviceAccountId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function rotateServiceAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const serviceAccountId = req.params.serviceAccountId as string;
    const result = await serviceAccountService.rotateServiceAccount(
      req.principal!,
      serviceAccountId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function revokeServiceAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const serviceAccountId = req.params.serviceAccountId as string;
    const result = await serviceAccountService.revokeServiceAccount(
      req.principal!,
      serviceAccountId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
