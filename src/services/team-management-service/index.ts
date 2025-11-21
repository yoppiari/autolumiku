/**
 * Team Management Service
 * Story 1.5: Showroom Team Management
 * Provides comprehensive team management with multi-tenant isolation and Indonesian automotive dealership roles
 */

import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { EventBus } from '@/lib/event-bus';
import {
  TeamMember,
  CreateTeamMemberRequest,
  UpdateTeamMemberRequest,
  TeamMembersQuery,
  PaginatedResponse,
  TeamManagementResponse,
  ActivityLogQuery,
  TeamActivityLog
} from '@/lib/types/team';
import { TeamMemberRepository } from './members/repository';
import { RoleAssignmentService } from './roles/assignments';
import { AuditLogger } from './audit/logger';
import { PermissionService } from '../rbac-service/checks/evaluator';

export class TeamManagementService {
  private readonly memberRepository: TeamMemberRepository;
  private readonly roleAssignmentService: RoleAssignmentService;
  private readonly auditLogger: AuditLogger;
  private readonly permissionService: PermissionService;
  private readonly logger: Logger;

  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string,
    private readonly currentUserId: string
  ) {
    this.memberRepository = new TeamMemberRepository(db, tenantId);
    this.roleAssignmentService = new RoleAssignmentService(db, tenantId, currentUserId);
    this.auditLogger = new AuditLogger(db, tenantId);
    this.permissionService = new PermissionService(db, tenantId);
    this.logger = new Logger('TeamManagementService');
  }

  /**
   * Get team members with filtering and pagination
   */
  async getTeamMembers(query: TeamMembersQuery = {}): Promise<PaginatedResponse<TeamMember>> {
    this.logger.info('Fetching team members', { tenantId: this.tenantId, query });

    // Check permissions
    await this.permissionService.requirePermission('team.view', this.currentUserId);

    try {
      const result = await this.memberRepository.findMany(query);

      // Emit team members retrieved event
      await EventBus.emit('team.members.retrieved', {
        tenantId: this.tenantId,
        userId: this.currentUserId,
        count: result.data.length,
        query
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch team members', { error, query });
      throw error;
    }
  }

  /**
   * Get team member by ID
   */
  async getTeamMemberById(memberId: string): Promise<TeamMember> {
    this.logger.info('Fetching team member', { tenantId: this.tenantId, memberId });

    // Check permissions
    await this.permissionService.requirePermission('team.view', this.currentUserId);

    try {
      const member = await this.memberRepository.findById(memberId);

      if (!member) {
        throw new Error('Team member not found');
      }

      return member;
    } catch (error) {
      this.logger.error('Failed to fetch team member', { error, memberId });
      throw error;
    }
  }

  /**
   * Create a new team member
   */
  async createTeamMember(request: CreateTeamMemberRequest): Promise<TeamMember> {
    this.logger.info('Creating team member', { tenantId: this.tenantId, request });

    // Check permissions
    await this.permissionService.requirePermission('team.create', this.currentUserId);

    // Validate team size limits (if applicable)
    await this.validateTeamSizeLimits();

    // Check if user is already a team member
    const existingMember = await this.memberRepository.findByUserId(request.userId);
    if (existingMember) {
      throw new Error('User is already a team member');
    }

    try {
      // Start database transaction
      return await this.db.transaction(async (tx) => {
        // Create team member record
        const member = await this.memberRepository.create(tx, {
          ...request,
          tenantId: this.tenantId,
          createdBy: this.currentUserId
        });

        // Assign roles
        if (request.roleIds && request.roleIds.length > 0) {
          await this.roleAssignmentService.assignRoles(tx, member.id, request.roleIds);
        }

        // Log activity
        await this.auditLogger.log({
          action: 'create',
          entityType: 'team_member',
          entityId: member.id,
          performedBy: this.currentUserId,
          newValues: request
        });

        // Emit team member created event
        await EventBus.emit('team.member.created', {
          tenantId: this.tenantId,
          member,
          assignedBy: this.currentUserId
        });

        this.logger.info('Team member created successfully', { memberId: member.id });
        return member;
      });
    } catch (error) {
      this.logger.error('Failed to create team member', { error, request });
      throw error;
    }
  }

  /**
   * Update team member
   */
  async updateTeamMember(memberId: string, request: UpdateTeamMemberRequest): Promise<TeamMember> {
    this.logger.info('Updating team member', { tenantId: this.tenantId, memberId, request });

    // Check permissions
    await this.permissionService.requirePermission('team.update', this.currentUserId);

    // Get current member data for audit trail
    const currentMember = await this.memberRepository.findById(memberId);
    if (!currentMember) {
      throw new Error('Team member not found');
    }

    // Validate manager assignment if specified
    if (request.reportsTo) {
      await this.validateManagerAssignment(memberId, request.reportsTo);
    }

    try {
      const updatedMember = await this.db.transaction(async (tx) => {
        // Update team member
        const member = await this.memberRepository.update(tx, memberId, request);

        // Log activity
        await this.auditLogger.log({
          action: 'update',
          entityType: 'team_member',
          entityId: memberId,
          performedBy: this.currentUserId,
          oldValues: currentMember,
          newValues: request,
          changesSummary: this.generateChangesSummary(currentMember, request)
        });

        // Emit team member updated event
        await EventBus.emit('team.member.updated', {
          tenantId: this.tenantId,
          memberId,
          previousData: currentMember,
          newData: request,
          updatedBy: this.currentUserId
        });

        return member;
      });

      this.logger.info('Team member updated successfully', { memberId });
      return updatedMember;
    } catch (error) {
      this.logger.error('Failed to update team member', { error, memberId, request });
      throw error;
    }
  }

  /**
   * Deactivate team member (soft delete)
   */
  async deactivateTeamMember(memberId: string, reason?: string): Promise<void> {
    this.logger.info('Deactivating team member', { tenantId: this.tenantId, memberId, reason });

    // Check permissions
    await this.permissionService.requirePermission('team.delete', this.currentUserId);

    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new Error('Team member not found');
    }

    try {
      await this.db.transaction(async (tx) => {
        // Deactivate member
        await this.memberRepository.deactivate(tx, memberId);

        // Remove all role assignments
        await this.roleAssignmentService.removeAllRoles(tx, memberId);

        // Log activity
        await this.auditLogger.log({
          action: 'deactivate',
          entityType: 'team_member',
          entityId: memberId,
          performedBy: this.currentUserId,
          oldValues: member,
          newValues: { isActive: false, deactivationReason: reason },
          changesSummary: `Deactivated team member: ${member.user?.firstName} ${member.user?.lastName}${reason ? ` - Reason: ${reason}` : ''}`
        });

        // Emit team member deactivated event
        await EventBus.emit('team.member.deactivated', {
          tenantId: this.tenantId,
          memberId,
          deactivatedBy: this.currentUserId,
          reason
        });
      });

      this.logger.info('Team member deactivated successfully', { memberId });
    } catch (error) {
      this.logger.error('Failed to deactivate team member', { error, memberId });
      throw error;
    }
  }

  /**
   * Reactivate team member
   */
  async reactivateTeamMember(memberId: string): Promise<TeamMember> {
    this.logger.info('Reactivating team member', { tenantId: this.tenantId, memberId });

    // Check permissions
    await this.permissionService.requirePermission('team.update', this.currentUserId);

    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.isActive) {
      throw new Error('Team member is already active');
    }

    try {
      const reactivatedMember = await this.db.transaction(async (tx) => {
        // Reactivate member
        const updatedMember = await this.memberRepository.reactivate(tx, memberId);

        // Log activity
        await this.auditLogger.log({
          action: 'reactivate',
          entityType: 'team_member',
          entityId: memberId,
          performedBy: this.currentUserId,
          oldValues: { isActive: false },
          newValues: { isActive: true },
          changesSummary: `Reactivated team member: ${member.user?.firstName} ${member.user?.lastName}`
        });

        // Emit team member reactivated event
        await EventBus.emit('team.member.reactivated', {
          tenantId: this.tenantId,
          memberId,
          reactivatedBy: this.currentUserId
        });

        return updatedMember;
      });

      this.logger.info('Team member reactivated successfully', { memberId });
      return reactivatedMember;
    } catch (error) {
      this.logger.error('Failed to reactivate team member', { error, memberId });
      throw error;
    }
  }

  /**
   * Get team activity logs
   */
  async getActivityLogs(query: ActivityLogQuery = {}): Promise<PaginatedResponse<TeamActivityLog>> {
    this.logger.info('Fetching team activity logs', { tenantId: this.tenantId, query });

    // Check permissions
    await this.permissionService.requirePermission('team.analytics', this.currentUserId);

    try {
      const logs = await this.auditLogger.getActivityLogs(query);
      return logs;
    } catch (error) {
      this.logger.error('Failed to fetch activity logs', { error, query });
      throw error;
    }
  }

  /**
   * Get team statistics and metrics
   */
  async getTeamStatistics(): Promise<any> {
    this.logger.info('Fetching team statistics', { tenantId: this.tenantId });

    // Check permissions
    await this.permissionService.requirePermission('team.analytics', this.currentUserId);

    try {
      const stats = await this.memberRepository.getStatistics();

      // Emit statistics accessed event
      await EventBus.emit('team.statistics.accessed', {
        tenantId: this.tenantId,
        accessedBy: this.currentUserId,
        statistics: stats
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch team statistics', { error });
      throw error;
    }
  }

  /**
   * Search team members by name, email, or employee ID
   */
  async searchTeamMembers(searchTerm: string, limit: number = 10): Promise<TeamMember[]> {
    this.logger.info('Searching team members', { tenantId: this.tenantId, searchTerm, limit });

    // Check permissions
    await this.permissionService.requirePermission('team.view', this.currentUserId);

    try {
      const results = await this.memberRepository.search(searchTerm, limit);
      return results;
    } catch (error) {
      this.logger.error('Failed to search team members', { error, searchTerm });
      throw error;
    }
  }

  /**
   * Get team members by department
   */
  async getTeamMembersByDepartment(department: string): Promise<TeamMember[]> {
    this.logger.info('Fetching team members by department', { tenantId: this.tenantId, department });

    // Check permissions
    await this.permissionService.requirePermission('team.view', this.currentUserId);

    try {
      const members = await this.memberRepository.findByDepartment(department);
      return members;
    } catch (error) {
      this.logger.error('Failed to fetch team members by department', { error, department });
      throw error;
    }
  }

  /**
   * Get team hierarchy (manager-subordinate relationships)
   */
  async getTeamHierarchy(): Promise<any> {
    this.logger.info('Fetching team hierarchy', { tenantId: this.tenantId });

    // Check permissions
    await this.permissionService.requirePermission('team.view', this.currentUserId);

    try {
      const hierarchy = await this.memberRepository.getHierarchy();
      return hierarchy;
    } catch (error) {
      this.logger.error('Failed to fetch team hierarchy', { error });
      throw error;
    }
  }

  // Private helper methods

  private async validateTeamSizeLimits(): Promise<void> {
    // Check if tenant has reached their team size limit
    const currentCount = await this.memberRepository.count();
    const maxTeamSize = await this.getMaxTeamSizeForTenant();

    if (currentCount >= maxTeamSize) {
      throw new Error(`Team size limit exceeded. Maximum allowed: ${maxTeamSize}`);
    }
  }

  private async getMaxTeamSizeForTenant(): Promise<number> {
    // This would typically come from tenant subscription or settings
    // For now, return a reasonable default
    return 50;
  }

  private async validateManagerAssignment(memberId: string, managerId: string): Promise<void> {
    // Prevent circular reporting relationships
    if (memberId === managerId) {
      throw new Error('Team member cannot report to themselves');
    }

    // Check if assigning this manager would create a circular relationship
    const hasCircularReference = await this.memberRepository.hasCircularReference(memberId, managerId);
    if (hasCircularReference) {
      throw new Error('Cannot assign manager - would create circular reporting relationship');
    }

    // Check if the assigned manager is active and has appropriate permissions
    const manager = await this.memberRepository.findById(managerId);
    if (!manager || !manager.isActive) {
      throw new Error('Assigned manager is not active or does not exist');
    }
  }

  private generateChangesSummary(current: TeamMember, updates: UpdateTeamMemberRequest): string {
    const changes: string[] = [];

    if (updates.position && updates.position !== current.position) {
      changes.push(`Position: ${current.position} → ${updates.position}`);
    }

    if (updates.department !== undefined && updates.department !== current.department) {
      changes.push(`Department: ${current.department || 'None'} → ${updates.department || 'None'}`);
    }

    if (updates.employmentType && updates.employmentType !== current.employmentType) {
      changes.push(`Employment Type: ${current.employmentType} → ${updates.employmentType}`);
    }

    if (updates.isActive !== undefined && updates.isActive !== current.isActive) {
      changes.push(`Status: ${current.isActive ? 'Active' : 'Inactive'} → ${updates.isActive ? 'Active' : 'Inactive'}`);
    }

    return changes.length > 0 ? changes.join(', ') : 'No significant changes';
  }
}