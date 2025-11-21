-- AutoLumiku Database Initialization Script
-- This script runs when the PostgreSQL container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set default timezone
SET timezone = 'Asia/Jakarta';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE autolumiku_prod TO autolumiku;

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS public;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO autolumiku;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO autolumiku;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO autolumiku;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'AutoLumiku database initialized successfully';
END $$;
