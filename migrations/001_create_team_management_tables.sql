-- Team Management Database Schema for autolumiku
-- Story 1.5: Showroom Team Management
-- Implements multi-tenant team management with Indonesian automotive dealership roles

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Team members table - extends user model with dealership-specific fields
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Dealership-specific information
    employee_id VARCHAR(50) UNIQUE, -- Internal employee ID
    position VARCHAR(100) NOT NULL, -- Job position/title
    department VARCHAR(100), -- Department (Sales, Finance, Service, etc.)
    hire_date DATE, -- Date when employee joined the showroom
    phone_number VARCHAR(20), -- Work phone number
    extension VARCHAR(10), -- Phone extension
    desk_location VARCHAR(100), -- Desk/office location

    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    is_on_leave BOOLEAN DEFAULT false,
    employment_type VARCHAR(50) DEFAULT 'full-time', -- full-time, part-time, contract
    reports_to UUID REFERENCES team_members(id), -- Manager/ supervisor

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT unique_tenant_user UNIQUE(tenant_id, user_id),
    CONSTRAINT valid_employment_type CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'intern'))
);

-- Roles table - defines Indonesian automotive dealership roles
CREATE TABLE dealership_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Role information
    name VARCHAR(100) NOT NULL, -- Role name (e.g., "Showroom Manager", "Sales Executive")
    display_name VARCHAR(100) NOT NULL, -- Display name for UI
    description TEXT, -- Role description and responsibilities
    role_level INTEGER NOT NULL DEFAULT 1, -- Hierarchy level (1=highest, higher numbers = lower level)

    -- Indonesian dealership specifics
    indonesian_title VARCHAR(100), -- Indonesian title (e.g., "Pemilik Showroom", "Sales Executive")
    department VARCHAR(100), -- Primary department
    is_custom BOOLEAN DEFAULT false, -- Custom role vs predefined role

    -- Status and permissions
    is_active BOOLEAN DEFAULT true,
    is_system_role BOOLEAN DEFAULT false, -- System-defined role (cannot be deleted)

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_tenant_role UNIQUE(tenant_id, name),
    CONSTRAINT valid_role_level CHECK (role_level > 0)
);

-- Role assignments table - links team members to roles
CREATE TABLE team_member_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES dealership_roles(id) ON DELETE CASCADE,

    -- Assignment details
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    is_primary BOOLEAN DEFAULT false, -- Primary role for team member
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP, -- For temporary role assignments

    -- Constraints
    CONSTRAINT unique_active_role UNIQUE(team_member_id, role_id, effective_from, effective_until),
    CONSTRAINT valid_date_range CHECK (effective_until IS NULL OR effective_until > effective_from)
);

-- Permissions table - defines granular permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Permission information
    code VARCHAR(100) UNIQUE NOT NULL, -- Permission code (e.g., "team.manage", "inventory.view")
    name VARCHAR(100) NOT NULL, -- Human-readable permission name
    description TEXT, -- Permission description
    category VARCHAR(50) NOT NULL, -- Permission category (team, inventory, billing, etc.)

    -- Metadata
    is_system BOOLEAN DEFAULT true, -- System-defined permission
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role permissions mapping - links roles to permissions
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES dealership_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

    -- Assignment details
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT unique_role_permission UNIQUE(role_id, permission_id)
);

-- Team invitations table - tracks invitation workflow
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Invitation details
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    department VARCHAR(100),
    role_id UUID REFERENCES dealership_roles(id),

    -- Invitation workflow
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    token_expires_at TIMESTAMP NOT NULL,
    invited_by UUID NOT NULL REFERENCES users(id),
    accepted_at TIMESTAMP,
    accepted_by UUID REFERENCES users(id),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- pending, accepted, expired, revoked
    rejection_reason TEXT,
    resend_count INTEGER DEFAULT 0,
    last_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Team activity log table - audit trail for team management
CREATE TABLE team_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Activity information
    action VARCHAR(100) NOT NULL, -- Action type (create, update, delete, invite, etc.)
    entity_type VARCHAR(50) NOT NULL, -- team_member, role, invitation, etc.
    entity_id UUID NOT NULL, -- ID of the affected entity

    -- User and context
    performed_by UUID REFERENCES users(id), -- User who performed the action
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Change details
    old_values JSONB, -- Previous values for updates
    new_values JSONB, -- New values for creates/updates
    changes_summary TEXT, -- Human-readable summary of changes

    -- Request context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),

    -- Metadata
    batch_id UUID, -- For grouping related changes
    correlation_id VARCHAR(100), -- For tracing related operations
    source_system VARCHAR(50) DEFAULT 'autolumiku' -- System that initiated the action
);

