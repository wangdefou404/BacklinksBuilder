-- 修复user_quotas表的外键约束
-- 将user_id外键从auth.users改为public.users

-- 首先删除现有的外键约束
ALTER TABLE public.user_quotas 
DROP CONSTRAINT IF EXISTS user_quotas_user_id_fkey;

-- 添加新的外键约束，指向public.users表
ALTER TABLE public.user_quotas 
ADD CONSTRAINT user_quotas_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 确保权限正确设置
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_quotas TO authenticated;
GRANT SELECT ON public.user_quotas TO anon;

-- 添加注释说明修复内容
COMMENT ON CONSTRAINT user_quotas_user_id_fkey ON public.user_quotas IS 'Fixed foreign key to reference public.users instead of auth.users';