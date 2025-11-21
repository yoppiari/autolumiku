import { createLogger } from 'winston';
import { tenantService } from './index';
import { CreateTenantRequest } from '@/types/tenant';
import { nanoid } from 'nanoid';

const logger = createLogger({
  level: 'info',
  format: {
    combine: [
      require('winston').format.timestamp(),
      require('winston').format.errors({ stack: true }),
      require('winston').format.json(),
    ],
  },
  transports: [
    new require('winston').transports.Console({
      format: require('winston').format.combine(
        require('winston').format.colorize(),
        require('winston').format.simple()
      )
    })
  ]
});

export interface TenantCreationWorkflowRequest extends CreateTenantRequest {
  workflowId?: string;
}

export interface TenantCreationWorkflowResult {
  workflowId: string;
  tenantId: string;
  status: 'success' | 'failed' | 'validation_failed';
  steps: WorkflowStep[];
  errors?: string[];
}

export interface WorkflowStep {
  stepId: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
}

/**
 * Tenant creation workflow service
 */
export class TenantCreationWorkflowService {
  /**
   * Execute complete tenant creation workflow
   */
  async executeWorkflow(request: TenantCreationWorkflowRequest): Promise<TenantCreationWorkflowResult> {
    const workflowId = request.workflowId || nanoid();
    const steps: WorkflowStep[] = [];

    logger.info(`Starting tenant creation workflow: ${workflowId} for tenant: ${request.name}`);

    try {
      // Step 1: Validation
      const validationStep = await this.executeStep(workflowId, 'validation', () =>
        this.validateRequest(request)
      );
      steps.push(validationStep);

      // Step 2: Subdomain check
      const subdomainCheckStep = await this.executeStep(workflowId, 'subdomain_check', () =>
        this.checkSubdomainAvailability(request.subdomain)
      );
      steps.push(subdomainCheckStep);

      // Step 3: Tenant creation
      const tenantCreationStep = await this.executeStep(workflowId, 'tenant_creation', () =>
        tenantService.createTenant(request)
      );
      steps.push(tenantCreationStep);

      // Step 4: Post-creation setup
      const postCreationStep = await this.executeStep(workflowId, 'post_creation_setup', () =>
        this.postCreationSetup(tenantCreationStep.result!)
      );
      steps.push(postCreationStep);

      // Step 5: Health check
      const healthCheckStep = await this.executeStep(workflowId, 'health_check', () =>
        this.performHealthCheck(tenantCreationStep.result!)
      );
      steps.push(healthCheckStep);

      const result: TenantCreationWorkflowResult = {
        workflowId,
        tenantId: tenantCreationStep.result!.id,
        status: 'success',
        steps,
      };

      logger.info(`Tenant creation workflow completed successfully: ${workflowId}`);

      return result;
    } catch (error) {
      logger.error(`Tenant creation workflow failed: ${workflowId}`, error);

      const failedStep = steps.find(step => step.status === 'failed') || steps[steps.length - 1];
      failedStep.status = 'failed';
      failedStep.error = error instanceof Error ? error.message : 'Unknown error';

      return {
        workflowId,
        tenantId: '',
        status: 'failed',
        steps,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep<T>(
    workflowId: string,
    stepName: string,
    stepFunction: () => Promise<T>
  ): Promise<WorkflowStep & { result?: T }> {
    const stepId = nanoid();
    const step: WorkflowStep = {
      stepId,
      name: stepName,
      status: 'in_progress',
      startedAt: new Date(),
    };

    logger.info(`Starting workflow step: ${stepName} (${stepId})`);

    try {
      const startTime = Date.now();
      const result = await stepFunction();
      const duration = Date.now() - startTime;

      const completedStep: WorkflowStep & { result?: T } = {
        ...step,
        status: 'completed',
        completedAt: new Date(),
        duration,
        result,
      };

      logger.info(`Workflow step completed: ${stepName} (${stepId}) in ${duration}ms`);

      return completedStep;
    } catch (error) {
      const duration = Date.now() - (step.startedAt?.getTime() || Date.now());

      const failedStep: WorkflowStep = {
        ...step,
        status: 'failed',
        completedAt: new Date(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      logger.error(`Workflow step failed: ${stepName} (${stepId}) in ${duration}ms}`, error);

      throw error;
    }
  }

  /**
   * Validate creation request
   */
  private async validateRequest(request: TenantCreationWorkflowRequest): Promise<void> {
    logger.debug(`Validating tenant creation request`);

    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Tenant name is required');
    }

    if (request.name.length > 100) {
      throw new Error('Tenant name cannot exceed 100 characters');
    }

    if (!request.subdomain || request.subdomain.trim().length === 0) {
      throw new Error('Subdomain is required');
    }

    if (!/^[a-z0-9][a-z0-9-]*$/.test(request.subdomain)) {
      throw new Error('Subdomain must be alphanumeric and hyphens only, starting with a letter');
    }

    if (!request.adminEmail) {
      throw new Error('Admin email is required');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.adminEmail)) {
      throw new Error('Valid admin email is required');
    }

    if (!request.adminFirstName) {
      throw new Error('Admin first name is required');
    }

    if (!request.adminLastName) {
      throw new Error('Admin last name is required');
    }

    // Additional business validations
    if (request.name.toLowerCase().includes('test') && !request.subdomain.toLowerCase().includes('test')) {
      throw new Error('Test tenants must include "test" in subdomain');
    }
  }

  /**
   * Execute workflow for existing tenant (reprovisioning)
   */
  async executeWorkflow(
    tenantId: string,
    options: {
      triggerReprovision?: boolean;
      specificSteps?: string[];
    } = {}
  ): Promise<TenantCreationWorkflowResult> {
    const workflowId = nanoid();
    logger.info(`Starting workflow for tenant ${tenantId}: ${workflowId}`);

    try {
      // Get tenant details
      const tenant = await tenantService.getTenant(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Initialize workflow steps
      const steps: WorkflowStep[] = [
        {
          stepId: 'validation',
          name: 'Validate Tenant Configuration',
          status: 'pending'
        },
        {
          stepId: 'database_check',
          name: 'Check Database Connectivity',
          status: 'pending'
        },
        {
          stepId: 'schema_update',
          name: 'Update Database Schema',
          status: 'pending'
        },
        {
          stepId: 'health_check',
          name: 'Perform Health Check',
          status: 'pending'
        }
      ];

      let currentStep = 0;
      const errors: string[] = [];

      // Execute workflow steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Skip specific steps if provided
        if (options.specificSteps && !options.specificSteps.includes(step.stepId)) {
          step.status = 'completed';
          continue;
        }

        step.status = 'in_progress';
        step.startedAt = new Date();
        currentStep = i;

        try {
          await this.executeWorkflowStep(step.stepId, tenant);
          step.status = 'completed';
          step.completedAt = new Date();
          step.duration = step.completedAt.getTime() - step.startedAt.getTime();
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Unknown error';
          step.completedAt = new Date();
          step.duration = step.completedAt.getTime() - step.startedAt.getTime();
          errors.push(step.error);
          break;
        }
      }

      const finalStatus = errors.length === 0 ? 'success' : 'failed';
      const progress = (steps.filter(s => s.status === 'completed').length / steps.length) * 100;

      logger.info(`Workflow completed for tenant ${tenantId}: ${finalStatus}`);

      return {
        workflowId,
        tenantId,
        status: finalStatus,
        steps,
        errors: errors.length > 0 ? errors : undefined,
        currentStep: currentStep.toString(),
        progress
      };

    } catch (error) {
      logger.error(`Workflow failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<TenantCreationWorkflowResult | null> {
    try {
      logger.info(`Getting workflow status: ${workflowId}`);

      // This is a placeholder - in real implementation, query workflow database
      // For now, return null to indicate no active workflow
      return null;
    } catch (error) {
      logger.error(`Failed to get workflow status ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Execute individual workflow step
   */
  private async executeWorkflowStep(stepId: string, tenant: any): Promise<void> {
    logger.debug(`Executing workflow step: ${stepId}`);

    switch (stepId) {
      case 'validation':
        await this.validateTenantConfiguration(tenant);
        break;
      case 'database_check':
        await this.checkDatabaseConnectivity(tenant);
        break;
      case 'schema_update':
        await this.updateDatabaseSchema(tenant);
        break;
      case 'health_check':
        await this.performHealthCheck(tenant);
        break;
      default:
        throw new Error(`Unknown workflow step: ${stepId}`);
    }
  }

  /**
   * Validate tenant configuration
   */
  private async validateTenantConfiguration(tenant: any): Promise<void> {
    logger.debug(`Validating tenant configuration: ${tenant.id}`);

    // Validate tenant has required fields
    if (!tenant.name?.trim()) {
      throw new Error('Tenant name is required');
    }

    if (!tenant.subdomain?.trim()) {
      throw new Error('Tenant subdomain is required');
    }

    if (!tenant.dbName?.trim()) {
      throw new Error('Tenant database name is required');
    }

    // Simulate validation delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseConnectivity(tenant: any): Promise<void> {
    logger.debug(`Checking database connectivity: ${tenant.id}`);

    // This would test actual database connection
    // For now, simulate the check
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate potential failure (10% chance for demo)
    if (Math.random() < 0.1) {
      throw new Error('Database connection failed');
    }
  }

  /**
   * Update database schema
   */
  private async updateDatabaseSchema(tenant: any): Promise<void> {
    logger.debug(`Updating database schema: ${tenant.id}`);

    // This would apply any pending database migrations
    // For now, simulate the update
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(tenant: any): Promise<void> {
    logger.debug(`Performing health check: ${tenant.id}`);

    // This would perform comprehensive health checks
    // For now, simulate the health check
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Check subdomain availability
   */
  private async checkSubdomainAvailability(subdomain: string): Promise<void> {
    logger.debug(`Checking subdomain availability: ${subdomain}`);

    const existingTenant = await tenantService.getTenantBySubdomain(subdomain);
    if (existingTenant) {
      throw new Error(`Subdomain '${subdomain}' is already taken by tenant: ${existingTenant.name}`);
    }

    // Check against reserved subdomains
    const reservedSubdomains = [
      'www', 'api', 'admin', 'mail', 'ftp', 'localhost', 'autolumiku',
      'app', 'blog', 'shop', 'store', 'support', 'help', 'status',
      'docs', 'cdn', 'assets', 'static', 'media'
    ];

    if (reservedSubdomains.includes(subdomain.toLowerCase())) {
      throw new Error(`Subdomain '${subdomain}' is reserved for system use`);
    }

    // Check against profanity or inappropriate terms
    const inappropriateTerms = [
      'spam', 'abuse', 'hate', 'violence', 'illegal', 'fraud',
      'scam', 'phishing', 'malware', 'virus'
    ];

    const lowercaseSubdomain = subdomain.toLowerCase();
    for (const term of inappropriateTerms) {
      if (lowercaseSubdomain.includes(term)) {
        throw new Error(`Subdomain contains inappropriate content`);
      }
    }
  }

  /**
   * Perform post-creation setup
   */
  private async postCreationSetup(tenant: any): Promise<void> {
    logger.debug(`Performing post-creation setup for tenant: ${tenant.id}`);

    // Would perform additional setup tasks:
    // - Send welcome email to admin user
    // - Initialize default settings
    // - Create initial audit log entries
    // - Set up monitoring

    logger.info(`Post-creation setup completed for tenant: ${tenant.id}`);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(tenant: any): Promise<void> {
    logger.debug(`Performing health check for tenant: ${tenant.id}`);

    const health = await tenantService.getTenantHealth(tenant.id);

    if (!health.database) {
      throw new Error('Tenant database health check failed');
    }

    if (!health.configuration) {
      throw new Error('Tenant configuration health check failed');
    }

    logger.info(`Health check passed for tenant: ${tenant.id}`);
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<TenantCreationWorkflowResult | null> {
    // In a real implementation, this would fetch workflow status from storage
    logger.debug(`Getting workflow status: ${workflowId}`);
    return null;
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    logger.info(`Cancelling workflow: ${workflowId}`);
    // In a real implementation, this would cancel the workflow and clean up resources
  }
}

export const tenantCreationWorkflowService = new TenantCreationWorkflowService();
export default TenantCreationWorkflowService;