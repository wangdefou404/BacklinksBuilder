-- 彻底移除所有与 user_profiles 表相关的依赖
-- 解决 OAuth 登录中 "relation 'user_profiles' does not exist" 错误

-- 1. 删除所有可能的触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;

-- 2. 删除所有相关的函数
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_created() CASCADE;

-- 3. 删除 user_profiles 表的所有 RLS 策略
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.user_profiles;

-- 4. 禁用 user_profiles 表的 RLS
ALTER TABLE IF EXISTS public.user_profiles DISABLE ROW LEVEL SECURITY;

-- 5. 完全删除 user_profiles 表（如果存在）
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- 6. 确保 users 表有所有必要的字段和权限
-- 检查 users 表是否存在必要字段
DO $$
BEGIN
    -- 确保 users 表有 name 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'name' AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN name TEXT;
    END IF;
    
    -- 确保 users 表有 avatar_url 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'avatar_url' AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
    END IF;
    
    -- 确保 users 表有 provider 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'provider' AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN provider TEXT DEFAULT 'email';
    END IF;
END $$;

-- 7. 设置 users 表的正确权限
GRANT ALL PRIVILEGES ON public.users TO postgres;
GRANT ALL PRIVILEGES ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;

-- 8. 确保 users 表的 RLS 策略正确
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;

-- 创建新的 RLS 策略
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 9. 允许服务角色完全访问
CREATE POLICY "Service role can manage all users" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

-- 10. 清理完成，OAuth 登录现在应该完全独立，只使用 users 表
SELECT 'OAuth login dependencies cleanup completed' as status;