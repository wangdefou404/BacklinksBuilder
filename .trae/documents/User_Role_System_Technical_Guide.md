# 用户角色权限系统技术实现指南

## 1. 概述

本指南详细说明如何在BacklinksBuilder项目中实现基于角色的用户权限系统，包括前端页面、后端API、权限控制和用户面板的完整实现。

## 2. 后端API实现

### 2.1 权限检查API

**文件路径：** `src/pages/api/auth/check-permission.ts`

```typescript
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { permission } = await request.json();
    
    // 获取当前用户
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '未授权' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return new Response(JSON.stringify({ error: '用户验证失败' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查用户权限
    const { data, error: permissionError } = await supabase
      .rpc('check_user_permission', {
        user_id_param: user.id,
        permission_name_param: permission
      });

    if (permissionError) {
      console.error('权限检查失败:', permissionError);
      return new Response(JSON.stringify({ error: '权限检查失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ hasPermission: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('权限检查API错误:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### 2.2 用户角色获取API

**文件路径：** `src/pages/api/auth/get-user-role.ts`

```typescript
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    // 获取当前用户
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '未授权' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return new Response(JSON.stringify({ error: '用户验证失败' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户角色
    const { data: roleData, error: roleError } = await supabase
      .rpc('get_user_role', {
        user_id_param: user.id
      });

    if (roleError) {
      console.error('获取用户角色失败:', roleError);
      return new Response(JSON.stringify({ error: '获取用户角色失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      role: roleData,
      user: {
        id: user.id,
        email: user.email
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取用户角色API错误:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### 2.3 配额检查API

**文件路径：** `src/pages/api/auth/check-quota.ts`

```typescript
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { quotaType, usageType = 'daily' } = await request.json();
    
    // 获取当前用户
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '未授权' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return new Response(JSON.stringify({ error: '用户验证失败' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查用户配额
    const { data, error: quotaError } = await supabase
      .rpc('check_user_quota', {
        user_id_param: user.id,
        quota_type_param: quotaType,
        usage_type: usageType
      });

    if (quotaError) {
      console.error('配额检查失败:', quotaError);
      return new Response(JSON.stringify({ error: '配额检查失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取详细配额信息
    const { data: quotaInfo, error: quotaInfoError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
      .eq('quota_type', quotaType)
      .single();

    return new Response(JSON.stringify({ 
      canUse: data,
      quotaInfo: quotaInfo || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('配额检查API错误:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

## 3. 前端权限控制组件

### 3.1 权限守卫组件

**文件路径：** `src/components/auth/PermissionGuard.astro`

```astro
---
import { supabase } from '../../lib/supabase';

interface Props {
  permission: string;
  fallback?: any;
  showUpgrade?: boolean;
}

const { permission, fallback, showUpgrade = false } = Astro.props;

// 获取当前用户
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;

let hasPermission = false;

if (user) {
  try {
    const { data } = await supabase
      .rpc('check_user_permission', {
        user_id_param: user.id,
        permission_name_param: permission
      });
    hasPermission = data || false;
  } catch (error) {
    console.error('权限检查失败:', error);
    hasPermission = false;
  }
}
---

{hasPermission ? (
  <slot />
) : showUpgrade ? (
  <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 text-center">
    <div class="flex items-center justify-center mb-4">
      <svg class="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
      </svg>
    </div>
    <h3 class="text-lg font-semibold text-gray-900 mb-2">需要升级权限</h3>
    <p class="text-gray-600 mb-4">此功能需要付费会员权限才能使用</p>
    <a href="/pricing" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      立即升级
    </a>
  </div>
) : (
  fallback || <div class="text-red-500">权限不足</div>
)}
```

### 3.2 角色检查组件

**文件路径：** `src/components/auth/RoleGuard.astro`

```astro
---
import { supabase } from '../../lib/supabase';

interface Props {
  allowedRoles: string[];
  fallback?: any;
}

const { allowedRoles, fallback } = Astro.props;

// 获取当前用户
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;

let hasRole = false;

if (user) {
  try {
    const { data: userRole } = await supabase
      .rpc('get_user_role', {
        user_id_param: user.id
      });
    hasRole = allowedRoles.includes(userRole || 'free');
  } catch (error) {
    console.error('角色检查失败:', error);
    hasRole = false;
  }
}
---

{hasRole ? (
  <slot />
) : (
  fallback || <div class="text-red-500">角色权限不足</div>
)}
```

### 3.3 配额显示组件

**文件路径：** `src/components/auth/QuotaDisplay.astro`

```astro
---
import { supabase } from '../../lib/supabase';

interface Props {
  quotaType: string;
  showProgress?: boolean;
}

const { quotaType, showProgress = true } = Astro.props;

// 获取当前用户
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;

let quotaInfo = null;

if (user) {
  try {
    const { data } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
      .eq('quota_type', quotaType)
      .single();
    quotaInfo = data;
  } catch (error) {
    console.error('获取配额信息失败:', error);
  }
}

const getQuotaTypeLabel = (type: string) => {
  switch (type) {
    case 'dr_checker': return 'DR检查';
    case 'backlink_generator': return '外链生成';
    case 'traffic_checker': return '流量检查';
    default: return type;
  }
};

const calculateProgress = (used: number, limit: number) => {
  if (limit === -1) return 0; // 无限制
  return Math.min((used / limit) * 100, 100);
};
---

{quotaInfo && (
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <div class="flex items-center justify-between mb-2">
      <h4 class="text-sm font-medium text-gray-900">{getQuotaTypeLabel(quotaType)}</h4>
      <span class="text-xs text-gray-500">
        {quotaInfo.daily_limit === -1 ? '无限制' : `${quotaInfo.daily_used}/${quotaInfo.daily_limit}`}
      </span>
    </div>
    
    {showProgress && quotaInfo.daily_limit !== -1 && (
      <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div 
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={`width: ${calculateProgress(quotaInfo.daily_used, quotaInfo.daily_limit)}%`}
        ></div>
      </div>
    )}
    
    <div class="flex justify-between text-xs text-gray-500">
      <span>今日已用: {quotaInfo.daily_used}</span>
      <span>本月已用: {quotaInfo.monthly_used}</span>
    </div>
  </div>
)}
```

## 4. 用户面板页面实现

### 4.1 普通用户面板

**文件路径：** `src/pages/user/dashboard.astro`

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import PermissionGuard from '../../components/auth/PermissionGuard.astro';
import QuotaDisplay from '../../components/auth/QuotaDisplay.astro';
import { supabase } from '../../lib/supabase';

// 检查用户是否登录
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  return Astro.redirect('/auth/login?redirect_to=/user/dashboard');
}

// 获取用户角色
const { data: userRole } = await supabase
  .rpc('get_user_role', {
    user_id_param: session.user.id
  });

// 如果是管理员或付费用户，重定向到对应面板
if (userRole === 'admin') {
  return Astro.redirect('/admin/dashboard');
} else if (userRole === 'premium') {
  return Astro.redirect('/premium/dashboard');
}
---

<BaseLayout title="用户面板">
  <div class="min-h-screen bg-gray-50">
    <!-- 导航栏 -->
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-semibold text-gray-900">用户面板</h1>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-500">欢迎，{session.user.email}</span>
            <a href="/auth/logout" class="text-sm text-red-600 hover:text-red-800">退出登录</a>
          </div>
        </div>
      </div>
    </nav>

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <!-- 升级提示 -->
      <div class="mb-6">
        <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold mb-2">升级到付费版本</h2>
              <p class="text-blue-100">解锁更多高级功能，提升工作效率</p>
            </div>
            <a href="/pricing" class="bg-white text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">
              立即升级
            </a>
          </div>
        </div>
      </div>

      <!-- 使用配额 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <QuotaDisplay quotaType="dr_checker" />
        <QuotaDisplay quotaType="backlink_generator" />
        <QuotaDisplay quotaType="traffic_checker" />
      </div>

      <!-- 工具入口 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- DR检查器 -->
        <PermissionGuard permission="tools.dr_checker.use" showUpgrade={true}>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center mb-4">
              <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">DR检查器</h3>
                <p class="text-sm text-gray-500">检查网站域名评级</p>
              </div>
            </div>
            <a href="/dr-checker" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center block">
              开始使用
            </a>
          </div>
        </PermissionGuard>

        <!-- 外链生成器 -->
        <PermissionGuard permission="tools.backlink_generator.use" showUpgrade={true}>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center mb-4">
              <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">外链生成器</h3>
                <p class="text-sm text-gray-500">生成高质量外链</p>
              </div>
            </div>
            <a href="/backlink-generator" class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-center block">
              开始使用
            </a>
          </div>
        </PermissionGuard>

        <!-- 流量检查器 -->
        <PermissionGuard permission="tools.traffic_checker.use" showUpgrade={true}>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center mb-4">
              <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">流量检查器</h3>
                <p class="text-sm text-gray-500">分析网站流量数据</p>
              </div>
            </div>
            <a href="/traffic-checker" class="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-center block">
              开始使用
            </a>
          </div>
        </PermissionGuard>
      </div>
    </div>
  </div>
</BaseLayout>
```

### 4.2 付费用户面板

**文件路径：** `src/pages/premium/dashboard.astro`

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import PermissionGuard from '../../components/auth/PermissionGuard.astro';
import QuotaDisplay from '../../components/auth/QuotaDisplay.astro';
import { supabase } from '../../lib/supabase';

// 检查用户是否登录
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  return Astro.redirect('/auth/login?redirect_to=/premium/dashboard');
}

// 检查用户是否有付费权限
const { data: hasPermission } = await supabase
  .rpc('check_user_permission', {
    user_id_param: session.user.id,
    permission_name_param: 'premium.features.access'
  });

if (!hasPermission) {
  return Astro.redirect('/user/dashboard');
}
---

<BaseLayout title="付费用户面板">
  <div class="min-h-screen bg-gray-50">
    <!-- 导航栏 -->
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-semibold text-gray-900">付费用户面板</h1>
            <span class="ml-3 px-2 py-1 bg-gold-100 text-gold-800 text-xs font-medium rounded-full">Premium</span>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-500">欢迎，{session.user.email}</span>
            <a href="/auth/logout" class="text-sm text-red-600 hover:text-red-800">退出登录</a>
          </div>
        </div>
      </div>
    </nav>

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <!-- 欢迎信息 -->
      <div class="mb-6">
        <div class="bg-gradient-to-r from-gold-400 to-yellow-500 rounded-lg p-6 text-white">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold mb-2">欢迎使用付费版本</h2>
              <p class="text-yellow-100">享受无限制的高级功能和优先支持</p>
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold">Premium</div>
              <div class="text-sm text-yellow-100">会员用户</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 使用统计 -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </div>
            <div class="ml-4">
              <div class="text-2xl font-bold text-gray-900">∞</div>
              <div class="text-sm text-gray-500">无限制使用</div>
            </div>
          </div>
        </div>
        
        <QuotaDisplay quotaType="dr_checker" />
        <QuotaDisplay quotaType="backlink_generator" />
        <QuotaDisplay quotaType="traffic_checker" />
      </div>

      <!-- 高级工具 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- 高级DR检查器 -->
        <PermissionGuard permission="tools.dr_checker.batch">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center mb-4">
              <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">批量DR检查</h3>
                <p class="text-sm text-gray-500">一次检查多个域名</p>
              </div>
            </div>
            <a href="/dr-checker?mode=batch" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center block">
              批量检查
            </a>
          </div>
        </PermissionGuard>

        <!-- 高级外链生成器 -->
        <PermissionGuard permission="tools.backlink_generator.advanced">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center mb-4">
              <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">高级外链生成</h3>
                <p class="text-sm text-gray-500">AI驱动的智能外链</p>
              </div>
            </div>
            <a href="/backlink-generator?mode=advanced" class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-center block">
              高级生成
            a>
          </div>
        </PermissionGuard>

        <!-- 数据导出 -->
        <PermissionGuard permission="data.export">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center mb-4">
              <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">数据导出</h3>
                <p class="text-sm text-gray-500">导出分析报告</p>
              </div>
            </div>
            <a href="/export" class="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-center block">
              导出数据
            </a>
          </div>
        </PermissionGuard>
      </div>
    </div>
  </div>
</BaseLayout>
```

## 5. 更新OAuth回调逻辑

**文件路径：** `src/pages/auth/callback.astro` (更新重定向逻辑)

```javascript
// 在handleOAuthCallback函数中更新重定向逻辑
async function handleOAuthCallback() {
  try {
    // ... 现有的认证逻辑 ...
    
    // 获取用户角色
    const { data: userRole } = await supabase
      .rpc('get_user_role', {
        user_id_param: finalUser.id
      });
    
    console.log('用户角色:', userRole);
    
    // 根据角色和邮箱确定重定向路径
    function getRedirectPath(role, email) {
      // 特殊管理员邮箱
      if (email === 'wangpangzier@gmail.com') {
        return '/admin/backlinks';
      }
      
      // 根据角色重定向
      switch (role) {
        case 'admin':
          return '/admin/dashboard';
        case 'premium':
          return '/premium/dashboard';
        case 'free':
        default:
          return '/user/dashboard';
      }
    }
    
    // 检查重定向参数
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirect_to') || getRedirectPath(userRole, finalUser.email);
    
    console.log('最终重定向目标:', redirectTo);
    
    // 跳转到目标页面
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 500);
    
  } catch (error) {
    // ... 错误处理 ...
  }
}
```

## 6. 部署和测试

### 6.1 数据库迁移

1. 运行SQL迁移文件创建表结构
2. 验证权限和角色数据正确插入
3. 测试数据库函数正常工作

### 6.2 功能测试

1. 测试不同角色用户的登录重定向
2. 验证权限控制组件正常工作
3. 测试配额限制和显示
4. 验证页面访问权限控制

### 6.3 用户体验测试

1. 测试升级提示和引导流程
2. 验证权限不足时的友好提示
3. 测试不同设备上的响应式布局

这个技术实现指南提供了完整的用户角色权限系统实现方案，包括后端API、前端组件、用户面板和权限控制逻辑。