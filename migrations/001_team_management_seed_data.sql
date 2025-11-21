-- Seed Data for Team Management System
-- Story 1.5: Showroom Team Management
-- Indonesian automotive dealership roles and permissions

-- Insert permissions for team management system
INSERT INTO permissions (code, name, description, category) VALUES
-- Team Management Permissions
('team.view', 'View Team Members', 'Can view team member information and profiles', 'team'),
('team.create', 'Create Team Members', 'Can invite and create new team members', 'team'),
('team.update', 'Update Team Members', 'Can modify team member information and roles', 'team'),
('team.delete', 'Delete Team Members', 'Can deactivate and remove team members', 'team'),
('team.roles.manage', 'Manage Roles', 'Can create and modify custom roles', 'team'),
('team.invite', 'Send Invitations', 'Can send team member invitations', 'team'),
('team.analytics', 'View Team Analytics', 'Can access team performance analytics', 'team'),

-- Inventory Management Permissions
('inventory.view', 'View Inventory', 'Can view vehicle inventory and listings', 'inventory'),
('inventory.create', 'Create Listings', 'Can create new vehicle listings', 'inventory'),
('inventory.update', 'Update Inventory', 'Can modify vehicle information and pricing', 'inventory'),
('inventory.delete', 'Delete Listings', 'Can remove vehicle listings', 'inventory'),
('inventory.status', 'Change Status', 'Can update vehicle availability status', 'inventory'),

-- Customer Management Permissions
('customers.view', 'View Customer Data', 'Can view customer information and inquiries', 'customers'),
('customers.respond', 'Respond to Inquiries', 'Can respond to customer inquiries', 'customers'),
('customers.export', 'Export Customer Data', 'Can export customer information', 'customers'),

-- Billing and Finance Permissions
('billing.view', 'View Billing', 'Can view billing information and invoices', 'billing'),
('billing.manage', 'Manage Billing', 'Can manage subscription and billing settings', 'billing'),
('billing.pay', 'Make Payments', 'Can process payments and renewals', 'billing'),
('billing.reports', 'Financial Reports', 'Can access financial reports and analytics', 'billing'),

-- Analytics and Reports Permissions
('analytics.view', 'View Analytics', 'Can access dashboard analytics', 'analytics'),
('analytics.export', 'Export Reports', 'Can export analytics data', 'analytics'),
('analytics.advanced', 'Advanced Analytics', 'Can access detailed business intelligence', 'analytics'),

-- Settings and Configuration Permissions
('settings.view', 'View Settings', 'Can view platform and tenant settings', 'settings'),
('settings.manage', 'Manage Settings', 'Can modify tenant configuration and branding', 'settings'),
('settings.api', 'API Management', 'Can manage API keys and integrations', 'settings'),

-- System Administration Permissions
('system.audit', 'View Audit Logs', 'Can access system audit logs', 'system'),
('system.backup', 'Manage Backups', 'Can initiate system backups', 'system'),
('system.maintenance', 'System Maintenance', 'Can perform system maintenance tasks', 'system');

-- This is a template that would be executed for each tenant during provisioning
-- The actual tenant_id would be provided during tenant setup

-- Function to create Indonesian dealership roles for a tenant
CREATE OR REPLACE FUNCTION create_dealership_roles(p_tenant_id UUID) RETURNS VOID AS $$
DECLARE
    v_role_id UUID;
