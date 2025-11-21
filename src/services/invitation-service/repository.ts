/**
 * Invitation Repository
 * Handles database operations for team invitations with tenant isolation
 */

import { DatabaseClient } from '@/lib/database';
import {
  TeamInvitation,
  PaginatedResponse,
  CreateInvitationRequest
} from '@/lib/types/team';

export class InvitationRepository {
  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string
  ) {}

  /**
   * Create new invitation
   */
  async create(
    tx: DatabaseClient,
    data: CreateInvitationRequest & {
      tenantId: string;
      invitedBy: string;
      invitationToken: string;
      tokenExpiresAt: Date;
    }
  ): Promise<TeamInvitation> {
    const query = `
      INSERT INTO team_invitations (
        tenant_id, email, first_name, last_name, position, department,
        role_id, invitation_token, token_expires_at, invited_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const params = [
      data.tenantId,
      data.email,
      data.firstName,
      data.lastName,
      data.position,
      data.department,
      data.roleId,
      data.invitationToken,
      data.tokenExpiresAt,
      data.invitedBy
    ];

    const result = await tx.query(query, params);
    return this.mapRowToInvitation(result.rows[0]);
  }

  /**
   * Find invitation by ID
   */
  async findById(invitationId: string): Promise<TeamInvitation | null> {
    const query = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ti.id = $1 AND ti.tenant_id = $2
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [invitationId, this.tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToInvitation(result.rows[0]);
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Find invitation by token
   */
  async findByToken(tx: DatabaseClient, token: string): Promise<TeamInvitation | null> {
    const query = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ti.invitation_token = $1 AND ti.tenant_id = $2
    `;

    const result = await tx.query(query, [token, this.tenantId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToInvitation(result.rows[0]);
  }

  /**
   * Find pending invitation by email
   */
  async findPendingByEmail(email: string): Promise<TeamInvitation | null> {
    const query = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ti.email = $1 AND ti.tenant_id = $2 AND ti.status = 'pending'
        AND ti.token_expires_at > CURRENT_TIMESTAMP
      ORDER BY ti.created_at DESC
      LIMIT 1
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [email, this.tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToInvitation(result.rows[0]);
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Find all invitations with pagination
   */
  async findMany(options: {
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<PaginatedResponse<TeamInvitation>> {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [this.tenantId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    // Build ORDER BY clause
    const validSortFields = ['created_at', 'email', 'first_name', 'last_name', 'status', 'token_expires_at'];
    const orderBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const orderClause = `${orderBy} ${sortOrder.toUpperCase()}`;

    // Main query
    const selectQuery = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM team_invitations
      WHERE ${conditions.join(' AND ')}
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);

      const [invitationsResult, countResult] = await Promise.all([
        this.db.query(selectQuery, params),
        this.db.query(countQuery, params.slice(0, -2)) // Remove limit and offset for count
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return {
        data: invitationsResult.rows.map(row => this.mapRowToInvitation(row)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Find pending invitations
   */
  async findPending(): Promise<TeamInvitation[]> {
    const query = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ti.tenant_id = $1 AND ti.status = 'pending'
        AND ti.token_expires_at > CURRENT_TIMESTAMP
      ORDER BY ti.created_at DESC
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId]);
      return result.rows.map(row => this.mapRowToInvitation(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Find expired invitations
   */
  async findExpired(): Promise<TeamInvitation[]> {
    const query = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ti.tenant_id = $1 AND ti.status = 'pending'
        AND ti.token_expires_at < CURRENT_TIMESTAMP
      ORDER BY ti.token_expires_at ASC
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId]);
      return result.rows.map(row => this.mapRowToInvitation(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Update invitation status
   */
  async updateStatus(
    tx: DatabaseClient,
    invitationId: string,
    status: string,
    updates: {
      acceptedAt?: Date;
      acceptedBy?: string;
      rejectionReason?: string;
    } = {}
  ): Promise<TeamInvitation> {
    const updateFields: string[] = ['status = $2'];
    const params: any[] = [invitationId, status];
    let paramIndex = 3;

    if (updates.acceptedAt) {
      updateFields.push(`accepted_at = $${paramIndex++}`);
      params.push(updates.acceptedAt);
    }

    if (updates.acceptedBy) {
      updateFields.push(`accepted_by = $${paramIndex++}`);
      params.push(updates.acceptedBy);
    }

    if (updates.rejectionReason) {
      updateFields.push(`rejection_reason = $${paramIndex++}`);
      params.push(updates.rejectionReason);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const query = `
      UPDATE team_invitations
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await tx.query(query, params);
    return this.mapRowToInvitation(result.rows[0]);
  }

  /**
   * Resend invitation
   */
  async resend(
    tx: DatabaseClient,
    invitationId: string,
    updates: {
      invitationToken: string;
      tokenExpiresAt: Date;
      resendCount: number;
      lastSentAt: Date;
      status: string;
    }
  ): Promise<TeamInvitation> {
    const query = `
      UPDATE team_invitations
      SET invitation_token = $2,
          token_expires_at = $3,
          resend_count = $4,
          last_sent_at = $5,
          status = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const params = [
      invitationId,
      updates.invitationToken,
      updates.tokenExpiresAt,
      updates.resendCount,
      updates.lastSentAt,
      updates.status
    ];

    const result = await tx.query(query, params);
    return this.mapRowToInvitation(result.rows[0]);
  }

  /**
   * Count pending invitations
   */
  async countPending(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM team_invitations
      WHERE tenant_id = $1 AND status = 'pending'
        AND token_expires_at > CURRENT_TIMESTAMP
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId]);
      return parseInt(result.rows[0].count);
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get invitation statistics
   */
  async getStatistics(): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_invitations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invitations,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_invitations,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_invitations,
        COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked_invitations,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7_days,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as last_30_days
      FROM team_invitations
      WHERE tenant_id = $1
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId]);
      return result.rows[0];
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Search invitations by email or name
   */
  async search(searchTerm: string, limit: number = 20): Promise<TeamInvitation[]> {
    const query = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ti.tenant_id = $1 AND (
        ti.email ILIKE $2 OR
        ti.first_name ILIKE $2 OR
        ti.last_name ILIKE $2
      )
      ORDER BY ti.created_at DESC
      LIMIT $3
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, `%${searchTerm}%`, limit]);
      return result.rows.map(row => this.mapRowToInvitation(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get invitations by status
   */
  async findByStatus(status: string, limit: number = 50): Promise<TeamInvitation[]> {
    const query = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ti.tenant_id = $1 AND ti.status = $2
      ORDER BY ti.created_at DESC
      LIMIT $3
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, status, limit]);
      return result.rows.map(row => this.mapRowToInvitation(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get invitations expiring soon (within 24 hours)
   */
  async findExpiringSoon(): Promise<TeamInvitation[]> {
    const query = `
      SELECT ti.*, dr.name as role_name, dr.display_name as role_display_name
      FROM team_invitations ti
      LEFT JOIN dealership_roles dr ON ti.role_id = dr.id
      WHERE ti.tenant_id = $1 AND ti.status = 'pending'
        AND ti.token_expires_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '24 hours'
      ORDER BY ti.token_expires_at ASC
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId]);
      return result.rows.map(row => this.mapRowToInvitation(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  private mapRowToInvitation(row: any): TeamInvitation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      position: row.position,
      department: row.department,
      roleId: row.role_id,
      invitationToken: row.invitation_token,
      tokenExpiresAt: new Date(row.token_expires_at),
      invitedBy: row.invited_by,
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
      acceptedBy: row.accepted_by,
      status: row.status,
      rejectionReason: row.rejection_reason,
      resendCount: row.resend_count,
      lastSentAt: new Date(row.last_sent_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      role: row.role_name ? {
        id: row.role_id,
        tenantId: row.tenant_id,
        name: row.role_name,
        displayName: row.role_display_name,
        isActive: true,
        isSystemRole: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } : undefined
    };
  }
}