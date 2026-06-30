-- Migration 020: Link people directory to TSheets users
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS tsheets_user_id INT UNIQUE,
  ADD COLUMN IF NOT EXISTS tsheets_only BOOLEAN NOT NULL DEFAULT false;
