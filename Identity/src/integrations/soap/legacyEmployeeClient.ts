// Legacy Employee SOAP Client Integration with Circuit Breaker and Exponential Backoff Retry
// Conforms to Web Services Assignment Module 1, 3, 4 Requirements: 23 (WSDL/SOAP), 16 (Circuit Breaker), 24 (Retry & Backoff), 19 (Timeout)

import * as soap from 'soap';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';
import {
  ServiceUnavailableError,
  GatewayTimeoutError,
  NotFoundError,
  BadRequestError
} from '../../middleware/errorHandler';

export interface LegacyEmployeeRecord {
  employeeId: string;
  exists: boolean;
  fullName?: string;
  department?: string;
  status?: string;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class LegacyEmployeeClient {
  private client: soap.Client | null = null;
  private readonly wsdlUrl: string;
  private circuitState: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private readonly failureThreshold = 5;
  private readonly halfOpenTimeoutMs = 10000;
  private nextAttemptAllowedAt = 0;
  private readonly timeoutMs = 5000;
  private readonly maxRetryAttempts = 3;

  constructor(wsdlUrl = process.env.SOAP_MOCK_URL || 'http://localhost:5005/legacy-employee?wsdl') {
    this.wsdlUrl = wsdlUrl;
  }

  getCircuitState(): CircuitState {
    if (this.circuitState === 'OPEN' && Date.now() >= this.nextAttemptAllowedAt) {
      this.circuitState = 'HALF_OPEN';
      logger.info({ state: 'HALF_OPEN' }, 'SOAP Circuit Breaker transitioned to HALF_OPEN probe state');
    }
    return this.circuitState;
  }

  private recordSuccess(): void {
    if (this.circuitState !== 'CLOSED') {
      logger.info({ state: 'CLOSED' }, 'SOAP Circuit Breaker transitioned back to CLOSED state');
    }
    this.circuitState = 'CLOSED';
    this.consecutiveFailures = 0;
  }

  private recordFailure(err: Error): void {
    this.consecutiveFailures++;
    logger.warn(
      { failures: this.consecutiveFailures, threshold: this.failureThreshold, err: err.message },
      'SOAP call recorded failure in Circuit Breaker'
    );

    if (this.consecutiveFailures >= this.failureThreshold || this.circuitState === 'HALF_OPEN') {
      this.circuitState = 'OPEN';
      this.nextAttemptAllowedAt = Date.now() + this.halfOpenTimeoutMs;
      logger.error(
        { state: 'OPEN', nextAttemptAllowedAt: new Date(this.nextAttemptAllowedAt).toISOString() },
        'SOAP Circuit Breaker TRIPPED to OPEN state'
      );
    }
  }

  private async getClient(): Promise<soap.Client> {
    if (this.client) return this.client;

    try {
      this.client = await soap.createClientAsync(this.wsdlUrl);
      return this.client;
    } catch (err: any) {
      // Fallback: if external URL fails, attempt loading bundled WSDL file
      const localWsdl = path.resolve(__dirname, '../../../openapi/service.wsdl');
      if (fs.existsSync(localWsdl)) {
        this.client = await soap.createClientAsync(localWsdl);
        return this.client;
      }
      throw new ServiceUnavailableError(`Failed to load WSDL from ${this.wsdlUrl}: ${err.message}`);
    }
  }

  /**
   * Executes a single SOAP invocation wrapped in an explicit timeout.
   */
  private async executeSoapCall(client: soap.Client, employeeId: string, correlationId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        reject(new GatewayTimeoutError(`SOAP request timed out after ${this.timeoutMs}ms.`));
      }, this.timeoutMs);

      // Attach correlation ID as SOAP header
      try {
        client.clearSoapHeaders();
        client.addSoapHeader({
          CorrelationHeader: {
            correlationId
          }
        });
      } catch {
        // Continue if headers unsupported
      }

      client.CheckLegacyEmployee({ employeeId }, (err: any, result: any) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (err) {
          return reject(err);
        }
        resolve(result);
      });
    });
  }

  /**
   * Checks legacy employee directory via SOAP, applying Circuit Breaker, Exponential Backoff, and Timeout.
   */
  async checkEmployee(employeeId: string, correlationId = 'unknown'): Promise<LegacyEmployeeRecord> {
    if (!employeeId || typeof employeeId !== 'string') {
      throw new BadRequestError('employeeId must be a non-empty string.');
    }

    const state = this.getCircuitState();
    if (state === 'OPEN') {
      throw new ServiceUnavailableError(
        'Circuit breaker is OPEN: legacy SOAP directory service is temporarily unavailable.'
      );
    }

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.maxRetryAttempts) {
      attempt++;
      try {
        logger.info(
          { employeeId, attempt, maxAttempts: this.maxRetryAttempts, correlationId },
          'Executing SOAP operation CheckLegacyEmployee'
        );

        const client = await this.getClient();
        const rawResult = await this.executeSoapCall(client, employeeId, correlationId);

        this.recordSuccess();

        const exists = Boolean(rawResult?.exists);
        if (!exists) {
          throw new NotFoundError(`Legacy employee '${employeeId}' not found in directory.`);
        }

        return {
          employeeId: rawResult.employeeId || employeeId,
          exists: true,
          fullName: rawResult.fullName,
          department: rawResult.department,
          status: rawResult.status
        };
      } catch (err: any) {
        lastError = err;

        if (err instanceof NotFoundError || err instanceof BadRequestError) {
          // Do NOT retry client / 4xx errors
          throw err;
        }

        this.recordFailure(err);

        if (attempt < this.maxRetryAttempts && this.getCircuitState() !== 'OPEN') {
          // Exponential backoff with jitter
          const baseDelay = 200 * Math.pow(2, attempt - 1);
          const jitter = baseDelay * (0.8 + Math.random() * 0.4);
          const delayMs = Math.min(2000, Math.round(jitter));

          logger.warn(
            { employeeId, attempt, delayMs, correlationId, err: err.message },
            'Retrying legacy SOAP operation after transient failure'
          );

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    if (lastError instanceof GatewayTimeoutError || lastError instanceof ServiceUnavailableError) {
      throw lastError;
    }

    throw new ServiceUnavailableError(
      `Legacy SOAP directory call failed after ${this.maxRetryAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Resets circuit breaker state for testing purposes.
   */
  resetBreaker(): void {
    this.circuitState = 'CLOSED';
    this.consecutiveFailures = 0;
    this.nextAttemptAllowedAt = 0;
  }
}

export const legacyEmployeeClient = new LegacyEmployeeClient();

