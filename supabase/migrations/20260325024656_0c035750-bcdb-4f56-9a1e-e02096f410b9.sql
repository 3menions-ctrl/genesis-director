
-- Delete all data associated with artificial/seeded DiceBear users
-- Order matters due to foreign key constraints

-- 1. Delete comments by fake users
DELETE FROM project_comments WHERE user_id IN (SELECT id FROM profiles WHERE avatar_url LIKE '%dicebear%');

-- 2. Delete follows involving fake users
DELETE FROM user_follows WHERE follower_id IN (SELECT id FROM profiles WHERE avatar_url LIKE '%dicebear%') OR following_id IN (SELECT id FROM profiles WHERE avatar_url LIKE '%dicebear%');

-- 3. Delete gamification records
DELETE FROM user_gamification WHERE user_id IN (SELECT id FROM profiles WHERE avatar_url LIKE '%dicebear%');

-- 4. Delete movie projects by fake users (metadata-only, no real assets)
DELETE FROM movie_projects WHERE user_id IN (SELECT id FROM profiles WHERE avatar_url LIKE '%dicebear%');

-- 5. Delete the fake profiles themselves
DELETE FROM profiles WHERE avatar_url LIKE '%dicebear%';
