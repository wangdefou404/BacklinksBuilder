-- 创建缺失的表和修复权限问题

-- 创建 user_profiles 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 backlinks 表
CREATE TABLE IF NOT EXISTS public.backlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 backlink_requests 表
CREATE TABLE IF NOT EXISTS public.backlink_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为 user_quotas 表添加缺失的列（如果不存在）
ALTER TABLE public.user_quotas 
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT 100;

-- 启用 RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlink_requests ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略

-- user_profiles 策略
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_quotas 策略
CREATE POLICY "Users can view own quota" ON public.user_quotas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quota" ON public.user_quotas
  FOR UPDATE USING (auth.uid() = user_id);

-- backlinks 策略
CREATE POLICY "Users can manage own backlinks" ON public.backlinks
  FOR ALL USING (auth.uid() = user_id);

-- backlink_requests 策略
CREATE POLICY "Users can manage own requests" ON public.backlink_requests
  FOR ALL USING (auth.uid() = user_id);

-- 授予权限

-- user_profiles 权限
GRANT SELECT ON public.user_profiles TO anon;
GRANT ALL ON public.user_profiles TO authenticated;

-- user_quotas 权限
GRANT SELECT ON public.user_quotas TO anon;
GRANT ALL ON public.user_quotas TO authenticated;

-- backlinks 权限
GRANT SELECT ON public.backlinks TO anon;
GRANT ALL ON public.backlinks TO authenticated;

-- backlink_requests 权限
GRANT SELECT ON public.backlink_requests TO anon;
GRANT ALL ON public.backlink_requests TO authenticated;

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为新表添加更新时间触发器
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlinks_updated_at BEFORE UPDATE ON public.backlinks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlink_requests_updated_at BEFORE UPDATE ON public.backlink_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();