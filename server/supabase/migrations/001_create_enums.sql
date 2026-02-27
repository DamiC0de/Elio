-- 001: Create custom enums for Elio
-- Date: 2026-02-27

CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'annual', 'care');
CREATE TYPE service_type AS ENUM ('gmail', 'outlook', 'imap', 'google_cal', 'telegram', 'spotify', 'apple_music', 'homekit', 'contacts');
CREATE TYPE service_status AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE message_role AS ENUM ('user', 'assistant');
CREATE TYPE memory_category AS ENUM ('preference', 'fact', 'person', 'event', 'reminder');
CREATE TYPE alert_level AS ENUM ('info', 'warning', 'urgent');