BEGIN
    -- Showroom Manager (Pemilik/Kepala Showroom) - Full access
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'showroom_manager',
        'Showroom Manager',
        'Complete access to all showroom operations including team management, billing, inventory, and customer engagement',
        'Pemilik/Kepala Showroom',
        'Management',
        1,
        true
    ) RETURNING id INTO v_role_id;

    -- Assign all permissions to Showroom Manager
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions;

    -- Sales Manager (Manager Penjualan) - Team oversight and inventory
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'sales_manager',
        'Sales Manager',
        'Team oversight, inventory management, sales analytics, and customer relationship management',
        'Manager Penjualan',
        'Sales',
        2,
        true
    ) RETURNING id INTO v_role_id;

    -- Sales Manager permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE category IN ('team', 'inventory', 'customers', 'analytics')
       OR code IN ('billing.view', 'settings.view');

    -- Sales Executive - Customer interactions and inventory
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'sales_executive',
        'Sales Executive',
        'Customer interactions, inventory management, lead follow-up, and sales reporting',
        'Sales Executive',
        'Sales',
        3,
        true
    ) RETURNING id INTO v_role_id;

    -- Sales Executive permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE code IN (
        'inventory.view', 'inventory.create', 'inventory.update', 'inventory.status',
        'customers.view', 'customers.respond',
        'analytics.view'
    );

    -- Finance Manager (Manager Keuangan) - Billing and financial oversight
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'finance_manager',
        'Finance Manager',
        'Billing management, financial reporting, subscription oversight, and payment processing',
        'Manager Keuangan',
        'Finance',
        2,
        true
    ) RETURNING id INTO v_role_id;

    -- Finance Manager permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE category IN ('billing', 'analytics')
       OR code IN ('team.view', 'inventory.view', 'customers.view', 'settings.view');

    -- Service Advisor (Konsultan Layanan) - After-sales service
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'service_advisor',
        'Service Advisor',
        'After-sales service coordination, customer service, and service scheduling',
        'Konsultan Layanan',
        'Service',
        3,
        true
    ) RETURNING id INTO v_role_id;

    -- Service Advisor permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE code IN (
        'customers.view', 'customers.respond',
        'inventory.view',
        'analytics.view'
    );

    -- Marketing Coordinator (Koordinator Pemasaran) - Marketing and promotions
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'marketing_coordinator',
        'Marketing Coordinator',
        'Marketing campaigns, promotional activities, customer engagement, and lead generation',
        'Koordinator Pemasaran',
        'Marketing',
        3,
        true
    ) RETURNING id INTO v_role_id;

    -- Marketing Coordinator permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE code IN (
        'customers.view', 'customers.respond', 'customers.export',
        'inventory.view',
        'analytics.view', 'analytics.export',
        'settings.view'
    );

    -- Inventory Manager (Manager Inventaris) - Stock and listings
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'inventory_manager',
        'Inventory Manager',
        'Stock management, vehicle listings, pricing updates, and inventory reporting',
        'Manager Inventaris',
        'Inventory',
        3,
        true
    ) RETURNING id INTO v_role_id;

    -- Inventory Manager permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE category IN ('inventory', 'analytics')
       OR code IN ('customers.view', 'settings.view');

    -- Read-only Staff (Staf View-only) - Limited access for reporting
    INSERT INTO dealership_roles (tenant_id, name, display_name, description, indonesian_title, department, role_level, is_system_role)
    VALUES (
        p_tenant_id,
        'readonly_staff',
        'Read-only Staff',
        'Limited access for viewing reports and basic information without modification capabilities',
        'Staf View-only',
        'General',
        4,
        true
    ) RETURNING id INTO v_role_id;

    -- Read-only staff permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM permissions
    WHERE code IN ('inventory.view', 'analytics.view');

END;
$$ LANGUAGE plpgsql;

