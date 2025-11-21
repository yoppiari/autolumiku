-- Enhanced RBAC Permissions for Story 1.8
-- Adds security monitoring and additional Indonesian dealership-specific permissions

-- Insert additional permissions for comprehensive RBAC and security monitoring
INSERT INTO permissions (code, name, description, category) VALUES
-- Security and Audit Permissions
('security.alerts.view', 'View Security Alerts', 'Can view security alerts and suspicious activity', 'security'),
('security.alerts.manage', 'Manage Security Alerts', 'Can resolve and manage security alerts', 'security'),
('security.events.view', 'View Security Events', 'Can view detailed security event logs', 'security'),
('security.monitor', 'Security Monitoring', 'Can access real-time security monitoring dashboard', 'security'),
('audit.logs.view', 'View Audit Logs', 'Can view audit logs for team activities', 'audit'),
('audit.logs.export', 'Export Audit Logs', 'Can export audit logs for compliance', 'audit'),

-- Role Management Permissions (enhanced)
('roles.view', 'View Roles', 'Can view role definitions and assignments', 'roles'),
('roles.create', 'Create Custom Roles', 'Can create new custom roles for dealership', 'roles'),
('roles.update', 'Update Roles', 'Can modify existing custom roles', 'roles'),
('roles.delete', 'Delete Custom Roles', 'Can delete custom roles (non-system only)', 'roles'),
('roles.assign', 'Assign Roles', 'Can assign roles to team members', 'roles'),
('roles.permissions.view', 'View Permissions', 'Can view permission matrix and details', 'roles'),
('roles.permissions.manage', 'Manage Permissions', 'Can modify role permissions', 'roles'),

-- Tenant Management Permissions (for showroom admins)
('tenant.view', 'View Tenant Info', 'Can view tenant/showroom information', 'tenant'),
('tenant.manage', 'Manage Tenant', 'Can modify tenant settings and configuration', 'tenant'),
('tenant.branding', 'Manage Branding', 'Can update showroom branding and appearance', 'tenant'),
('tenant.domains', 'Manage Domains', 'Can configure custom domains', 'tenant'),

-- Team Member Management (granular)
('team.profile.view', 'View Team Profiles', 'Can view detailed team member profiles', 'team'),
('team.profile.update', 'Update Team Profiles', 'Can modify team member profiles', 'team'),
('team.performance.view', 'View Performance', 'Can view team member performance metrics', 'team'),
('team.schedule.view', 'View Schedules', 'Can view team member schedules', 'team'),
('team.schedule.manage', 'Manage Schedules', 'Can create and modify team member schedules', 'team'),

-- Inventory Management (granular)
('inventory.pricing.update', 'Update Pricing', 'Can modify vehicle pricing', 'inventory'),
('inventory.photos.manage', 'Manage Photos', 'Can upload, organize, and delete vehicle photos', 'inventory'),
('inventory.bulk.operations', 'Bulk Operations', 'Can perform bulk inventory operations', 'inventory'),
('inventory.featured.manage', 'Manage Featured', 'Can mark vehicles as featured', 'inventory'),

-- Customer Communication
('customers.message', 'Message Customers', 'Can send messages to customers', 'customers'),
('customers.whatsapp', 'WhatsApp Integration', 'Can use WhatsApp integration for customer communication', 'customers'),
('customers.followup', 'Manage Follow-ups', 'Can create and manage customer follow-up tasks', 'customers'),
('customers.history.view', 'View Customer History', 'Can view complete customer interaction history', 'customers'),

-- Lead Management
('leads.view', 'View Leads', 'Can view incoming leads and inquiries', 'leads'),
('leads.assign', 'Assign Leads', 'Can assign leads to sales team members', 'leads'),
('leads.convert', 'Convert Leads', 'Can mark leads as converted to customers', 'leads'),
('leads.analytics', 'Lead Analytics', 'Can access lead conversion analytics', 'leads'),

-- Marketing Permissions
('marketing.campaigns.view', 'View Campaigns', 'Can view marketing campaigns', 'marketing'),
('marketing.campaigns.create', 'Create Campaigns', 'Can create marketing campaigns', 'marketing'),
('marketing.promotions.manage', 'Manage Promotions', 'Can manage promotional offers', 'marketing'),

-- Reporting Permissions
('reports.sales', 'Sales Reports', 'Can access sales reports and analytics', 'reports'),
('reports.inventory', 'Inventory Reports', 'Can access inventory turnover reports', 'reports'),
('reports.financial', 'Financial Reports', 'Can access financial performance reports', 'reports'),
('reports.custom', 'Custom Reports', 'Can create and export custom reports', 'reports')

