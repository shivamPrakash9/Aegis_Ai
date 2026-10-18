// Organization Repository

import { Organization, OrganizationStatus, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export class OrganizationRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id }
    });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { slug: slug.toLowerCase() }
    });
  }

  async create(data: {
    name: string;
    slug: string;
    status?: OrganizationStatus;
  }): Promise<Organization> {
    return this.prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug.toLowerCase(),
        status: data.status || 'ACTIVE'
      }
    });
  }

  async update(
    id: string,
    data: { name?: string; status?: OrganizationStatus }
  ): Promise<Organization> {
    return this.prisma.organization.update({
      where: { id },
      data
    });
  }
}

export const organizationRepository = new OrganizationRepository();
