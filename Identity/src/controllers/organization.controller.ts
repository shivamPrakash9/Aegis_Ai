// Organization Controller

import { NextFunction, Request, Response } from 'express';
import { organizationService } from '../services/organization.service';

export async function createOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await organizationService.createOrganization(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.params.organizationId as string;
    const result = await organizationService.getOrganization(
      req.principal!,
      organizationId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.params.organizationId as string;
    const result = await organizationService.updateOrganization(
      req.principal!,
      organizationId,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
