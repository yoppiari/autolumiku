-- Migration: Create tenant_branding table
-- Description: Stores branding configuration for each tenant
-- Created: 2025-11-20
-- Author: BMad Dev Agent

-- Create tenant_branding table
CREATE TABLE IF NOT EXISTS tenant_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Logo and favicon assets
    logo_url VARCHAR(500),
    favicon_url VARCHAR(500),

    -- Color scheme (hex format validation)
    primary_color VARCHAR(7) DEFAULT '#3B82F6' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    secondary_color VARCHAR(7) DEFAULT '#64748B' CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),

    -- Company information
    company_name VARCHAR(255) NOT NULL,
    company_address TEXT,
    company_phone VARCHAR(20) CHECK (company_phone ~ '^[\+]?[0-9\s\-\(\)]{10,20}$'),
    company_email VARCHAR(255) CHECK (company_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    company_website VARCHAR(255) CHECK (company_website ~ '^https?:\/\/[^\s/$.?#].[^\s]*$'),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_tenant_branding UNIQUE(tenant_id)
);

-- Create index for efficient tenant lookups
CREATE INDEX idx_tenant_branding_tenant_id ON tenant_branding(tenant_id);

-- Create index for company name searches
CREATE INDEX idx_tenant_branding_company_name ON tenant_branding(company_name);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenant_branding_updated_at
    BEFORE UPDATE ON tenant_branding
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default branding configuration for existing tenants
INSERT INTO tenant_branding (tenant_id, company_name)
SELECT
    id,
    name as company_name
FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM tenant_branding);

-- Comments for documentation
COMMENT ON TABLE tenant_branding IS 'Stores branding configuration and visual identity settings for each tenant';
COMMENT ON COLUMN tenant_branding.logo_url IS 'URL to tenant logo stored in S3';
COMMENT ON COLUMN tenant_branding.favicon_url IS 'URL to tenant favicon stored in S3';
COMMENT ON COLUMN tenant_branding.primary_color IS 'Primary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN tenant_branding.secondary_color IS 'Secondary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN tenant_branding.company_name IS 'Legal company name for display';
COMMENT ON COLUMN tenant_branding.company_address IS 'Physical business address';
COMMENT ON COLUMN tenant_branding.company_phone IS 'Contact phone number in international format';
COMMENT ON COLUMN tenant_branding.company_email IS 'Business contact email address';
COMMENT ON COLUMN tenant_branding.company_website IS 'Company website URL';