/**
 * Invitation Service
 * Story 1.5: Showroom Team Management
 * Handles secure team member invitation workflow with token-based authentication
 */

import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { EventBus } from '@/lib/event-bus';
import { EmailService } from '@/lib/email-service';
import { TokenService } from '@/lib/token-service';
import {
  TeamInvitation,
  CreateInvitationRequest,
  InvitationStatus,
  PaginatedResponse,
  TeamManagementResponse
} from '@/lib/types/team';
import { InvitationRepository } from './repository';
import { AuditLogger } from '../team-management-service/audit/logger';

export class InvitationService {
  private readonly logger: Logger;
  private readonly invitationRepository: InvitationRepository;
  private readonly auditLogger: AuditLogger;

  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string,
    private readonly currentUserId: string,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService
  ) {
    this.logger = new Logger('InvitationService');
    this.invitationRepository = new InvitationRepository(db, tenantId);
    this.auditLogger = new AuditLogger(db, tenantId);
  }

  /**
   * Send team invitation
   */
  async sendInvitation(request: CreateInvitationRequest): Promise<TeamInvitation> {
    this.logger.info('Sending team invitation', {
      tenantId: this.tenantId,
      email: request.email,
      position: request.position
    });

    // Validate request
    await this.validateInvitationRequest(request);

    // Check if user is already a team member
    const existingMember = await this.checkExistingTeamMember(request.email);
    if (existingMember) {
      throw new Error('User is already a team member');
    }

    // Check if there's a pending invitation
    const pendingInvitation = await this.getPendingInvitation(request.email);
    if (pendingInvitation) {
      throw new Error('Invitation already sent to this email. Please wait for it to be accepted or expired.');
    }

    try {
      const invitation = await this.db.transaction(async (tx) => {
        // Generate secure invitation token
        const invitationToken = await this.tokenService.generateInvitationToken({
          email: request.email,
          tenantId: this.tenantId,
          expiresIn: '7d' // 7 days
        });

        // Create invitation record
        const invitation = await this.invitationRepository.create(tx, {
          ...request,
          tenantId: this.tenantId,
          invitedBy: this.currentUserId,
          invitationToken,
          tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        // Log activity
        await this.auditLogger.log({
          action: 'invite',
          entityType: 'invitation',
          entityId: invitation.id,
          performedBy: this.currentUserId,
          newValues: request
        });

        return invitation;
      });

      // Send invitation email (outside of transaction)
      await this.sendInvitationEmail(invitation);

      // Emit invitation sent event
      await EventBus.emit('team.invitation.sent', {
        tenantId: this.tenantId,
        invitation,
        sentBy: this.currentUserId
      });

      this.logger.info('Invitation sent successfully', {
        invitationId: invitation.id,
        email: invitation.email
      });

      return invitation;
    } catch (error) {
      this.logger.error('Failed to send invitation', {
        error,
        request
      });
      throw error;
    }
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(token: string, userData: {
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
  }): Promise<any> {
    this.logger.info('Accepting team invitation', { token });

    try {
      const result = await this.db.transaction(async (tx) => {
        // Validate invitation token and get invitation details
        const invitation = await this.invitationRepository.findByToken(tx, token);

        if (!invitation) {
          throw new Error('Invalid or expired invitation token');
        }

        if (invitation.status !== 'pending') {
          throw new Error('Invitation is no longer valid');
        }

        if (invitation.tokenExpiresAt < new Date()) {
          throw new Error('Invitation has expired');
        }

        // Check if user already exists
        let user = await this.findUserByEmail(invitation.email);

        if (!user) {
          // Create new user account
          user = await this.createUserAccount(tx, {
            email: invitation.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phoneNumber: userData.phoneNumber
          });
        }

        // Create team member record
        const teamMember = await this.createTeamMemberRecord(tx, {
          tenantId: invitation.tenantId,
          userId: user.id,
          position: invitation.position || 'Team Member',
          department: invitation.department,
          roleId: invitation.roleId
        });

        // Update invitation status
        const updatedInvitation = await this.invitationRepository.updateStatus(
          tx,
          invitation.id,
          'accepted',
          {
            acceptedAt: new Date(),
            acceptedBy: user.id
          }
        );

        // Log activity
        await this.auditLogger.log({
          action: 'accept',
          entityType: 'invitation',
          entityId: invitation.id,
          performedBy: user.id,
          oldValues: { status: 'pending' },
          newValues: { status: 'accepted', acceptedBy: user.id }
        });

        return {
          invitation: updatedInvitation,
          user,
          teamMember
        };
      });

      // Emit invitation accepted event
      await EventBus.emit('team.invitation.accepted', {
        tenantId: this.tenantId,
        invitation: result.invitation,
        user: result.user,
        teamMember: result.teamMember
      });

      this.logger.info('Invitation accepted successfully', {
        invitationId: result.invitation.id,
        userId: result.user.id
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to accept invitation', { error, token });
      throw error;
    }
  }

  /**
   * Reject team invitation
   */
  async rejectInvitation(token: string, reason?: string): Promise<void> {
    this.logger.info('Rejecting team invitation', { token, reason });

    const invitation = await this.invitationRepository.findByToken(token);

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer valid');
    }

    await this.db.transaction(async (tx) => {
      await this.invitationRepository.updateStatus(tx, invitation.id, 'revoked', {
        rejectionReason: reason
      });

      // Log activity
      await this.auditLogger.log({
        action: 'reject',
        entityType: 'invitation',
        entityId: invitation.id,
        performedBy: this.currentUserId,
        oldValues: { status: 'pending' },
        newValues: { status: 'revoked', rejectionReason: reason }
      });
    });

    // Emit invitation rejected event
    await EventBus.emit('team.invitation.rejected', {
      tenantId: this.tenantId,
      invitation,
      reason
    });

    this.logger.info('Invitation rejected', { invitationId: invitation.id });
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: string): Promise<TeamInvitation> {
    this.logger.info('Resending team invitation', { invitationId });

    const invitation = await this.invitationRepository.findById(invitationId);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending' && invitation.status !== 'expired') {
      throw new Error('Can only resend pending or expired invitations');
    }

    // Check resend count limits
    if (invitation.resendCount >= 3) {
      throw new Error('Maximum resend attempts exceeded');
    }

    const updatedInvitation = await this.db.transaction(async (tx) => {
      // Generate new token
      const newToken = await this.tokenService.generateInvitationToken({
        email: invitation.email,
        tenantId: this.tenantId,
        expiresIn: '7d'
      });

      // Update invitation
      const updated = await this.invitationRepository.resend(tx, invitationId, {
        invitationToken: newToken,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        resendCount: invitation.resendCount + 1,
        lastSentAt: new Date(),
        status: 'pending'
      });

      // Log activity
      await this.auditLogger.log({
        action: 'resend',
        entityType: 'invitation',
        entityId: invitationId,
        performedBy: this.currentUserId,
        oldValues: { resendCount: invitation.resendCount },
        newValues: { resendCount: invitation.resendCount + 1, status: 'pending' }
      });

      return updated;
    });

    // Send invitation email
    await this.sendInvitationEmail(updatedInvitation);

    // Emit invitation resent event
    await EventBus.emit('team.invitation.resent', {
      tenantId: this.tenantId,
      invitation: updatedInvitation,
      resentBy: this.currentUserId
    });

    this.logger.info('Invitation resent successfully', {
      invitationId,
      resendCount: updatedInvitation.resendCount
    });

    return updatedInvitation;
  }

  /**
   * Get pending invitations
   */
  async getPendingInvitations(): Promise<TeamInvitation[]> {
    return await this.invitationRepository.findPending();
  }

  /**
   * Get invitation by ID
   */
  async getInvitationById(invitationId: string): Promise<TeamInvitation | null> {
    return await this.invitationRepository.findById(invitationId);
  }

  /**
   * Get invitations with pagination and filtering
   */
  async getInvitations(page: number = 1, limit: number = 20): Promise<PaginatedResponse<TeamInvitation>> {
    return await this.invitationRepository.findMany({ page, limit });
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    this.logger.info('Cancelling team invitation', { invitationId });

    const invitation = await this.invitationRepository.findById(invitationId);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Can only cancel pending invitations');
    }

    await this.db.transaction(async (tx) => {
      await this.invitationRepository.updateStatus(tx, invitationId, 'revoked');

      // Log activity
      await this.auditLogger.log({
        action: 'cancel',
        entityType: 'invitation',
        entityId: invitationId,
        performedBy: this.currentUserId,
        oldValues: { status: 'pending' },
        newValues: { status: 'revoked' }
      });
    });

    // Emit invitation cancelled event
    await EventBus.emit('team.invitation.cancelled', {
      tenantId: this.tenantId,
      invitation,
      cancelledBy: this.currentUserId
    });

    this.logger.info('Invitation cancelled', { invitationId });
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvitations(): Promise<number> {
    this.logger.info('Cleaning up expired invitations');

    const expiredInvitations = await this.invitationRepository.findExpired();
    let cleanedCount = 0;

    for (const invitation of expiredInvitations) {
      await this.db.transaction(async (tx) => {
        await this.invitationRepository.updateStatus(tx, invitation.id, 'expired');

        // Log activity
        await this.auditLogger.log({
          action: 'expire',
          entityType: 'invitation',
          entityId: invitation.id,
          performedBy: this.currentUserId,
          oldValues: { status: invitation.status },
          newValues: { status: 'expired' }
        });
      });

      cleanedCount++;
    }

    this.logger.info('Expired invitations cleaned up', { count: cleanedCount });
    return cleanedCount;
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStatistics(): Promise<any> {
    return await this.invitationRepository.getStatistics();
  }

  // Private helper methods

  private async validateInvitationRequest(request: CreateInvitationRequest): Promise<void> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      throw new Error('Invalid email address');
    }

    // Validate role if provided
    if (request.roleId) {
      const role = await this.validateRole(request.roleId);
      if (!role || !role.isActive) {
        throw new Error('Invalid or inactive role');
      }
    }

    // Check invitation limits (if applicable)
    await this.checkInvitationLimits();
  }

  private async checkExistingTeamMember(email: string): Promise<any> {
    const query = `
      SELECT tm.* FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE u.email = $1 AND tm.tenant_id = $2
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [email, this.tenantId]);
      return result.rows[0] || null;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  private async getPendingInvitation(email: string): Promise<TeamInvitation | null> {
    return await this.invitationRepository.findPendingByEmail(email);
  }

  private async sendInvitationEmail(invitation: TeamInvitation): Promise<void> {
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.invitationToken}`;

    const emailData = {
      to: invitation.email,
      subject: `Invitation to Join ${this.getTenantName()} Team`,
      template: 'team_invitation',
      data: {
        firstName: invitation.firstName,
        position: invitation.position,
        department: invitation.department,
        invitationUrl,
        expirationDate: invitation.tokenExpiresAt.toLocaleDateString('id-ID'),
        showroomName: this.getTenantName()
      }
    };

    await this.emailService.sendEmail(emailData);
  }

  private async findUserByEmail(email: string): Promise<any> {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await this.db.query(query, [email]);
    return result.rows[0] || null;
  }

  private async createUserAccount(tx: DatabaseClient, userData: any): Promise<any> {
    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    const query = `
      INSERT INTO users (email, password, first_name, last_name, phone_number)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await tx.query(query, [
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.phoneNumber
    ]);

    return result.rows[0];
  }

  private async createTeamMemberRecord(tx: DatabaseClient, memberData: any): Promise<any> {
    const query = `
      INSERT INTO team_members (tenant_id, user_id, position, department, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await tx.query(query, [
      memberData.tenantId,
      memberData.userId,
      memberData.position,
      memberData.department,
      this.currentUserId
    ]);

    const teamMember = result.rows[0];

    // Assign role if provided
    if (memberData.roleId) {
      const roleQuery = `
        INSERT INTO team_member_roles (tenant_id, team_member_id, role_id, assigned_by, is_primary, effective_from)
        VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
      `;
      await tx.query(roleQuery, [memberData.tenantId, teamMember.id, memberData.roleId, this.currentUserId]);
    }

    return teamMember;
  }

  private async hashPassword(password: string): Promise<string> {
    // This would use bcrypt or similar hashing library
    // For now, return a placeholder
    return `hashed_${password}`;
  }

  private async validateRole(roleId: string): Promise<any> {
    const query = `
      SELECT * FROM dealership_roles
      WHERE id = $1 AND tenant_id = $2 AND is_active = true
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [roleId, this.tenantId]);
      return result.rows[0] || null;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  private async checkInvitationLimits(): Promise<void> {
    // Check if tenant has exceeded invitation limits
    const pendingCount = await this.invitationRepository.countPending();
    const maxInvitations = await this.getMaxInvitationsForTenant();

    if (pendingCount >= maxInvitations) {
      throw new Error(`Invitation limit exceeded. Maximum allowed: ${maxInvitations}`);
    }
  }

  private async getMaxInvitationsForTenant(): Promise<number> {
    // This would typically come from tenant subscription or settings
    return 100; // Reasonable default
  }

  private getTenantName(): string {
    // This would typically come from tenant configuration
    return 'Your Showroom';
  }
}