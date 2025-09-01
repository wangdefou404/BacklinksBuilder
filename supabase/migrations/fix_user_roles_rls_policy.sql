-- 修复user_roles表的RLS策略，解决无限递归问题
-- 删除现有的可能导致递归的策略
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON user_roles;
DROP POLICY IF EXISTS "Admin can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage all roles" ON user_roles;

-- 创建简单的RLS策略，避免递归
-- 允许用户查看自己的角色
CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 允许认证用户插入自己的角色记录
CREATE POLICY "Users can insert own role" ON user_roles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 允许service_role完全访问（用于API调用）
CREATE POLICY "Service role full access" ON user_roles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 确保anon和authenticated角色有基本权限
GRANT SELECT ON user_roles TO anon;
GRANT ALL PRIVILEGES ON user_roles TO authenticated;
GRANT ALL PRIVILEGES ON user_roles TO service_role;