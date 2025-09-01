-- 修复user_subscriptions表的RLS策略，解决无限递归问题
-- 删除现有的可能导致递归的策略
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Admin can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON user_subscriptions;

-- 创建简单的RLS策略，避免递归
-- 允许用户查看自己的订阅
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 允许认证用户插入自己的订阅记录
CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 允许用户更新自己的订阅
CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 允许service_role完全访问（用于API调用）
CREATE POLICY "Service role full access" ON user_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 确保anon和authenticated角色有基本权限
GRANT SELECT ON user_subscriptions TO anon;
GRANT ALL PRIVILEGES ON user_subscriptions TO authenticated;
GRANT ALL PRIVILEGES ON user_subscriptions TO service_role;