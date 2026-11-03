// GraphQL Schema Definition for AegisAI Gateway
// Conforms to Web Services Assignment Module 1, 3, 4 Requirement 15

const { buildSchema } = require('graphql');

const schemaString = `
  type User {
    id: ID!
    email: String
    role: String!
    organizationId: String!
  }

  type Organization {
    id: ID!
    name: String!
    slug: String!
    status: String!
  }

  type ModelMetadata {
    id: ID!
    name: String!
    provider: String!
    contextWindow: Int
    description: String
  }

  type TraceEvent {
    eventId: String!
    eventType: String!
    timestamp: String!
    severity: String!
    outcome: String
    action: String
    sourceService: String
  }

  type AiRequestTrace {
    requestId: String!
    traceId: String!
    events: [TraceEvent!]!
  }

  type AiRequest {
    id: ID!
    organizationId: String!
    callerId: String!
    status: String!
    modelSelected: String
    sanitizedPromptSummary: String
    sanitizedResult: String
    traceId: String!
    privacyAction: String
    policyDecision: String
    errorCode: String
    errorMessage: String
    createdAt: String!
    completedAt: String
  }

  type AiRequestConnection {
    items: [AiRequest!]!
    nextCursor: String
    total: Int
    hasMore: Boolean!
  }

  type Policy {
    id: ID!
    name: String!
    action: String!
    description: String
  }

  input MessageInput {
    role: String!
    content: String!
  }

  input AiRequestInput {
    messages: [MessageInput!]!
    modelPreference: String
    idempotencyKey: String
  }

  type AiRequestSubmissionResult {
    requestId: String!
    status: String!
    traceId: String!
    statusUrl: String!
  }

  type Query {
    me: User
    organization: Organization
    models: [ModelMetadata!]!
    aiRequests(limit: Int, cursor: String, status: String): AiRequestConnection!
    aiRequest(id: ID!): AiRequest
    aiRequestTrace(id: ID!): AiRequestTrace
    policies: [Policy!]!
  }

  type Mutation {
    submitAiRequest(input: AiRequestInput!): AiRequestSubmissionResult!
  }
`;

const schema = buildSchema(schemaString);

module.exports = {
  schema,
  schemaString
};

