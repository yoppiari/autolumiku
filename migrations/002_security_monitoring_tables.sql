-- Security Monitoring Tables
-- Story 1.8: Role-Based Access Control
-- Implements comprehensive security monitoring and audit logging

-- Security events table - tracks all security-related events
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Event information
    event_type VARCHAR(100) NOT NULL, -- UNAUTHORIZED_ACCESS, PERMISSION_DENIED, etc.
    severity VARCHAR(20) NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL

    -- Resource information
    resource_type VARCHAR(100), -- Type of resource being accessed
    resource_id UUID, -- ID of the resource
    attempted_action VARCHAR(255), -- Action that was attempted
    denied_permission VARCHAR(255), -- Permission that was denied

    -- Request context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),

    -- Event details
    details JSONB, -- Additional event-specific details
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    CONSTRAINT valid_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'UNAUTHORIZED_ACCESS',
        'PERMISSION_DENIED',
        'SUSPICIOUS_ACTIVITY',
        'ROLE_ESCALATION_ATTEMPT',
        'AUDIT_VIOLATION',
        'RATE_LIMIT_EXCEEDED',
        'INVALID_TOKEN',
        'BRUTE_FORCE_ATTEMPT'
    ))
);

-- Security alerts table - tracks security alerts triggered by events
CREATE TABLE security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Alert information
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,

    -- Alert lifecycle
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notified_to TEXT[], -- Array of email addresses notified
    notified_at TIMESTAMP,

    -- Resolution
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    resolution TEXT,

    CONSTRAINT valid_alert_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- Permission check audit table - detailed audit of permission checks
CREATE TABLE permission_check_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Permission check details
    permission_code VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    check_result BOOLEAN NOT NULL, -- true if granted, false if denied

    -- Context
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),

    -- Additional context
    role_id UUID REFERENCES dealership_roles(id),
    role_name VARCHAR(100),
    details JSONB
);

-- Role change history table - tracks all role assignments and modifications
CREATE TABLE role_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Change details
    change_type VARCHAR(50) NOT NULL, -- ROLE_ASSIGNED, ROLE_REMOVED, ROLE_MODIFIED, PERMISSION_CHANGED
    entity_type VARCHAR(50) NOT NULL, -- team_member, role, permission
    entity_id UUID NOT NULL,

    -- User and target
    performed_by UUID REFERENCES users(id),
    affected_user UUID REFERENCES users(id),

    -- Change data
    old_values JSONB,
    new_values JSONB,
    change_summary TEXT,

    -- Approval workflow (for future use)
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,

    -- Metadata
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,

    CONSTRAINT valid_change_type CHECK (change_type IN (
        'ROLE_ASSIGNED',
        'ROLE_REMOVED',
        'ROLE_MODIFIED',
        'PERMISSION_ADDED',
        'PERMISSION_REMOVED',
        'ROLE_CREATED',
        'ROLE_DELETED'
    ))
);

