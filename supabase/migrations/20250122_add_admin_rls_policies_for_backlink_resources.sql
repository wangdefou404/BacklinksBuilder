-- 为管理员和超级管理员添加特殊的RLS策略
-- 允许admin和super角色完全管理backlink_resources表

-- 创建辅助函数来检查用户是否有管理员权限
CREATE OR REPLACE FUNCTION is_admin_or_super(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- 检查用户是否在user_roles表中有admin或super角色
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = user_uuid 
          AND role IN ('admin', 'super')
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为backlink_resources表添加管理员策略

-- 1. 管理员可以查看所有backlink resources
CREATE POLICY "Admin can view all backlink resources" ON backlink_resources
    FOR SELECT
    USING (is_admin_or_super(auth.uid()));

-- 2. 管理员可以插入任何backlink resources
CREATE POLICY "Admin can insert any backlink resources" ON backlink_resources
    FOR INSERT
    WITH CHECK (is_admin_or_super(auth.uid()));

-- 3. 管理员可以更新任何backlink resources
CREATE POLICY "Admin can update any backlink resources" ON backlink_resources
    FOR UPDATE
    USING (is_admin_or_super(auth.uid()))
    WITH CHECK (is_admin_or_super(auth.uid()));

-- 4. 管理员可以删除任何backlink resources
CREATE POLICY "Admin can delete any backlink resources" ON backlink_resources
    FOR DELETE
    USING (is_admin_or_super(auth.uid()));

-- 注释：这些策略与现有的用户策略并行工作
-- 如果用户是管理员，这些策略会允许访问
-- 如果用户不是管理员，原有的用户策略仍然生效