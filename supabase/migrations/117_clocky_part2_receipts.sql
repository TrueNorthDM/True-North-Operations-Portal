-- Clocky part 2, Requests (Requests.dc.html 9A to 9D): the receipts people
-- attach to a reimbursement. A private bucket with no policy for the signed-in
-- or anonymous roles: the portal's server writes and reads it with the service
-- role, after deciding who may (the person, Super Admins, Admins, Finance),
-- and hands out short-lived signed links. Never public.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'application/pdf'])
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
