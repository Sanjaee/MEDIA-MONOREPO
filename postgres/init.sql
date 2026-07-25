-- This file is intentionally left empty. User and database creation is handled automatically by the postgres docker image using POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB environment variables.

-- Security Hardening: Revoke default public schema creation
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Create read-only role for backups/monitoring
CREATE ROLE media_read_only WITH LOGIN ENCRYPTED PASSWORD 'read_only_local_password';
GRANT CONNECT ON DATABASE media_prod TO media_read_only;
GRANT USAGE ON SCHEMA public TO media_read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO media_read_only;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO media_read_only;
