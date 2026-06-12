-- Profile email is display metadata; auth.users owns email uniqueness.
-- A re-created auth user (new uuid, same email) must not collide with an
-- orphaned profile row from the previous account.
DROP INDEX IF EXISTS "User_email_key";
