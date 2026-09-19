-- Runs once on first container start. Creates the test database next to the main one.
CREATE DATABASE IF NOT EXISTS safe_mind_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON safe_mind_test.* TO 'safemind'@'%';
FLUSH PRIVILEGES;
