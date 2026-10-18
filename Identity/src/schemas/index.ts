// AJV Validation Schemas for REST API Endpoints

import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';
import { ALL_PERMISSIONS } from '../utils/permissions';

export const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'all',
  useDefaults: true,
  coerceTypes: true
});

addFormats(ajv);

// --- Organizations ---

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  bootstrapKey?: string;
  adminUser?: {
    email: string;
    password: string;
    displayName: string;
  };
}

export const createOrganizationSchema: JSONSchemaType<CreateOrganizationInput> = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    slug: {
      type: 'string',
      minLength: 2,
      maxLength: 50,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    },
    bootstrapKey: { type: 'string', minLength: 16, nullable: true },
    adminUser: {
      type: 'object',
      nullable: true,
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8, maxLength: 128 },
        displayName: { type: 'string', minLength: 2, maxLength: 100 }
      },
      required: ['email', 'password', 'displayName']
    }
  },
  required: ['name', 'slug'],
  additionalProperties: false
};

export interface UpdateOrganizationInput {
  name?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

export const updateOrganizationSchema: JSONSchemaType<UpdateOrganizationInput> = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100, nullable: true },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
      nullable: true
    }
  },
  required: [],
  additionalProperties: false
};

// --- Auth ---

export interface LoginInput {
  email: string;
  password: string;
}

export const loginSchema: JSONSchemaType<LoginInput> = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8, maxLength: 128 }
  },
  required: ['email', 'password'],
  additionalProperties: false
};

export interface RefreshInput {
  refreshToken: string;
}

export const refreshSchema: JSONSchemaType<RefreshInput> = {
  type: 'object',
  properties: {
    refreshToken: { type: 'string', minLength: 20 }
  },
  required: ['refreshToken'],
  additionalProperties: false
};

export interface LogoutInput {
  refreshToken: string;
}

export const logoutSchema: JSONSchemaType<LogoutInput> = {
  type: 'object',
  properties: {
    refreshToken: { type: 'string', minLength: 20 }
  },
  required: ['refreshToken'],
  additionalProperties: false
};

// --- Users ---

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role?: 'ORGANIZATION_ADMIN' | 'DEVELOPER' | 'SECURITY_AUDITOR';
}

export const createUserSchema: JSONSchemaType<CreateUserInput> = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    displayName: { type: 'string', minLength: 1, maxLength: 100 },
    role: {
      type: 'string',
      enum: ['ORGANIZATION_ADMIN', 'DEVELOPER', 'SECURITY_AUDITOR'],
      nullable: true
    }
  },
  required: ['email', 'password', 'displayName'],
  additionalProperties: false
};

export interface UpdateUserInput {
  displayName?: string;
  role?: 'ORGANIZATION_ADMIN' | 'DEVELOPER' | 'SECURITY_AUDITOR';
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export const updateUserSchema: JSONSchemaType<UpdateUserInput> = {
  type: 'object',
  properties: {
    displayName: { type: 'string', minLength: 1, maxLength: 100, nullable: true },
    role: {
      type: 'string',
      enum: ['ORGANIZATION_ADMIN', 'DEVELOPER', 'SECURITY_AUDITOR'],
      nullable: true
    },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      nullable: true
    }
  },
  required: [],
  additionalProperties: false
};

// --- Service Accounts ---

export interface CreateServiceAccountInput {
  name: string;
  permissions: string[];
}

export const createServiceAccountSchema: JSONSchemaType<CreateServiceAccountInput> = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    permissions: {
      type: 'array',
      items: { type: 'string', enum: ALL_PERMISSIONS },
      minItems: 1,
      uniqueItems: true
    }
  },
  required: ['name', 'permissions'],
  additionalProperties: false
};

// --- Session Verification ---

export interface VerifySessionInput {
  token: string;
}

export const verifySessionSchema: JSONSchemaType<VerifySessionInput> = {
  type: 'object',
  properties: {
    token: { type: 'string', minLength: 10 }
  },
  required: ['token'],
  additionalProperties: false
};

// --- Pagination Query ---

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export const paginationQuerySchema: JSONSchemaType<PaginationQuery> = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, nullable: true },
    limit: { type: 'integer', minimum: 1, maximum: 100, nullable: true }
  },
  required: [],
  additionalProperties: false
};