-- Function to create audit log triggers for team management tables
CREATE OR REPLACE FUNCTION create_team_audit_triggers(p_tenant_id UUID) RETURNS VOID AS $$
BEGIN
    -- Create trigger function for team_members table
    CREATE OR REPLACE FUNCTION audit_team_members()
    RETURNS TRIGGER AS $$
    DECLARE
        v_user_id UUID;
        v_tenant_id UUID;
        v_changes TEXT;
    BEGIN
        -- Get current user and tenant from context
        v_user_id := current_setting('app.current_user_id')::UUID;
        v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id, current_setting('app.current_tenant_id')::UUID);

        -- Determine action and changes
        IF TG_OP = 'INSERT' THEN
            v_changes := 'Created team member: ' || NEW.first_name || ' ' || NEW.last_name;
            INSERT INTO team_activity_logs (
                tenant_id, action, entity_type, entity_id, performed_by,
                new_values, changes_summary
            ) VALUES (
                v_tenant_id, 'create', 'team_member', NEW.id, v_user_id,
                row_to_json(NEW), v_changes
            );
            RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
            v_changes := 'Updated team member: ' || NEW.first_name || ' ' || NEW.last_name;
            INSERT INTO team_activity_logs (
                tenant_id, action, entity_type, entity_id, performed_by,
                old_values, new_values, changes_summary
            ) VALUES (
                v_tenant_id, 'update', 'team_member', NEW.id, v_user_id,
                row_to_json(OLD), row_to_json(NEW), v_changes
            );
            RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
            v_changes := 'Deleted team member: ' || OLD.first_name || ' ' || OLD.last_name;
            INSERT INTO team_activity_logs (
                tenant_id, action, entity_type, entity_id, performed_by,
                old_values, changes_summary
            ) VALUES (
                v_tenant_id, 'delete', 'team_member', OLD.id, v_user_id,
                row_to_json(OLD), v_changes
            );
            RETURN OLD;
        END IF;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger for team_members
    CREATE TRIGGER audit_team_members_trigger
        AFTER INSERT OR UPDATE OR DELETE ON team_members
        FOR EACH ROW
        EXECUTE FUNCTION audit_team_members();

    -- Similar audit triggers can be created for other tables as needed
    -- For brevity, showing only team_members example here

END;
$$ LANGUAGE plpgsql;

-- Sample tenant-specific role creation (would be called during tenant provisioning)
-- This is commented out as it would be executed during actual tenant setup
/*
SELECT create_dealership_roles('tenant-uuid-here');
SELECT create_team_audit_triggers('tenant-uuid-here');
*/

-- Default invitation email template (stored as JSON for flexibility)
INSERT INTO system_templates (template_type, template_name, content, metadata)
VALUES (
    'email',
    'team_invitation',
    json_build_object(
        'subject', 'Invitation to Join {{showroom_name}} Team',
        'body_html',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4b5563;">Welcome to {{showroom_name}}!</h2>

            <p>Hi {{first_name}},</p>

            <p>You have been invited to join the {{showroom_name}} team as a {{position}}.</p>

            <p><strong>Position:</strong> {{position}}</p>
            <p><strong>Department:</strong> {{department}}</p>

            <p>To accept this invitation and create your account, please click the button below:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{invitation_url}}"
                   style="background-color: #ef4444; color: white; padding: 12px 30px;
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    Accept Invitation
                </a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p><a href="{{invitation_url}}">{{invitation_url}}</a></p>

            <p><strong>Important:</strong> This invitation will expire on {{expiration_date}}.</p>

            <hr style="border: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="color: #6b7280; font-size: 14px;">
                If you did not expect this invitation, you can safely ignore this email.
            </p>

            <p style="color: #6b7280; font-size: 14px;">
                Best regards,<br>
                The {{showroom_name}} Team<br>
                {{showroom_address}}<br>
                {{showroom_phone}}
            </p>
        </div>',
        'body_text',
        'Welcome to {{showroom_name}}!

Hi {{first_name}},

You have been invited to join the {{showroom_name}} team as a {{position}}.

Position: {{position}}
Department: {{department}}

To accept this invitation, please visit:
{{invitation_url}}

This invitation will expire on {{expiration_date}}.

If you did not expect this invitation, you can safely ignore this email.

Best regards,
The {{showroom_name}} Team
{{showroom_address}}
{{showroom_phone}}'
    ),
    json_build_object(
        'variables', array['showroom_name', 'first_name', 'position', 'department', 'invitation_url', 'expiration_date', 'showroom_address', 'showroom_phone'],
        'locale', 'id-ID',
        'category', 'team_management'
    )
) ON CONFLICT (template_type, template_name) DO NOTHING;