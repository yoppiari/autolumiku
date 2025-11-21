/**
 * Team Management Service
 * Epic 1: Story 1.7 - Team Member Invitation & Management
 *
 * Handles team member invitations, role assignments, and team management
 * for the AutoLumiKu platform.
 */

import { prisma } from '@/lib/prisma';
import { TeamMember, User } from '@prisma/client';
import crypto from 'crypto';

/**
 * Team member invitation request
 */
export interface InviteTeamMemberRequest {
  tenantId: string;
  email: string;
  roleId: string;
  invitedBy: string;
  message?: string;
}

/**
 * Team member with user info
 */
export interface TeamMemberWithUser extends TeamMember {
  user: User;
  invitedByUser: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
}

export class TeamService {
  /**
   * Invite a team member
   */
  async inviteTeamMember(data: InviteTeamMemberRequest): Promise<{
    success: boolean;
    invitation?: TeamMember;
    message?: string;
  }> {
    try {
      // Check if user already exists in tenant
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          tenantId: data.tenantId,
        },
      });

      if (existingUser) {
        return {
          success: false,
          message: 'User already exists in this tenant',
        };
      }

      // Check for existing pending invitation
      const existingInvitation = await prisma.teamMember.findFirst({
        where: {
          email: data.email,
          tenantId: data.tenantId,
          status: 'pending',
        },
      });

      if (existingInvitation) {
        return {
          success: false,
          message: 'Invitation already sent to this email',
        };
      }

      // Generate invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create invitation
      const invitation = await prisma.teamMember.create({
        data: {
          tenantId: data.tenantId,
          email: data.email,
          roleId: data.roleId,
          invitedBy: data.invitedBy,
          status: 'pending',
          invitationToken,
          invitationExpiresAt: expiresAt,
        },
      });

      // TODO: Send invitation email
      // await emailService.sendTeamInvitation({
      //   email: data.email,
      //   invitationToken,
      //   tenantName: tenant.name,
      //   invitedByName: inviter.firstName + ' ' + inviter.lastName,
      //   message: data.message,
      // });

      // Log audit event
      await this.logAuditEvent(data.tenantId, data.invitedBy, 'team_member_invited', {
        email: data.email,
        roleId: data.roleId,
      });

      return {
        success: true,
        invitation,
        message: 'Invitation sent successfully',
      };
    } catch (error) {
      console.error('Invite team member failed:', error);
      return {
        success: false,
        message: 'Failed to send invitation',
      };
    }
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(
    invitationToken: string,
    userData: {
      password: string;
      firstName: string;
      lastName: string;
    }
  ): Promise<{
    success: boolean;
    user?: User;
    message?: string;
  }> {
    try {
      // Find invitation
      const invitation = await prisma.teamMember.findFirst({
        where: {
          invitationToken,
          status: 'pending',
          invitationExpiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!invitation) {
        return {
          success: false,
          message: 'Invalid or expired invitation',
        };
      }

      // Create user in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user account
        const user = await tx.user.create({
          data: {
            email: invitation.email,
            password: userData.password, // Should be hashed
            firstName: userData.firstName,
            lastName: userData.lastName,
            tenantId: invitation.tenantId,
            roleId: invitation.roleId,
            isEmailVerified: true, // Auto-verify for invited users
          },
        });

        // Update invitation status
        await tx.teamMember.update({
          where: { id: invitation.id },
          data: {
            userId: user.id,
            status: 'active',
            joinedAt: new Date(),
          },
        });

        return user;
      });

      // Log audit event
      await this.logAuditEvent(invitation.tenantId, result.id, 'team_member_joined', {
        email: invitation.email,
      });

      return {
        success: true,
        user: result,
        message: 'Successfully joined team',
      };
    } catch (error) {
      console.error('Accept invitation failed:', error);
      return {
        success: false,
        message: 'Failed to accept invitation',
      };
    }
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const invitation = await prisma.teamMember.findUnique({
        where: { id: invitationId },
      });

      if (!invitation || invitation.status !== 'pending') {
        return {
          success: false,
          message: 'Invitation not found or already accepted',
        };
      }

      // Generate new token and extend expiry
      const newToken = crypto.randomBytes(32).toString('hex');
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);

      await prisma.teamMember.update({
        where: { id: invitationId },
        data: {
          invitationToken: newToken,
          invitationExpiresAt: newExpiry,
        },
      });

      // TODO: Send invitation email again
      // await emailService.sendTeamInvitation({ ... });

      return {
        success: true,
        message: 'Invitation resent successfully',
      };
    } catch (error) {
      console.error('Resend invitation failed:', error);
      return {
        success: false,
        message: 'Failed to resend invitation',
      };
    }
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      await prisma.teamMember.delete({
        where: { id: invitationId },
      });

      return {
        success: true,
        message: 'Invitation cancelled',
      };
    } catch (error) {
      console.error('Cancel invitation failed:', error);
      return {
        success: false,
        message: 'Failed to cancel invitation',
      };
    }
  }

  /**
   * Get all team members for a tenant
   */
  async getTeamMembers(tenantId: string, options?: {
    status?: 'active' | 'pending' | 'suspended';
    page?: number;
    limit?: number;
  }): Promise<{
    members: TeamMemberWithUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = { tenantId };
      if (options?.status) {
        where.status = options.status;
      }

      const [members, total] = await Promise.all([
        prisma.teamMember.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: true,
            invitedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.teamMember.count({ where }),
      ]);

      return {
        members,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Get team members failed:', error);
      return {
        members: [],
        total: 0,
        page: 1,
        limit: 20,
      };
    }
  }

  /**
   * Update team member role
   */
  async updateMemberRole(
    memberId: string,
    roleId: string,
    updatedBy: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const member = await prisma.teamMember.findUnique({
        where: { id: memberId },
      });

      if (!member || !member.userId) {
        return {
          success: false,
          message: 'Team member not found',
        };
      }

      // Update user's role
      await prisma.user.update({
        where: { id: member.userId },
        data: { roleId },
      });

      // Update team member record
      await prisma.teamMember.update({
        where: { id: memberId },
        data: { roleId },
      });

      // Log audit event
      await this.logAuditEvent(member.tenantId, updatedBy, 'team_member_role_updated', {
        memberId,
        newRoleId: roleId,
      });

      return {
        success: true,
        message: 'Role updated successfully',
      };
    } catch (error) {
      console.error('Update member role failed:', error);
      return {
        success: false,
        message: 'Failed to update role',
      };
    }
  }

  /**
   * Suspend team member
   */
  async suspendMember(memberId: string, suspendedBy: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const member = await prisma.teamMember.update({
        where: { id: memberId },
        data: { status: 'suspended' },
      });

      // Revoke all sessions for this user
      if (member.userId) {
        await prisma.session.updateMany({
          where: { userId: member.userId },
          data: { revokedAt: new Date() },
        });
      }

      // Log audit event
      await this.logAuditEvent(member.tenantId, suspendedBy, 'team_member_suspended', {
        memberId,
      });

      return {
        success: true,
        message: 'Team member suspended',
      };
    } catch (error) {
      console.error('Suspend member failed:', error);
      return {
        success: false,
        message: 'Failed to suspend member',
      };
    }
  }

  /**
   * Reactivate suspended team member
   */
  async reactivateMember(memberId: string, reactivatedBy: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const member = await prisma.teamMember.update({
        where: { id: memberId },
        data: { status: 'active' },
      });

      // Log audit event
      await this.logAuditEvent(member.tenantId, reactivatedBy, 'team_member_reactivated', {
        memberId,
      });

      return {
        success: true,
        message: 'Team member reactivated',
      };
    } catch (error) {
      console.error('Reactivate member failed:', error);
      return {
        success: false,
        message: 'Failed to reactivate member',
      };
    }
  }

  /**
   * Remove team member (permanent)
   */
  async removeMember(memberId: string, removedBy: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const member = await prisma.teamMember.findUnique({
        where: { id: memberId },
      });

      if (!member) {
        return {
          success: false,
          message: 'Team member not found',
        };
      }

      // Delete team member record in transaction
      await prisma.$transaction(async (tx) => {
        // Delete team member
        await tx.teamMember.delete({
          where: { id: memberId },
        });

        // Optionally deactivate or delete user account
        if (member.userId) {
          await tx.user.update({
            where: { id: member.userId },
            data: { isEmailVerified: false }, // Disable account
          });
        }
      });

      // Log audit event
      await this.logAuditEvent(member.tenantId, removedBy, 'team_member_removed', {
        memberId,
        email: member.email,
      });

      return {
        success: true,
        message: 'Team member removed',
      };
    } catch (error) {
      console.error('Remove member failed:', error);
      return {
        success: false,
        message: 'Failed to remove member',
      };
    }
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    tenantId: string,
    userId: string,
    action: string,
    metadata: any
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action,
          entityType: 'team_member',
          entityId: metadata.memberId || metadata.email || '',
          changes: metadata as any,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const teamService = new TeamService();
