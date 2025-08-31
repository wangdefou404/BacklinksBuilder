-- 添加 last_login 列到 users 表
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- 为现有用户设置默认的 last_login 时间
UPDATE users SET last_login = created_at WHERE last_login IS NULL;