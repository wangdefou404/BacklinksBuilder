# BacklinksBuilder Google OAuth 实施步骤

## 快速开始指南

本文档提供了为 BacklinksBuilder 项目集成 Google OAuth 的详细实施步骤。请按照以下顺序执行每个步骤。

## 前置条件

- [x] 已有 BacklinksBuilder 项目
- [x] Supabase 项目已创建
- [x] Google Cloud Console 访问权限
- [x] Node.js 20+ 和 pnpm 已安装

## 第一阶段：Google Cloud Console 配置

### 步骤 1：创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击项目选择器，创建新项目
3. 项目名称：`BacklinksBuilder`
4. 记录项目 ID

### 步骤 2：启用必要的 API

```bash
# 在 Google Cloud Console 中启用以下 API：
1. 导航到 "API 和服务" > "库"
2. 搜索并启用：
   - Google+ API
   - Google People API (可选)
```

### 步骤 3：创建 OAuth 2.0 凭据

1. 导航到 "API 和服务" > "凭据"
2. 点击 "创建凭据" > "OAuth 2.0 客户端 ID"
3. 配置同意屏幕（如果首次使用）：
   - 用户类型：外部
   - 应用名称：BacklinksBuilder
   - 用户支持电子邮件：你的邮箱
   - 开发者联系信息：你的邮箱

4. 创建 OAuth 客户端：
   - 应用类型：Web 应用
   - 名称：BacklinksBuilder Web Client
   - 授权的重定向 URI：
     ```
     http://localhost:4321/auth/callback
     https://your-domain.com/auth/callback
     ```

5. 保存客户端 ID 和客户端密钥

## 第二阶段：Supabase 配置

### 步骤 4：配置 Supabase 认证

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 导航到 "Authentication" > "Providers"
4. 启用 Google 提供商：
   - Google enabled: ✅
   - Client ID: `你的Google客户端ID`
   - Client Secret: `你的Google客户端密钥`

### 步骤 5：配置 URL 设置

1. 导航到 "Settings" > "Authentication"
2. 配置以下 URL：
   ```
   Site URL: https://your-domain.com
   
   Redirect URLs:
   http://localhost:4321/**
   https://your-domain.com/**
   ```

### 步骤 6：更新数据库结构

在 Supabase SQL Editor 中执行以下 SQL：

```sql
-- 更新用户表结构
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS provider_id TEXT;

-- 更新约束
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_plan_check,
ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro', 'super')),
DROP CONSTRAINT IF EXISTS users_provider_check,
ADD CONSTRAINT users_provider_check CHECK (provider IN ('email', 'google'));

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider_id);

-- 更新现有用户的 provider 字段
UPDATE users SET provider = 'email' WHERE provider IS NULL;

-- 启用行级安全
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow user creation" ON users;
CREATE POLICY "Allow user creation" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 授予权限
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT ON users TO anon;
```

## 第三阶段：项目代码实施

### 步骤 7：安装依赖

```bash
cd /Users/Wangdefou/GitHub/BacklinksBuilder
pnpm add @supabase/supabase-js
pnpm add -D @types/node
```

### 步骤 8：配置环境变量

创建 `.env.local` 文件：

```bash
# Supabase 配置
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google OAuth (可选，用于自定义处理)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 步骤 9：创建 Supabase 客户端

创建 `src/lib/supabase.ts`：

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: 'email' | 'google';
  created_at: string;
  plan: 'free' | 'pro' | 'super';
};

export type AuthSession = {
  user: User | null;
  session: any;
};
```

### 步骤 10：创建认证工具函数

创建 `src/lib/auth.ts`：

```typescript
import { supabase } from './supabase';
import type { AuthSession } from './supabase';

export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Google sign-in failed:', error);
    throw error;
  }
};

export const getCurrentSession = async (): Promise<AuthSession> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return { user: null, session: null };
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const user: User = {
      id: session.user.id,
      email: session.user.email || '',
      name: userProfile?.name || session.user.user_metadata?.full_name || '',
      avatar_url: userProfile?.avatar_url || session.user.user_metadata?.avatar_url,
      provider: session.user.app_metadata?.provider || 'email',
      created_at: session.user.created_at,
      plan: userProfile?.plan || 'free',
    };

    return { user, session };
  } catch (error) {
    console.error('Get current session failed:', error);
    return { user: null, session: null };
  }
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
```

### 步骤 11：创建 Google 登录按钮组件

创建 `src/components/auth/GoogleSignInButton.astro`：

```astro
---
// 服务端逻辑
---

<button 
  id="google-signin-btn"
  type="button"
  class="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
  aria-label="使用 Google 账户登录"
>
  <svg class="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
  <span class="text-sm font-medium">使用 Google 登录</span>
</button>

<script>
  import { signInWithGoogle } from '../../lib/auth';

  const googleSignInBtn = document.getElementById('google-signin-btn');
  
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      try {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          正在登录...
        `;
        
        await signInWithGoogle();
      } catch (error) {
        console.error('Google sign-in failed:', error);
        alert('Google 登录失败，请重试');
        
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = `
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <!-- Google icon paths -->
          </svg>
          <span class="text-sm font-medium">使用 Google 登录</span>
        `;
      }
    });
  }
