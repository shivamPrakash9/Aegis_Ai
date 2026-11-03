import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/crypto';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.IDENTITY_DATABASE_URL || 'postgresql://aegis_identity_user:aegis_identity_secure_password@localhost:5432/aegis_identity?schema=public'
    }
  }
});

async function seed() {
  console.log('Seeding development organizations and accounts...');

  // 1. Create Enterprise Alpha Organization
  const orgAlpha = await prisma.organization.upsert({
    where: { slug: 'org_enterprise_alpha' },
    update: {},
    create: {
      name: 'Enterprise Alpha Corp',
      slug: 'org_enterprise_alpha',
      status: 'ACTIVE'
    }
  });
  console.log(`✓ Organization Alpha: ${orgAlpha.id} (${orgAlpha.slug})`);

  // 2. Create Enterprise Beta Organization
  const orgBeta = await prisma.organization.upsert({
    where: { slug: 'org_enterprise_beta' },
    update: {},
    create: {
      name: 'Enterprise Beta Corp',
      slug: 'org_enterprise_beta',
      status: 'ACTIVE'
    }
  });
  console.log(`✓ Organization Beta: ${orgBeta.id} (${orgBeta.slug})`);

  // 3. Admin Account
  const adminPassHash = await hashPassword('AdminSecurePassword!2026');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@enterprise.internal' },
    update: { passwordHash: adminPassHash, organizationId: orgAlpha.id },
    create: {
      organizationId: orgAlpha.id,
      email: 'admin@enterprise.internal',
      passwordHash: adminPassHash,
      displayName: 'Admin Lead',
      role: 'ORGANIZATION_ADMIN',
      status: 'ACTIVE'
    }
  });
  console.log(`✓ Admin User: ${adminUser.email} (Password: AdminSecurePassword!2026)`);

  // 4. Developer Account
  const devPassHash = await hashPassword('DevSecurePassword!2026');
  const devUser = await prisma.user.upsert({
    where: { email: 'developer@enterprise.internal' },
    update: { passwordHash: devPassHash, organizationId: orgAlpha.id },
    create: {
      organizationId: orgAlpha.id,
      email: 'developer@enterprise.internal',
      passwordHash: devPassHash,
      displayName: 'Alice Developer',
      role: 'DEVELOPER',
      status: 'ACTIVE'
    }
  });
  console.log(`✓ Developer User: ${devUser.email} (Password: DevSecurePassword!2026)`);

  // 5. Security Auditor Account
  const auditorPassHash = await hashPassword('AuditorSecurePassword!2026');
  const auditorUser = await prisma.user.upsert({
    where: { email: 'auditor@enterprise.internal' },
    update: { passwordHash: auditorPassHash, organizationId: orgAlpha.id },
    create: {
      organizationId: orgAlpha.id,
      email: 'auditor@enterprise.internal',
      passwordHash: auditorPassHash,
      displayName: 'Bob Auditor',
      role: 'SECURITY_AUDITOR',
      status: 'ACTIVE'
    }
  });
  console.log(`✓ Auditor User: ${auditorUser.email} (Password: AuditorSecurePassword!2026)`);

  console.log('\nSeed completed successfully!');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
