/**
 * Team Management Service
 * Epic 1: Story 1.4 - Team Member Management
 *
 * Handles team member invitations, management, and access control
 */

import { prisma } from '@/lib/prisma';
import { TeamMember } from '@prisma/client';
import crypto from 'crypto';

/**
 * Team member invitation request
 */
export interface InviteTeamMemberRequest {
  tenantId: string;
  email: string;
  role: string;
  invitedBy: string;
  message?: string;
}

/**
 * Team member with user info
 */
export interface TeamMemberWithUser extends TeamMember {
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export class TeamService {
  /**
   * Invite a team member
   */
  async inviteTeamMember(data: InviteTeamMemberRequest): Promise<{
    success: boolean;
    teamMember?: TeamMember;
    message?: string;
  }> {
    try {
      // Check if member already exists
      const existing = await prisma.teamMember.findUnique({
        where: {
          tenantId_email: {
            tenantId: data.tenantId,
            email: data.email,
          },
        },
      });

      if (existing) {
        return {
          success: false,
          message: 'Team member with this email already exists',
        };
      }

      // Generate invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');

      // Create team member
      const teamMember = await prisma.teamMember.create({
        data: {
          tenantId: data.tenantId,
          email: data.email,
          role: data.role,
          status: 'invited',
          invitationToken,
          invitedAt: new Date(),
        },
      });

      // TODO: Send invitation email
      // await emailService.sendTeamInvitation({
      //   email: data.email,
      //   invitationToken,
      //   invitedByName: data.invitedBy,
      //   message: data.message,
      // });

      // Log audit event
      await this.logAuditEvent(data.tenantId, data.invitedBy, 'team_member_invited', {
        email: data.email,
        role: data.role,
      });

      return {
        success: true,
        teamMember,
        message: 'Team member invited successfully',
      };
    } catch (error) {
      console.error('Invite team member failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to invite team member',
      };
    }
  }

  /**
   * Get all team members for a tenant
   */
  async getTeamMembers(tenantId: string): Promise<{
    success: boolean;
    members: TeamMemberWithUser[];
    message?: string;
  }> {
    try {
      const members = await prisma.teamMember.findMany({
        where: { tenantId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        success: true,
        members,
      };
    } catch (error) {
      console.error('Get team members failed:', error);
      return {
        success: false,
        members: [],
        message: 'Failed to retrieve team members',
      };
    }
  }

  /**
   * Get team member by ID
   */
  async getTeamMember(id: string): Promise<TeamMemberWithUser | null> {
    try {
      const member = await prisma.teamMember.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return member;
    } catch (error) {
      console.error('Get team member failed:', error);
      return null;
    }
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(invitationToken: string, userId: string): Promise<{
    success: boolean;
    teamMember?: TeamMember;
    message?: string;
  }> {
    try {
      const teamMember = await prisma.teamMember.findUnique({
        where: { invitationToken },
      });

      if (!teamMember) {
        return {
          success: false,
          message: 'Invalid invitation token',
        };
      }

      if (teamMember.status === 'active') {
        return {
          success: false,
          message: 'Invitation already accepted',
        };
      }

      // Update team member
      const updated = await prisma.teamMember.update({
        where: { id: teamMember.id },
        data: {
          userId,
          status: 'active',
          acceptedAt: new Date(),
          invitationToken: null, // Invalidate token
        },
      });

      await this.logAuditEvent(teamMember.tenantId, userId, 'team_invitation_accepted', {
        email: teamMember.email,
      });

      return {
        success: true,
        teamMember: updated,
        message: 'Invitation accepted successfully',
      };
    } catch (error) {
      console.error('Accept invitation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to accept invitation',
      };
    }
  }

  /**
   * Resend team invitation
   */
  async resendInvitation(teamMemberId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const teamMember = await prisma.teamMember.findUnique({
        where: { id: teamMemberId },
      });

      if (!teamMember) {
        return {
          success: false,
          message: 'Team member not found',
        };
      }

      if (teamMember.status === 'active') {
        return {
          success: false,
          message: 'Team member is already active',
        };
      }

      // Generate new invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');

      await prisma.teamMember.update({
        where: { id: teamMemberId },
        data: {
          invitationToken,
          invitedAt: new Date(),
        },
      });

      // TODO: Send invitation email
      // await emailService.sendTeamInvitation({
      //   email: teamMember.email,
      //   invitationToken,
      // });

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
   * Update team member
   */
  async updateTeamMember(
    id: string,
    data: { role?: string; status?: string; name?: string }
  ): Promise<{
    success: boolean;
    teamMember?: TeamMember;
    message?: string;
  }> {
    try {
      const teamMember = await prisma.teamMember.update({
        where: { id },
        data,
      });

      return {
        success: true,
        teamMember,
        message: 'Team member updated successfully',
      };
    } catch (error) {
      console.error('Update team member failed:', error);
      return {
        success: false,
        message: 'Failed to update team member',
      };
    }
  }

  /**
   * Suspend team member
   */
  async suspendTeamMember(id: string, suspendedBy: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const teamMember = await prisma.teamMember.update({
        where: { id },
        data: { status: 'suspended' },
      });

      await this.logAuditEvent(teamMember.tenantId, suspendedBy, 'team_member_suspended', {
        email: teamMember.email,
      });

      return {
        success: true,
        message: 'Team member suspended successfully',
      };
    } catch (error) {
      console.error('Suspend team member failed:', error);
      return {
        success: false,
        message: 'Failed to suspend team member',
      };
    }
  }

  /**
   * Reactivate team member
   */
  async reactivateTeamMember(id: string, reactivatedBy: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const teamMember = await prisma.teamMember.update({
        where: { id },
        data: { status: 'active' },
      });

      await this.logAuditEvent(teamMember.tenantId, reactivatedBy, 'team_member_reactivated', {
        email: teamMember.email,
      });

      return {
        success: true,
        message: 'Team member reactivated successfully',
      };
    } catch (error) {
      console.error('Reactivate team member failed:', error);
      return {
        success: false,
        message: 'Failed to reactivate team member',
      };
    }
  }

  /**
   * Remove team member
   */
  async removeTeamMember(id: string, removedBy: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const teamMember = await prisma.teamMember.findUnique({
        where: { id },
      });

      if (!teamMember) {
        return {
          success: false,
          message: 'Team member not found',
        };
      }

      await prisma.teamMember.delete({
        where: { id },
      });

      await this.logAuditEvent(teamMember.tenantId, removedBy, 'team_member_removed', {
        email: teamMember.email,
      });

      return {
        success: true,
        message: 'Team member removed successfully',
      };
    } catch (error) {
      console.error('Remove team member failed:', error);
      return {
        success: false,
        message: 'Failed to remove team member',
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
          entityId: metadata.email,
          changes: metadata as any,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const teamService = new TeamService();
