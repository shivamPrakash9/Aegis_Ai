// Seed Script for ModelProvider Database (aegis_model)
// Persists default models and providers into PostgreSQL

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { getPrismaClient } = require('../config/database');
const { env } = require('../config/env');
const { encryptSecret } = require('../utils/crypto');

const DEFAULT_MODELS = [
  {
    modelId: 'gemini-3.5-flash-lite',
    provider: 'gemini',
    providerModelName: 'gemini-3.5-flash-lite',
    enabled: true,
    isDefault: true,
    maxTokens: 8192,
    contextWindow: 1000000,
    defaultTemperature: 0.7,
    capabilities: JSON.stringify(['chat', 'reasoning', 'coding']),
    description: 'Google Gemini 3.5 Flash Lite - Ultra-fast and highly capable multimodal model'
  },
  {
    modelId: 'gemini-3.1-flash-lite',
    provider: 'gemini',
    providerModelName: 'gemini-3.1-flash-lite',
    enabled: true,
    isDefault: false,
    maxTokens: 8192,
    contextWindow: 1000000,
    defaultTemperature: 0.7,
    capabilities: JSON.stringify(['chat', 'reasoning', 'coding']),
    description: 'Google Gemini 3.1 Flash Lite - Fast, high-efficiency model'
  },
  {
    modelId: 'gemini-flash-lite-latest',
    provider: 'gemini',
    providerModelName: 'gemini-flash-lite-latest',
    enabled: true,
    isDefault: false,
    maxTokens: 8192,
    contextWindow: 1000000,
    defaultTemperature: 0.7,
    capabilities: JSON.stringify(['chat', 'reasoning']),
    description: 'Latest Google Gemini Flash Lite preview'
  },
  {
    modelId: 'gemini',
    provider: 'gemini',
    providerModelName: env.geminiModel || 'gemini-3.5-flash-lite',
    enabled: true,
    isDefault: false,
    maxTokens: 8192,
    contextWindow: 1000000,
    defaultTemperature: 0.7,
    capabilities: JSON.stringify(['chat', 'reasoning', 'coding']),
    description: 'Google Gemini (default configured model)'
  },
  {
    modelId: 'gpt-4o',
    provider: 'openai',
    providerModelName: 'gpt-4o-2024-08-06',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: JSON.stringify(['chat', 'reasoning']),
    description: 'High-intelligence flagship model for complex multimodal reasoning'
  },
  {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    providerModelName: 'gpt-4o-mini-2024-07-18',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: JSON.stringify(['chat']),
    description: 'Fast, cost-efficient frontier model for everyday tasks'
  },
  {
    modelId: 'claude-3-5-sonnet',
    provider: 'anthropic',
    providerModelName: 'claude-3-5-sonnet-20240620',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 200000,
    defaultTemperature: 0.7,
    capabilities: JSON.stringify(['chat', 'coding']),
    description: 'Most intelligent Claude model for complex reasoning and software engineering'
  },
  {
    modelId: 'mock-gpt-4o',
    provider: 'mock',
    providerModelName: 'mock-gpt-4o',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: JSON.stringify(['chat']),
    description: 'Deterministic test mock for GPT-4o'
  }
];

async function seed() {
  const prisma = getPrismaClient();
  console.log('Seeding ModelProvider database (aegis_model)...');

  // 1. Seed Gemini Provider
  if (env.geminiApiKey) {
    const encryptedKey = encryptSecret(env.geminiApiKey);
    await prisma.providerConfig.upsert({
      where: { id: 'gemini' },
      update: {
        name: 'Google Gemini',
        type: 'gemini',
        baseUrl: env.geminiBaseUrl || 'https://generativelanguage.googleapis.com',
        apiKey: encryptedKey,
        enabled: true,
        isHealthy: true
      },
      create: {
        id: 'gemini',
        name: 'Google Gemini',
        type: 'gemini',
        baseUrl: env.geminiBaseUrl || 'https://generativelanguage.googleapis.com',
        apiKey: encryptedKey,
        enabled: true,
        isHealthy: true
      }
    });
    console.log('✓ Seeded Provider: gemini');
  }

  // 2. Seed Models
  for (const model of DEFAULT_MODELS) {
    await prisma.modelConfig.upsert({
      where: { modelId: model.modelId },
      update: {
        provider: model.provider,
        providerModelName: model.providerModelName,
        enabled: model.enabled,
        isDefault: model.isDefault,
        maxTokens: model.maxTokens,
        contextWindow: model.contextWindow,
        defaultTemperature: model.defaultTemperature,
        capabilities: model.capabilities,
        description: model.description
      },
      create: {
        id: `cfg_${model.modelId.replace(/[^a-zA-Z0-9]/g, '_')}`,
        modelId: model.modelId,
        provider: model.provider,
        providerModelName: model.providerModelName,
        enabled: model.enabled,
        isDefault: model.isDefault,
        maxTokens: model.maxTokens,
        contextWindow: model.contextWindow,
        defaultTemperature: model.defaultTemperature,
        capabilities: model.capabilities,
        description: model.description
      }
    });
    console.log(`✓ Seeded Model: ${model.modelId} (${model.provider})`);
  }

  console.log('Seeding completed successfully!');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