-- Performance metrics table - for team analytics
CREATE TABLE team_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,

    -- Metric information
    metric_type VARCHAR(100) NOT NULL, -- sales_count, response_time, customer_rating, etc.
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(50), -- unit, count, percentage, etc.

    -- Period information
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    period_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly, yearly

    -- Context and metadata
    additional_data JSONB, -- Additional metric context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_metric UNIQUE(tenant_id, team_member_id, metric_type, period_start, period_end),
    CONSTRAINT valid_period CHECK (period_end > period_start),
    CONSTRAINT valid_period_type CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly'))
);

-- Indexes for performance optimization
CREATE INDEX idx_team_members_tenant_id ON team_members(tenant_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_active ON team_members(tenant_id, is_active);
CREATE INDEX idx_team_members_department ON team_members(tenant_id, department);

CREATE INDEX idx_dealership_roles_tenant_id ON dealership_roles(tenant_id);
CREATE INDEX idx_dealership_roles_active ON dealership_roles(tenant_id, is_active);
CREATE INDEX idx_dealership_roles_level ON dealership_roles(tenant_id, role_level);

CREATE INDEX idx_team_member_roles_member ON team_member_roles(team_member_id);
CREATE INDEX idx_team_member_roles_role ON team_member_roles(role_id);
CREATE INDEX idx_team_member_roles_active ON team_member_roles(team_member_id, effective_from, effective_until);

CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);

CREATE INDEX idx_team_invitations_tenant ON team_invitations(tenant_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);
CREATE INDEX idx_team_invitations_token ON team_invitations(invitation_token);

CREATE INDEX idx_team_activity_logs_tenant ON team_activity_logs(tenant_id);
CREATE INDEX idx_team_activity_logs_entity ON team_activity_logs(entity_type, entity_id);
CREATE INDEX idx_team_activity_logs_user ON team_activity_logs(performed_by);
CREATE INDEX idx_team_activity_logs_date ON team_activity_logs(performed_at);
CREATE INDEX idx_team_activity_logs_action ON team_activity_logs(action);

CREATE INDEX idx_team_performance_metrics_member ON team_performance_metrics(team_member_id);
CREATE INDEX idx_team_performance_metrics_period ON team_performance_metrics(period_start, period_end);
CREATE INDEX idx_team_performance_metrics_type ON team_performance_metrics(metric_type);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_team_members_timestamp
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_dealership_roles_timestamp
    BEFORE UPDATE ON dealership_roles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_team_invitations_timestamp
    BEFORE UPDATE ON team_invitations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_members
CREATE POLICY team_members_tenant_policy ON team_members
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for dealership_roles
CREATE POLICY dealership_roles_tenant_policy ON dealership_roles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for team_member_roles
CREATE POLICY team_member_roles_tenant_policy ON team_member_roles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for team_invitations
CREATE POLICY team_invitations_tenant_policy ON team_invitations
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for team_activity_logs
CREATE POLICY team_activity_logs_tenant_policy ON team_activity_logs
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for team_performance_metrics
CREATE POLICY team_performance_metrics_tenant_policy ON team_performance_metrics
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Views for common queries
CREATE VIEW active_team_members AS
SELECT
    tm.*,
    u.email,
    u.first_name,
    u.last_name,
    dr.name as primary_role_name,
    dr.display_name as primary_role_display,
    dr.indonesian_title as primary_role_indonesian
FROM team_members tm
JOIN users u ON tm.user_id = u.id
LEFT JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
    AND tmr.is_primary = true
    AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
LEFT JOIN dealership_roles dr ON tmr.role_id = dr.id
WHERE tm.is_active = true;

-- Function to check team member permissions
CREATE OR REPLACE FUNCTION has_team_permission(
    p_user_id UUID,
    p_permission_code VARCHAR,
    p_tenant_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_tenant_id UUID;
    v_has_permission BOOLEAN := FALSE;
BEGIN
    -- Use provided tenant_id or get from context
    v_tenant_id := COALESCE(p_tenant_id, current_setting('app.current_tenant_id')::UUID);

    -- Check if user has the specified permission through their roles
    SELECT EXISTS(
        SELECT 1
        FROM team_members tm
        JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        JOIN role_permissions rp ON tmr.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE tm.user_id = p_user_id
        AND tm.tenant_id = v_tenant_id
        AND tm.is_active = true
        AND p.code = p_permission_code
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log team activities
CREATE OR REPLACE FUNCTION log_team_activity(
    p_tenant_id UUID,
    p_action VARCHAR,
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_performed_by UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_changes_summary TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO team_activity_logs (
        tenant_id, action, entity_type, entity_id, performed_by,
        old_values, new_values, changes_summary, ip_address, user_agent
    ) VALUES (
        p_tenant_id, p_action, p_entity_type, p_entity_id, p_performed_by,
        p_old_values, p_new_values, p_changes_summary, p_ip_address, p_user_agent
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;