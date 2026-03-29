-- 002_add_auth.sql
-- Adds password_hash column to users table for authentication support.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';

COMMENT ON COLUMN public.users.password_hash IS 'bcrypt hash of the user password.';
