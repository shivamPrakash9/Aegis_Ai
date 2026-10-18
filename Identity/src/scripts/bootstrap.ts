// Administrative Bootstrap CLI Script
// Securely initializes the initial organization and first organization administrator

import { disconnectDatabase, prisma } from '../config/database';
import { hashPassword } from '../utils/crypto';
import { logger } from '../utils/logger';

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value) {
        args[key] = value;
      }
    }
  });
  return args;
}

async function runBootstrap() {
  const args = parseArgs();
  const orgName = args['org-name'] || 'Aegis Enterprise Root';
  const orgSlug = (args['org-slug'] || 'aegis-root').toLowerCase();
  const adminEmail = (args['admin-email'] || 'admin@aegis.local').toLowerCase();
  const adminName = args['admin-name'] || 'System Administrator';
  const adminPassword = args['admin-password'];

  if (!adminPassword || adminPassword.length < 12) {
    console.error('Error: --admin-password is required and must be at least 12 characters.');
    process.exit(1);
  }

  logger.info({ orgSlug, adminEmail }, 'Starting administrative bootstrap...');

  try {
    // Check if organization already exists
    let org = await prisma.organization.findUnique({
      where: { slug: orgSlug }
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          status: 'ACTIVE'
        }
      });
      logger.info({ orgId: org.id }, 'Organization created.');
    } else {
      logger.info({ orgId: org.id }, 'Organization already exists, checking for admin user.');
    }

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        organizationId: org.id,
        role: 'ORGANIZATION_ADMIN'
      }
    });

    if (existingAdmin) {
      console.warn(
        `[WARNING] An organization administrator already exists for organization '${orgSlug}' (${existingAdmin.email}). Bootstrap aborted to prevent unauthorized takeover.`
      );
      process.exit(1);
    }

    const passwordHash = await hashPassword(adminPassword);
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: adminEmail,
        passwordHash,
        displayName: adminName,
        role: 'ORGANIZATION_ADMIN',
        status: 'ACTIVE'
      }
    });

    console.log('\n=============================================');
    console.log('✓ Administrative Bootstrap Succeeded!');
    console.log('---------------------------------------------');
    console.log(`Organization ID:   ${org.id}`);
    console.log(`Organization Name: ${org.name}`);
    console.log(`Organization Slug: ${org.slug}`);
    console.log(`Admin User ID:     ${user.id}`);
    console.log(`Admin Email:       ${user.email}`);
    console.log(`Admin Role:        ${user.role}`);
    console.log('=============================================\n');
  } catch (error: any) {
    logger.error({ err: error.message }, 'Bootstrap execution failed');
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runBootstrap();
