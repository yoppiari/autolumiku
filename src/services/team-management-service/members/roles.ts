/**
 * Role Assignment Service
 * Handles role assignments for team members with proper validation and audit logging
 */

import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { EventBus } from '@/lib/event-bus';
import { RoleAssignmentRequest } from '@/lib/types/team';

export class RoleAssignmentService {
  private readonly logger: Logger;

  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string,
    private readonly currentUserId: string
  ) {
    this.logger = new Logger('RoleAssignmentService');
  }

  /**
   * Assign multiple roles to a team member
   */
  async assignRoles(tx: DatabaseClient, teamMemberId: string, roleIds: string[]): Promise<void> {
    if (!roleIds || roleIds.length === 0) {
      return;
    }

    this.logger.info('Assigning roles to team member', {
      tenantId: this.tenantId,
      teamMemberId,
      roleIds
    });

    // Validate roles exist and are active
    await this.validateRoles(tx, roleIds);

    // Remove existing role assignments
    await this.removeAllRoles(tx, teamMemberId);

    // Assign new roles
    for (const roleId of roleIds) {
      await this.assignRole(tx, teamMemberId, roleId, roleIds.indexOf(roleId) === 0);
    }

    // Emit roles assigned event
    await EventBus.emit('team.member.roles.assigned', {
      tenantId: this.tenantId,
      teamMemberId,
      roleIds,
      assignedBy: this.currentUserId
    });
  }

  /**
   * Assign a single role to a team member
   */
  async assignRole(
    tx: DatabaseClient,
    teamMemberId: string,
    roleId: string,
    isPrimary: boolean = false
  ): Promise<void> {
    // Check if assignment already exists
    const existingQuery = `
      SELECT id FROM team_member_roles
      WHERE team_member_id = $1 AND role_id = $2 AND tenant_id = $3
        AND effective_from <= CURRENT_TIMESTAMP
        AND (effective_until IS NULL OR effective_until > CURRENT_TIMESTAMP)
    `;

    const existing = await tx.query(existingQuery, [teamMemberId, roleId, this.tenantId]);

    if (existing.rows.length > 0) {
      this.logger.warn('Role assignment already exists', {
        teamMemberId,
        roleId,
        existingId: existing.rows[0].id
      });
      return;
    }

    // If this is being set as primary, unset other primary roles
    if (isPrimary) {
      const unsetPrimaryQuery = `
        UPDATE team_member_roles
        SET is_primary = false
        WHERE team_member_id = $1 AND tenant_id = $2 AND is_primary = true
      `;
      await tx.query(unsetPrimaryQuery, [teamMemberId, this.tenantId]);
    }

    // Create new role assignment
    const insertQuery = `
      INSERT INTO team_member_roles (
        tenant_id, team_member_id, role_id, assigned_by,
        is_primary, effective_from
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `;

    await tx.query(insertQuery, [
      this.tenantId,
      teamMemberId,
      roleId,
      this.currentUserId,
      isPrimary
    ]);

    this.logger.info('Role assigned successfully', {
      teamMemberId,
      roleId,
      isPrimary
    });
  }

  /**
   * Remove a specific role assignment
   */
  async removeRole(teamMemberId: string, roleId: string): Promise<void> {
    this.logger.info('Removing role assignment', {
      tenantId: this.tenantId,
      teamMemberId,
      roleId
    });

    const query = `
      UPDATE team_member_roles
      SET effective_until = CURRENT_TIMESTAMP
      WHERE team_member_id = $1 AND role_id = $2 AND tenant_id = $3
        AND effective_until IS NULL
    `;

    const result = await this.db.query(query, [teamMemberId, roleId, this.tenantId]);

    if (result.rowCount === 0) {
      throw new Error('Role assignment not found or already removed');
    }

    // Emit role removed event
    await EventBus.emit('team.member.role.removed', {
      tenantId: this.tenantId,
      teamMemberId,
      roleId,
      removedBy: this.currentUserId
    });
  }

  /**
   * Remove all role assignments for a team member
   */
  async removeAllRoles(tx: DatabaseClient, teamMemberId: string): Promise<void> {
    this.logger.info('Removing all role assignments', {
      tenantId: this.tenantId,
      teamMemberId
    });

    const query = `
      UPDATE team_member_roles
      SET effective_until = CURRENT_TIMESTAMP
      WHERE team_member_id = $1 AND tenant_id = $2 AND effective_until IS NULL
    `;

    await tx.query(query, [teamMemberId, this.tenantId]);
  }

  /**
   * Get current role assignments for a team member
   */
  async getCurrentRoles(teamMemberId: string): Promise<any[]> {
    const query = `
      SELECT
        tmr.*,
        dr.name,
        dr.display_name,
        dr.indonesian_title,
        dr.department,
        dr.role_level,
        dr.is_system_role
      FROM team_member_roles tmr
      JOIN dealership_roles dr ON tmr.role_id = dr.id
      WHERE tmr.team_member_id = $1 AND tmr.tenant_id = $2
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        AND dr.is_active = true
      ORDER BY dr.role_level ASC, tmr.assigned_at ASC
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [teamMemberId, this.tenantId]);
      return result.rows;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get primary role for a team member
   */
  async getPrimaryRole(teamMemberId: string): Promise<any | null> {
    const query = `
      SELECT
        tmr.*,
        dr.name,
        dr.display_name,
        dr.indonesian_title,
        dr.department,
        dr.role_level,
        dr.is_system_role
      FROM team_member_roles tmr
      JOIN dealership_roles dr ON tmr.role_id = dr.id
      WHERE tmr.team_member_id = $1 AND tmr.tenant_id = $2 AND tmr.is_primary = true
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        AND dr.is_active = true
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [teamMemberId, this.tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Check if team member has a specific role
   */
  async hasRole(teamMemberId: string, roleName: string): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM team_member_roles tmr
        JOIN dealership_roles dr ON tmr.role_id = dr.id
        WHERE tmr.team_member_id = $1 AND tmr.tenant_id = $2 AND dr.name = $3
          AND tmr.effective_from <= CURRENT_TIMESTAMP
          AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
          AND dr.is_active = true
      ) as has_role
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [teamMemberId, this.tenantId, roleName]);
      return result.rows[0].has_role;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get all team members with a specific role
   */
  async getTeamMembersByRole(roleName: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT tmr.team_member_id
      FROM team_member_roles tmr
      JOIN dealership_roles dr ON tmr.role_id = dr.id
      WHERE dr.name = $1 AND tmr.tenant_id = $2
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        AND dr.is_active = true
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [roleName, this.tenantId]);
      return result.rows.map(row => row.team_member_id);
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Update role assignment (change primary status)
   */
  async updateRoleAssignment(
    teamMemberId: string,
    roleId: string,
    isPrimary: boolean
  ): Promise<void> {
    this.logger.info('Updating role assignment', {
      tenantId: this.tenantId,
      teamMemberId,
      roleId,
      isPrimary
    });

    // If setting as primary, unset other primary roles first
    if (isPrimary) {
      const unsetPrimaryQuery = `
        UPDATE team_member_roles
        SET is_primary = false
        WHERE team_member_id = $1 AND tenant_id = $2 AND is_primary = true
      `;
      await this.db.query(unsetPrimaryQuery, [teamMemberId, this.tenantId]);
    }

    // Update the specific role assignment
    const updateQuery = `
      UPDATE team_member_roles
      SET is_primary = $4
      WHERE team_member_id = $1 AND role_id = $2 AND tenant_id = $3
        AND effective_from <= CURRENT_TIMESTAMP
        AND (effective_until IS NULL OR effective_until > CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(updateQuery, [
      teamMemberId,
      roleId,
      this.tenantId,
      isPrimary
    ]);

    if (result.rowCount === 0) {
      throw new Error('Role assignment not found');
    }

    // Emit role updated event
    await EventBus.emit('team.member.role.updated', {
      tenantId: this.tenantId,
      teamMemberId,
      roleId,
      isPrimary,
      updatedBy: this.currentUserId
    });
  }

  /**
   * Get role assignment history for a team member
   */
  async getRoleHistory(teamMemberId: string): Promise<any[]> {
    const query = `
      SELECT
        tmr.*,
        dr.name as role_name,
        dr.display_name as role_display_name,
        assigner.first_name as assigner_first_name,
        assigner.last_name as assigner_last_name
      FROM team_member_roles tmr
      JOIN dealership_roles dr ON tmr.role_id = dr.id
      LEFT JOIN users assigner ON tmr.assigned_by = assigner.id
      WHERE tmr.team_member_id = $1 AND tmr.tenant_id = $2
      ORDER BY tmr.assigned_at DESC, tmr.effective_from DESC
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [teamMemberId, this.tenantId]);
      return result.rows;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get role statistics for the tenant
   */
  async getRoleStatistics(): Promise<any> {
    const query = `
      SELECT
        dr.name,
        dr.display_name,
        dr.indonesian_title,
        dr.department,
        COUNT(DISTINCT tmr.team_member_id) as member_count,
        COUNT(tmr.id) as total_assignments
      FROM dealership_roles dr
      LEFT JOIN team_member_roles tmr ON dr.id = tmr.role_id
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      WHERE dr.tenant_id = $1 AND dr.is_active = true
      GROUP BY dr.id, dr.name, dr.display_name, dr.indonesian_title, dr.department
      ORDER BY member_count DESC, dr.role_level ASC
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId]);
      return result.rows;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Validate that roles exist and are active for the tenant
   */
  private async validateRoles(tx: DatabaseClient, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) {
      return;
    }

    const placeholders = roleIds.map((_, index) => `$${index + 3}`).join(', ');
    const query = `
      SELECT id, name, is_active
      FROM dealership_roles
      WHERE tenant_id = $1 AND id IN (${placeholders})
    `;

    const result = await tx.query(query, [this.tenantId, ...roleIds]);

    if (result.rows.length !== roleIds.length) {
      const foundIds = result.rows.map(row => row.id);
      const missingIds = roleIds.filter(id => !foundIds.includes(id));
      throw new Error(`Roles not found: ${missingIds.join(', ')}`);
    }

    // Check if any roles are inactive
    const inactiveRoles = result.rows.filter(row => !row.is_active);
    if (inactiveRoles.length > 0) {
      throw new Error(`Inactive roles cannot be assigned: ${inactiveRoles.map(r => r.name).join(', ')}`);
    }
  }

  /**
   * Check for conflicting role assignments (e.g., incompatible roles)
   */
  async checkRoleConflicts(teamMemberId: string, roleIds: string[]): Promise<void> {
    // Get current roles for the team member
    const currentRoles = await this.getCurrentRoles(teamMemberId);
    const currentRoleNames = currentRoles.map(r => r.name);

    // Define conflicting role combinations
    const conflictingRoles = [
      { roles: ['showroom_manager', 'sales_executive'], reason: 'Manager should not also be an executive' },
      { roles: ['finance_manager', 'sales_executive'], reason: 'Finance and sales roles should be separate' },
      // Add more conflict rules as needed
    ];

    for (const conflict of conflictingRoles) {
      const hasConflict = conflict.roles.every(role =>
        currentRoleNames.includes(role) || roleIds.includes(role)
      );

      if (hasConflict) {
        throw new Error(`Role conflict detected: ${conflict.reason}`);
      }
    }
  }
}