ON CONFLICT (code) DO NOTHING;

-- Function to add enhanced Indonesian dealership roles with new permissions
CREATE OR REPLACE FUNCTION add_enhanced_dealership_roles(p_tenant_id UUID) RETURNS VOID AS $$
DECLARE
    v_role_id UUID;
    v_permission_ids UUID[];
BEGIN
    -- Finance Manager (Manager Keuangan)
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'finance_manager',
        'Finance Manager',
        'Full access to billing, subscription management, and financial reports without inventory or team management access',
        'Manager Keuangan',
        'Finance',
        2,
        true
    ) RETURNING id INTO v_role_id;

    -- Finance Manager permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE category IN ('billing', 'reports')
       OR code IN ('tenant.view', 'audit.logs.view', 'analytics.view');

    -- Service Advisor (Advisor Servis)
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'service_advisor',
        'Service Advisor',
        'Customer service and inquiry management, limited inventory viewing',
        'Advisor Servis',
        'Service',
        4,
        true
    ) RETURNING id INTO v_role_id;

    -- Service Advisor permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE code IN (
        'inventory.view',
        'customers.view',
        'customers.respond',
        'customers.message',
        'customers.whatsapp',
        'customers.history.view',
        'leads.view',
        'team.profile.view'
    );

    -- Marketing Coordinator (Koordinator Pemasaran)
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'marketing_coordinator',
        'Marketing Coordinator',
        'Marketing campaign management, promotional content, and customer engagement analytics',
        'Koordinator Pemasaran',
        'Marketing',
        3,
        true
    ) RETURNING id INTO v_role_id;

    -- Marketing Coordinator permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE category IN ('marketing', 'analytics', 'leads')
       OR code IN (
           'inventory.view',
           'inventory.featured.manage',
           'customers.view',
           'customers.message',
           'reports.sales',
           'reports.inventory'
       );

    -- Inventory Manager (Manager Inventaris)
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'inventory_manager',
        'Inventory Manager',
        'Complete inventory management including pricing, photos, and bulk operations',
        'Manager Inventaris',
        'Operations',
        2,
        true
    ) RETURNING id INTO v_role_id;

    -- Inventory Manager permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE category IN ('inventory', 'reports')
       OR code IN (
           'analytics.view',
           'customers.view',
           'leads.view'
       );

    -- Read-only Staff (Staff Baca-saja)
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'readonly_staff',
        'Read-only Staff',
        'View-only access to inventory, analytics, and reports without modification rights',
        'Staff Baca-saja',
        'Various',
        5,
        true
    ) RETURNING id INTO v_role_id;

    -- Read-only Staff permissions (view-only)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE code IN (
        'inventory.view',
        'analytics.view',
        'reports.sales',
        'reports.inventory',
        'customers.view',
        'leads.view',
        'team.profile.view',
        'tenant.view'
    );

    -- Update existing roles with new permissions
    -- Add security permissions to Showroom Manager
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT dr.id, p.id
    FROM dealership_roles dr
    CROSS JOIN permissions p
    WHERE dr.tenant_id = p_tenant_id
      AND dr.name = 'showroom_manager'
      AND p.category IN ('security', 'audit')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Add role management permissions to Showroom Manager and Sales Manager
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT dr.id, p.id
    FROM dealership_roles dr
    CROSS JOIN permissions p
    WHERE dr.tenant_id = p_tenant_id
      AND dr.name IN ('showroom_manager', 'sales_manager')
      AND p.category = 'roles'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql;

-- Add helper function to get recommended permissions for custom role creation
CREATE OR REPLACE FUNCTION get_permission_recommendations(
    p_department VARCHAR,
    p_role_level INTEGER
) RETURNS TABLE (
    permission_code VARCHAR,
    permission_name VARCHAR,
    permission_category VARCHAR,
    recommended_priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.code,
        p.name,
        p.category,
        CASE
            -- High priority permissions for department
            WHEN p.category = LOWER(p_department) THEN 1
            -- Medium priority - common permissions
            WHEN p.code IN ('inventory.view', 'analytics.view', 'team.profile.view') THEN 2
            -- Lower priority - specific permissions
            ELSE 3
        END as recommended_priority
    FROM permissions p
    WHERE p.is_system = true
    ORDER BY recommended_priority ASC, p.category ASC, p.name ASC;
END;
$$ LANGUAGE plpgsql;
