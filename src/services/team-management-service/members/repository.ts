/**
 * Team Member Repository
 * Handles database operations for team members with tenant isolation
 */

import { DatabaseClient } from '@/lib/database';
import {
  TeamMember,
  TeamMembersQuery,
  PaginatedResponse,
  CreateTeamMemberRequest,
  UpdateTeamMemberRequest
} from '@/lib/types/team';

export class TeamMemberRepository {
  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string
  ) {}

  /**
   * Find team members with filtering and pagination
   */
  async findMany(query: TeamMembersQuery = {}): Promise<PaginatedResponse<TeamMember>> {
    const {
      page = 1,
      limit = 20,
      search,
      department,
      role,
      isActive,
      sortBy = 'name',
      sortOrder = 'asc'
    } = query;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = ['tm.tenant_id = $1'];
    const params: any[] = [this.tenantId];
    let paramIndex = 2;

    if (search) {
      conditions.push(`(
        u.first_name ILIKE $${paramIndex} OR
        u.last_name ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        tm.employee_id ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (department) {
      conditions.push(`tm.department = $${paramIndex}`);
      params.push(department);
      paramIndex++;
    }

    if (role) {
      conditions.push(`EXISTS (
        SELECT 1 FROM team_member_roles tmr
        JOIN dealership_roles dr ON tmr.role_id = dr.id
        WHERE tmr.team_member_id = tm.id
        AND dr.name = $${paramIndex}
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      )`);
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      conditions.push(`tm.is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    // Build ORDER BY clause
    const validSortFields = {
      name: 'u.first_name, u.last_name',
      createdAt: 'tm.created_at',
      role: 'primary_role.display_name',
      department: 'tm.department'
    };

    const orderBy = validSortFields[sortBy as keyof typeof validSortFields] || 'u.first_name, u.last_name';
    const orderClause = `${orderBy} ${sortOrder.toUpperCase()}`;

    // Main query
    const selectQuery = `
      SELECT
        tm.*,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at,
        primary_role.name as primary_role_name,
        primary_role.display_name as primary_role_display,
        primary_role.indonesian_title as primary_role_indonesian,
        primary_role.department as primary_role_department
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        AND tmr.is_primary = true
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      LEFT JOIN dealership_roles primary_role ON tmr.role_id = primary_role.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE ${conditions.join(' AND ')}
    `;

    try {
      // Set tenant context for RLS
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);

      const [membersResult, countResult] = await Promise.all([
        this.db.query(selectQuery, params),
        this.db.query(countQuery, params.slice(0, -2)) // Remove limit and offset for count
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return {
        data: membersResult.rows,
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
      // Clear tenant context
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Find team member by ID
   */
  async findById(memberId: string): Promise<TeamMember | null> {
    const query = `
      SELECT
        tm.*,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at,
        primary_role.name as primary_role_name,
        primary_role.display_name as primary_role_display,
        primary_role.indonesian_title as primary_role_indonesian
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        AND tmr.is_primary = true
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      LEFT JOIN dealership_roles primary_role ON tmr.role_id = primary_role.id
      WHERE tm.id = $1 AND tm.tenant_id = $2
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [memberId, this.tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTeamMember(result.rows[0]);
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Find team member by user ID
   */
  async findByUserId(userId: string): Promise<TeamMember | null> {
    const query = `
      SELECT
        tm.*,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at,
        primary_role.name as primary_role_name,
        primary_role.display_name as primary_role_display,
        primary_role.indonesian_title as primary_role_indonesian
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        AND tmr.is_primary = true
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      LEFT JOIN dealership_roles primary_role ON tmr.role_id = primary_role.id
      WHERE tm.user_id = $1 AND tm.tenant_id = $2
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [userId, this.tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTeamMember(result.rows[0]);
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Create new team member
   */
  async create(tx: DatabaseClient, data: CreateTeamMemberRequest & { tenantId: string; createdBy: string }): Promise<TeamMember> {
    const query = `
      INSERT INTO team_members (
        tenant_id, user_id, employee_id, position, department, hire_date,
        phone_number, extension, desk_location, employment_type, reports_to,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const params = [
      data.tenantId,
      data.userId,
      data.employeeId,
      data.position,
      data.department,
      data.hireDate,
      data.phoneNumber,
      data.extension,
      data.deskLocation,
      data.employmentType,
      data.reportsTo,
      data.createdBy
    ];

    const result = await tx.query(query, params);
    const member = this.mapRowToTeamMember(result.rows[0]);

    // Fetch the created member with user data
    return await this.findById(member.id);
  }

  /**
   * Update team member
   */
  async update(tx: DatabaseClient, memberId: string, data: UpdateTeamMemberRequest): Promise<TeamMember> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.position !== undefined) {
      updateFields.push(`position = $${paramIndex++}`);
      params.push(data.position);
    }
    if (data.department !== undefined) {
      updateFields.push(`department = $${paramIndex++}`);
      params.push(data.department);
    }
    if (data.employeeId !== undefined) {
      updateFields.push(`employee_id = $${paramIndex++}`);
      params.push(data.employeeId);
    }
    if (data.hireDate !== undefined) {
      updateFields.push(`hire_date = $${paramIndex++}`);
      params.push(data.hireDate);
    }
    if (data.phoneNumber !== undefined) {
      updateFields.push(`phone_number = $${paramIndex++}`);
      params.push(data.phoneNumber);
    }
    if (data.extension !== undefined) {
      updateFields.push(`extension = $${paramIndex++}`);
      params.push(data.extension);
    }
    if (data.deskLocation !== undefined) {
      updateFields.push(`desk_location = $${paramIndex++}`);
      params.push(data.deskLocation);
    }
    if (data.employmentType !== undefined) {
      updateFields.push(`employment_type = $${paramIndex++}`);
      params.push(data.employmentType);
    }
    if (data.reportsTo !== undefined) {
      updateFields.push(`reports_to = $${paramIndex++}`);
      params.push(data.reportsTo);
    }
    if (data.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      params.push(data.isActive);
    }
    if (data.isOnLeave !== undefined) {
      updateFields.push(`is_on_leave = $${paramIndex++}`);
      params.push(data.isOnLeave);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(memberId);

    const query = `
      UPDATE team_members
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await tx.query(query, params);
    return this.mapRowToTeamMember(result.rows[0]);
  }

  /**
   * Deactivate team member
   */
  async deactivate(tx: DatabaseClient, memberId: string): Promise<void> {
    const query = `
      UPDATE team_members
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await tx.query(query, [memberId]);
  }

  /**
   * Reactivate team member
   */
  async reactivate(tx: DatabaseClient, memberId: string): Promise<TeamMember> {
    const query = `
      UPDATE team_members
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await tx.query(query, [memberId]);
    return this.mapRowToTeamMember(result.rows[0]);
  }

  /**
   * Count active team members
   */
  async count(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM team_members
      WHERE tenant_id = $1 AND is_active = true
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
   * Search team members
   */
  async search(searchTerm: string, limit: number): Promise<TeamMember[]> {
    const query = `
      SELECT
        tm.*,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at,
        primary_role.name as primary_role_name,
        primary_role.display_name as primary_role_display,
        primary_role.indonesian_title as primary_role_indonesian
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        AND tmr.is_primary = true
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      LEFT JOIN dealership_roles primary_role ON tmr.role_id = primary_role.id
      WHERE tm.tenant_id = $1 AND tm.is_active = true AND (
        u.first_name ILIKE $2 OR
        u.last_name ILIKE $2 OR
        u.email ILIKE $2 OR
        tm.employee_id ILIKE $2
      )
      ORDER BY u.first_name, u.last_name
      LIMIT $3
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, `%${searchTerm}%`, limit]);
      return result.rows.map(row => this.mapRowToTeamMember(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Find team members by department
   */
  async findByDepartment(department: string): Promise<TeamMember[]> {
    const query = `
      SELECT
        tm.*,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at,
        primary_role.name as primary_role_name,
        primary_role.display_name as primary_role_display,
        primary_role.indonesian_title as primary_role_indonesian
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        AND tmr.is_primary = true
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      LEFT JOIN dealership_roles primary_role ON tmr.role_id = primary_role.id
      WHERE tm.tenant_id = $1 AND tm.department = $2 AND tm.is_active = true
      ORDER BY u.first_name, u.last_name
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, department]);
      return result.rows.map(row => this.mapRowToTeamMember(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get team hierarchy
   */
  async getHierarchy(): Promise<any> {
    const query = `
      WITH RECURSIVE team_hierarchy AS (
        -- Base case: top-level managers (those who don't report to anyone)
        SELECT
          tm.id,
          tm.user_id,
          u.first_name,
          u.last_name,
          tm.position,
          tm.department,
          tm.employee_id,
          0 as level,
          ARRAY[tm.id] as path,
          NULL::uuid as parent_id
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.tenant_id = $1 AND tm.is_active = true AND tm.reports_to IS NULL

        UNION ALL

        -- Recursive case: employees who report to someone
        SELECT
          tm.id,
          tm.user_id,
          u.first_name,
          u.last_name,
          tm.position,
          tm.department,
          tm.employee_id,
          th.level + 1,
          th.path || tm.id,
          tm.reports_to
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        JOIN team_hierarchy th ON tm.reports_to = th.id
        WHERE tm.tenant_id = $1 AND tm.is_active = true
        AND tm.id != ALL(th.path) -- Prevent circular references
      )
      SELECT * FROM team_hierarchy
      ORDER BY level, first_name, last_name
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
   * Check for circular reference in reporting structure
   */
  async hasCircularReference(memberId: string, managerId: string): Promise<boolean> {
    const query = `
      WITH RECURSIVE reporting_chain AS (
        SELECT id, reports_to, 1 as depth
        FROM team_members
        WHERE id = $1 AND tenant_id = $2 AND is_active = true

        UNION ALL

        SELECT tm.id, tm.reports_to, rc.depth + 1
        FROM team_members tm
        JOIN reporting_chain rc ON tm.id = rc.reports_to
        WHERE tm.tenant_id = $2 AND tm.is_active = true
        AND rc.depth < 10 -- Prevent infinite loops
      )
      SELECT COUNT(*) > 0 as has_circular
      FROM reporting_chain
      WHERE id = $3
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [managerId, this.tenantId, memberId]);
      return result.rows[0].has_circular;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get team statistics
   */
  async getStatistics(): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_members,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_members,
        COUNT(CASE WHEN is_on_leave = true THEN 1 END) as on_leave_members,
        COUNT(CASE WHEN hire_date IS NOT NULL THEN 1 END) as members_with_hire_date,
        AVG(EXTRACT(MONTH FROM AGE(CURRENT_DATE, hire_date))) as avg_tenure_months,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_hires,
        department,
        employment_type
      FROM team_members
      WHERE tenant_id = $1
      GROUP BY department, employment_type
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId]);

      // Process and aggregate statistics
      const stats = result.rows.reduce((acc, row) => {
        acc.totalMembers = (acc.totalMembers || 0) + parseInt(row.total_members);
        acc.activeMembers = (acc.activeMembers || 0) + parseInt(row.active_members);
        acc.onLeaveMembers = (acc.onLeaveMembers || 0) + parseInt(row.on_leave_members);
        acc.recentHires = (acc.recentHires || 0) + parseInt(row.recent_hires);

        // Department breakdown
        if (row.department) {
          acc.departmentBreakdown[row.department] = (acc.departmentBreakdown[row.department] || 0) + parseInt(row.active_members);
        }

        return acc;
      }, {
        totalMembers: 0,
        activeMembers: 0,
        onLeaveMembers: 0,
        recentHires: 0,
        departmentBreakdown: {}
      });

      return stats;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  private mapRowToTeamMember(row: any): TeamMember {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      employeeId: row.employee_id,
      position: row.position,
      department: row.department,
      hireDate: row.hire_date ? new Date(row.hire_date) : undefined,
      phoneNumber: row.phone_number,
      extension: row.extension,
      deskLocation: row.desk_location,
      isActive: row.is_active,
      isOnLeave: row.is_on_leave,
      employmentType: row.employment_type,
      reportsTo: row.reports_to,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      user: row.user_id ? {
        id: row.user_id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name
      } : undefined,
      primaryRole: row.primary_role_name ? {
        id: '', // Would need to join to get role ID
        tenantId: row.tenant_id,
        name: row.primary_role_name,
        displayName: row.primary_role_display,
        indonesianTitle: row.primary_role_indonesian,
        department: row.primary_role_department,
        roleLevel: 0, // Would need to join to get role level
        isActive: true,
        isSystemRole: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } : undefined
    };
  }
}