</script>
```

### 步骤 12：创建 OAuth 回调页面

创建 `src/pages/auth/callback.astro`：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
---

<BaseLayout title="登录处理中...">
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
          正在处理登录...
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          请稍候，我们正在验证您的账户信息
        </p>
      </div>
    </div>
  </div>
</BaseLayout>

<script>
  import { getCurrentSession } from '../../lib/auth';

  async function handleAuthCallback() {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { user, session } = await getCurrentSession();
      
      if (user && session) {
        const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
        window.location.href = redirectTo;
      } else {
        window.location.href = '/auth/login?error=auth_failed';
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      window.location.href = '/auth/login?error=auth_error';
    }
  }

  handleAuthCallback();
</script>
```

### 步骤 13：更新登录页面

更新现有的 `src/pages/auth/login.astro` 文件，添加 Google 登录按钮：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton.astro';

const error = Astro.url.searchParams.get('error');
---

<BaseLayout title="用户登录">
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- 错误提示 -->
      {error && (
        <div class="rounded-md bg-red-50 p-4">
          <div class="text-sm text-red-800">
            {error === 'auth_failed' ? '登录失败，请重试' : '认证过程中出现错误'}
          </div>
        </div>
      )}

      <!-- Google 登录按钮 -->
      <GoogleSignInButton />
      
      <!-- 分隔线 -->
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-300" />
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-gray-50 text-gray-500">或</span>
        </div>
      </div>
      
      <!-- 现有的邮箱登录表单 -->
      <!-- ... 保持现有代码 ... -->
    </div>
  </div>
</BaseLayout>
```

### 步骤 14：创建用户同步 API

创建 `src/pages/api/auth/sync-user.ts`：

```typescript
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { user, session } = await request.json();
    
    if (!user || !session) {
      return new Response(JSON.stringify({ error: 'Missing user or session data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 检查用户是否已存在
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!existingUser && fetchError?.code === 'PGRST116') {
      // 创建新用户
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url,
          provider: user.app_metadata?.provider || 'google',
          provider_id: user.user_metadata?.provider_id,
          plan: 'free',
        });

      if (insertError) {
        console.error('Error creating user:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 创建用户配额
      await supabase.from('user_quotas').insert({
        user_id: user.id,
        dr_checks_remaining: 10,
        traffic_checks_remaining: 10,
        backlink_checks_remaining: 10,
        backlink_views_remaining: 50,
        reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sync user error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

## 第四阶段：测试和验证

### 步骤 15：本地测试

```bash
# 启动开发服务器
pnpm dev

# 测试流程：
# 1. 访问 http://localhost:4321/auth/login
# 2. 点击 "使用 Google 登录" 按钮
# 3. 完成 Google 授权
# 4. 验证重定向到 /auth/callback
# 5. 确认最终重定向到 /dashboard
```

### 步骤 16：验证数据库

在 Supabase Dashboard 中检查：

1. 用户表中是否创建了新记录
2. `provider` 字段是否设置为 `google`
3. `avatar_url` 是否正确填充
4. 用户配额是否正确创建

## 第五阶段：生产部署

### 步骤 17：配置 Vercel 环境变量

在 Vercel Dashboard 中设置：

```bash
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 步骤 18：更新 Google OAuth 重定向 URI

在 Google Cloud Console 中添加生产环境 URI：

```
https://your-domain.com/auth/callback
```

### 步骤 19：更新 Supabase 配置

在 Supabase Dashboard 中更新：

```
Site URL: https://your-domain.com
Redirect URLs: https://your-domain.com/**
```

### 步骤 20：部署和测试

```bash
# 部署到 Vercel
pnpm build
vercel --prod

# 测试生产环境 Google OAuth 流程
```

## 故障排除

### 常见问题

1. **重定向 URI 不匹配**
   - 检查 Google Cloud Console 中的重定向 URI 配置
   - 确保开发和生产环境的 URI 都已添加

2. **Supabase 配置错误**
   - 验证环境变量是否正确设置
   - 检查 Google 提供商是否已启用

3. **用户创建失败**
   - 检查数据库表结构是否正确
   - 验证 RLS 策略是否正确配置

4. **会话问题**
   - 检查浏览器是否阻止第三方 Cookie
   - 验证 Supabase 客户端配置

### 调试技巧

```typescript
// 在浏览器控制台中检查认证状态
import { getCurrentSession } from './lib/auth';
getCurrentSession().then(console.log);

// 检查 Supabase 会话
import { supabase } from './lib/supabase';
supabase.auth.getSession().then(console.log);
```

## 完成检查清单

- [ ] Google Cloud Console 项目已创建
- [ ] OAuth 2.0 凭据已配置
- [ ] Supabase Google 提供商已启用
- [ ] 数据库结构已更新
- [ ] 环境变量已设置
- [ ] Supabase 客户端已创建
- [ ] 认证工具函数已实现
- [ ] Google 登录按钮组件已创建
- [ ] OAuth 回调页面已实现
- [ ] 登录页面已更新
- [ ] 用户同步 API 已创建
- [ ] 本地测试通过
- [ ] 生产环境已配置
- [ ] 生产环境测试通过

## 下一步

完成 Google OAuth 集成后，你可以考虑：

1. 添加其他 OAuth 提供商（GitHub、Facebook 等）
2. 实现用户资料管理功能
3. 添加认证中间件保护敏感页面
4. 实现用户权限管理
5. 添加认证分析和监控

恭喜！你已经成功为 BacklinksBuilder 项目集成了 Google OAuth 登录功能。