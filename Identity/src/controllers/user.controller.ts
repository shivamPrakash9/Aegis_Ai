// User Controller

import { NextFunction, Request, Response } from 'express';
import { userService } from '../services/user.service';

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await userService.createUser(req.principal!, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await userService.listUsers(req.principal!, req.query as any);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.params.userId as string;
    const result = await userService.getUser(req.principal!, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.params.userId as string;
    const result = await userService.updateUser(req.principal!, userId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function disableUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.params.userId as string;
    const result = await userService.disableUser(req.principal!, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