-- Indexes for performance
CREATE INDEX idx_security_events_tenant ON security_events(tenant_id);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_detected_at ON security_events(detected_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_tenant_date ON security_events(tenant_id, detected_at DESC);

CREATE INDEX idx_security_alerts_tenant ON security_alerts(tenant_id);
CREATE INDEX idx_security_alerts_resolved ON security_alerts(resolved);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_detected_at ON security_alerts(detected_at DESC);
CREATE INDEX idx_security_alerts_tenant_active ON security_alerts(tenant_id, resolved) WHERE resolved = false;

CREATE INDEX idx_permission_check_audit_tenant ON permission_check_audit(tenant_id);
CREATE INDEX idx_permission_check_audit_user ON permission_check_audit(user_id);
CREATE INDEX idx_permission_check_audit_checked_at ON permission_check_audit(checked_at DESC);
CREATE INDEX idx_permission_check_audit_result ON permission_check_audit(check_result);
CREATE INDEX idx_permission_check_audit_permission ON permission_check_audit(permission_code);

CREATE INDEX idx_role_change_history_tenant ON role_change_history(tenant_id);
CREATE INDEX idx_role_change_history_entity ON role_change_history(entity_type, entity_id);
CREATE INDEX idx_role_change_history_user ON role_change_history(affected_user);
CREATE INDEX idx_role_change_history_changed_at ON role_change_history(changed_at DESC);
CREATE INDEX idx_role_change_history_type ON role_change_history(change_type);

-- Row Level Security
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_check_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_change_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY security_events_tenant_policy ON security_events
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY security_alerts_tenant_policy ON security_alerts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY permission_check_audit_tenant_policy ON permission_check_audit
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY role_change_history_tenant_policy ON role_change_history
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Views for common security queries
CREATE VIEW recent_security_events AS
SELECT
    se.*,
    u.email as user_email,
    u.first_name || ' ' || u.last_name as user_name,
    t.name as tenant_name
FROM security_events se
LEFT JOIN users u ON se.user_id = u.id
LEFT JOIN tenants t ON se.tenant_id = t.id
WHERE se.detected_at >= NOW() - INTERVAL '7 days'
ORDER BY se.detected_at DESC;

CREATE VIEW active_security_alerts AS
SELECT
    sa.*,
    u.email as user_email,
    u.first_name || ' ' || u.last_name as user_name,
    t.name as tenant_name
FROM security_alerts sa
LEFT JOIN users u ON sa.user_id = u.id
LEFT JOIN tenants t ON sa.tenant_id = t.id
WHERE sa.resolved = false
ORDER BY sa.severity DESC, sa.detected_at DESC;

-- Function to detect suspicious permission patterns
CREATE OR REPLACE FUNCTION detect_suspicious_permission_pattern(
    p_user_id UUID,
    p_tenant_id UUID,
    p_time_window_minutes INTEGER DEFAULT 5
) RETURNS TABLE (
    pattern_type VARCHAR,
    occurrence_count BIGINT,
    first_occurrence TIMESTAMP,
    last_occurrence TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'RAPID_PERMISSION_DENIAL' as pattern_type,
        COUNT(*) as occurrence_count,
        MIN(checked_at) as first_occurrence,
        MAX(checked_at) as last_occurrence
    FROM permission_check_audit
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND check_result = false
      AND checked_at >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    HAVING COUNT(*) >= 5

    UNION ALL

    SELECT
        'MULTIPLE_RESOURCE_ACCESS_ATTEMPT' as pattern_type,
        COUNT(DISTINCT resource_id) as occurrence_count,
        MIN(checked_at) as first_occurrence,
        MAX(checked_at) as last_occurrence
    FROM permission_check_audit
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND check_result = false
      AND checked_at >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    HAVING COUNT(DISTINCT resource_id) >= 10;
END;
$$ LANGUAGE plpgsql;

-- Function to get security risk score for user
CREATE OR REPLACE FUNCTION get_user_security_risk_score(
    p_user_id UUID,
    p_tenant_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_risk_score INTEGER := 0;
    v_failed_checks INTEGER;
    v_security_events INTEGER;
    v_recent_alerts INTEGER;
BEGIN
    -- Count failed permission checks in last 24 hours
    SELECT COUNT(*) INTO v_failed_checks
    FROM permission_check_audit
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND check_result = false
      AND checked_at >= NOW() - INTERVAL '24 hours';

    v_risk_score := v_risk_score + (v_failed_checks * 2);

    -- Count security events in last 7 days
    SELECT COUNT(*) INTO v_security_events
    FROM security_events
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND detected_at >= NOW() - INTERVAL '7 days';

    v_risk_score := v_risk_score + (v_security_events * 5);

    -- Count recent security alerts
    SELECT COUNT(*) INTO v_recent_alerts
    FROM security_alerts
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND detected_at >= NOW() - INTERVAL '30 days'
      AND severity IN ('HIGH', 'CRITICAL');

    v_risk_score := v_risk_score + (v_recent_alerts * 10);

    RETURN v_risk_score;
END;
$$ LANGUAGE plpgsql;
