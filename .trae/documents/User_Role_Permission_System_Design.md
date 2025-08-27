# 用户角色权限系统设计文档

## 1. 系统概述

本文档设计了一个基于角色的用户权限系统，支持三种用户类型：管理员、付费用户和普通用户。每种用户类型拥有不同的权限和专属面板。

## 2. 用户角色定义

### 2.1 角色类型

| 角色 | 英文标识 | 权限级别 | 描述 |
|------|----------|----------|------|
| 管理员 | admin | 3 | 系统管理员，拥有所有权限 |
| 付费用户 | premium | 2 | 已付费用户，享受高级功能 |
| 普通用户 | free | 1 | 免费用户，基础功能使用 |

### 2.2 权限矩阵

| 功能模块 | 管理员 | 付费用户 | 普通用户 |
|----------|--------|----------|----------|
| 外链管理 | ✅ 完全访问 | ❌ 无权限 | ❌ 无权限 |
| 外链生成 | ✅ 无限制 | ✅ 高级功能 | ✅ 基础功能 |
| 流量检查 | ✅ 无限制 | ✅ 高级分析 | ✅ 基础检查 |
| DR检查 | ✅ 无限制 | ✅ 高级功能 | ✅ 限制次数 |
| 用户管理 | ✅ 完全访问 | ❌ 无权限 | ❌ 无权限 |
| 数据导出 | ✅ 完全访问 | ✅ 部分数据 | ❌ 无权限 |
| API访问 | ✅ 完全访问 | ✅ 限制调用 | ❌ 无权限 |

## 3. 数据库设计

### 3.1 用户角色表 (user_roles)

```sql
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (role IN ('admin', 'premium', 'free')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_user_roles_active ON user_roles(is_active);

-- 确保每个用户只有一个活跃角色
CREATE UNIQUE INDEX idx_user_roles_unique_active 
ON user_roles(user_id) 
WHERE is_active = true;
```

### 3.2 权限表 (permissions)

```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入基础权限
INSERT INTO permissions (name, description, module, action) VALUES
('admin.backlinks.manage', '管理外链数据', 'backlinks', 'manage'),
('admin.users.manage', '管理用户', 'users', 'manage'),
('tools.backlink_generator.use', '使用外链生成器', 'tools', 'use'),
('tools.traffic_checker.use', '使用流量检查器', 'tools', 'use'),
('tools.dr_checker.use', '使用DR检查器', 'tools', 'use'),
('data.export', '导出数据', 'data', 'export'),
('api.access', 'API访问', 'api', 'access');
```

### 3.3 角色权限关联表 (role_permissions)

```sql
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'premium', 'free')),
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- 确保角色-权限组合唯一
CREATE UNIQUE INDEX idx_role_permissions_unique 
ON role_permissions(role, permission_id);
```

### 3.4 用户使用配额表 (user_quotas)

```sql
CREATE TABLE user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL,
    daily_limit INTEGER DEFAULT 0,
    monthly_limit INTEGER DEFAULT 0,
    daily_used INTEGER DEFAULT 0,
    monthly_used INTEGER DEFAULT 0,
    reset_daily_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
    reset_monthly_at TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_user_quotas_type ON user_quotas(quota_type);

-- 确保用户-配额类型组合唯一
CREATE UNIQUE INDEX idx_user_quotas_unique 
ON user_quotas(user_id, quota_type);
```

## 4. 页面路由设计

### 4.1 路由结构

```
/dashboard          - 用户仪表板（根据角色重定向）
├── /admin          - 管理员专区
│   ├── /backlinks  - 外链管理
│   ├── /users      - 用户管理
│   └── /analytics  - 数据分析
├── /premium        - 付费用户专区
│   ├── /dashboard  - 付费用户仪表板
│   ├── /tools      - 高级工具
│   └── /reports    - 高级报告
└── /user           - 普通用户专区
    ├── /dashboard  - 普通用户仪表板
    ├── /tools      - 基础工具
    └── /profile    - 个人资料
```

### 4.2 重定向逻辑

```javascript
// 根据用户角色重定向
function getRedirectPath(userRole, email) {
    // 特殊管理员邮箱
    if (email === 'wangpangzier@gmail.com') {
        return '/admin/backlinks';
    }
    
    // 根据角色重定向
    switch (userRole) {
        case 'admin':
            return '/admin/dashboard';
        case 'premium':
            return '/premium/dashboard';
        case 'free':
        default:
            return '/user/dashboard';
    }
}
```

## 5. 用户面板功能设计

### 5.1 管理员面板 (/admin)

**核心功能：**
- 外链数据管理和审核
- 用户管理和角色分配
- 系统数据分析和报告
- 平台配置和设置

**页面组件：**
- 数据统计卡片
- 外链管理表格
- 用户管理界面
- 系统监控面板

### 5.2 付费用户面板 (/premium)

**核心功能：**
- 高级外链生成工具
- 详细的流量分析报告
- 批量DR检查功能
- 数据导出功能
- API访问权限

**页面组件：**
- 个人使用统计
- 高级工具集合
- 详细分析图表
- 导出历史记录

### 5.3 普通用户面板 (/user)

**核心功能：**
- 基础外链生成（有限制）
- 简单流量检查
- 基础DR检查（每日限制）
- 个人资料管理

**页面组件：**
- 使用配额显示
- 基础工具入口
- 升级提示
- 使用教程

## 6. 权限控制实现

### 6.1 中间件权限检查

```javascript
// middleware/auth.js
export async function checkPermission(request, requiredPermission) {
    const user = await getCurrentUser(request);
    if (!user) return false;
    
    const userRole = await getUserRole(user.id);
    const permissions = await getRolePermissions(userRole);
    
    return permissions.includes(requiredPermission);
}
```

### 6.2 页面级权限控制

```javascript
// 在每个受保护页面中
const hasPermission = await checkPermission(request, 'admin.backlinks.manage');
if (!hasPermission) {
    return redirect('/unauthorized');
}
```

### 6.3 组件级权限控制

```javascript
// components/PermissionGuard.astro
const { permission, fallback } = Astro.props;
const hasPermission = await checkUserPermission(permission);

if (!hasPermission) {
    return fallback || null;
}
```

## 7. 实施计划

### 阶段一：数据库设计
1. 创建用户角色相关表
2. 设置权限数据
3. 迁移现有用户数据

### 阶段二：权限系统
1. 实现权限检查中间件
2. 创建角色管理API
3. 更新认证流程

### 阶段三：用户面板
1. 创建不同角色的面板页面
2. 实现权限控制组件
3. 更新路由和重定向逻辑

### 阶段四：功能完善
1. 添加配额管理
2. 实现使用统计
3. 优化用户体验

## 8. 安全考虑

- 所有权限检查在服务端进行
- 敏感操作需要二次验证
- 定期审计用户权限
- 实施最小权限原则
- 记录关键操作日志