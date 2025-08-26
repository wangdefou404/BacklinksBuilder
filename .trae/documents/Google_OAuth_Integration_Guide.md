# BacklinksBuilder Google OAuth 集成指南

## 1. 概述

本文档详细说明如何为 BacklinksBuilder 项目集成 Google OAuth 登录功能。该集成将允许用户使用 Google 账户快速登录，提升用户体验并简化注册流程。

### 1.1 技术栈
- **前端**: Astro 5 + TypeScript + TailwindCSS
- **后端**: Supabase (认证 + 数据库)
- **OAuth 提供商**: Google OAuth 2.0
- **部署**: Vercel

### 1.2 集成目标
- 实现 Google 一键登录
- 与现有用户系统无缝集成
- 保持用户配额和订阅状态
- 提供安全的认证流程

## 2. Google OAuth 配置

### 2.1 Google Cloud Console 设置

1. **创建项目**
   ```bash
   # 访问 Google Cloud Console
   https://console.cloud.google.com/
   
   # 创建新项目或选择现有项目
   项目名称: BacklinksBuilder
   ```

2. **启用 Google+ API**
   ```bash
   # 导航到 API 和服务 > 库
   # 搜索并启用以下 API:
   - Google+ API
   - Google People API (可选，用于获取用户详细信息)
   ```

3. **创建 OAuth 2.0 凭据**
   ```bash
   # 导航到 API 和服务 > 凭据
   # 点击 "创建凭据" > "OAuth 2.0 客户端 ID"
   
   应用类型: Web 应用
   名称: BacklinksBuilder Web Client
   
   # 授权的重定向 URI:
   开发环境: http://localhost:4321/auth/callback
   生产环境: https://your-domain.com/auth/callback
   ```

4. **获取客户端凭据**
   ```bash
   # 保存以下信息:
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

### 2.2 Supabase 配置

1. **启用 Google 提供商**
   ```sql
   -- 在 Supabase Dashboard 中:
   -- 导航到 Authentication > Providers
   -- 启用 Google 提供商
   -- 输入 Google Client ID 和 Client Secret
   ```

2. **配置重定向 URL**
   ```bash
   # 在 Supabase 项目设置中添加:
   Site URL: https://your-domain.com
   Redirect URLs: 
   - http://localhost:4321/**
   - https://your-domain.com/**
   ```

## 3. 环境变量配置

### 3.1 创建环境变量文件

```bash
# .env.local
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google OAuth (可选，如果需要自定义处理)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3.2 Astro 配置更新

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [],
  vite: {
    define: {
      'process.env.PUBLIC_SUPABASE_URL': JSON.stringify(process.env.PUBLIC_SUPABASE_URL),
      'process.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.PUBLIC_SUPABASE_ANON_KEY),
    },
  },
});
```

## 4. 依赖安装

```bash
# 安装 Supabase 客户端
pnpm add @supabase/supabase-js

# 安装类型定义
pnpm add -D @types/node
```

## 5. Supabase 客户端配置

### 5.1 创建 Supabase 客户端

```typescript
// src/lib/supabase.ts
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

// 类型定义
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

### 5.2 认证工具函数

```typescript
// src/lib/auth.ts
import { supabase } from './supabase';
import type { AuthSession } from './supabase';

// Google OAuth 登录
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

    if (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Sign in with Google failed:', error);
    throw error;
  }
};

// 获取当前用户会话
export const getCurrentSession = async (): Promise<AuthSession> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Get session error:', error);
      return { user: null, session: null };
    }

    if (!session) {
      return { user: null, session: null };
    }

    // 获取用户详细信息
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Get user profile error:', profileError);
    }

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

// 登出
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Sign out failed:', error);
    throw error;
  }
};

// 监听认证状态变化
export const onAuthStateChange = (callback: (session: AuthSession) => void) => {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      const authSession = await getCurrentSession();
      callback(authSession);
    } else if (event === 'SIGNED_OUT') {
      callback({ user: null, session: null });
    }
  });
};
```

## 6. 前端组件实现

### 6.1 Google 登录按钮组件

```typescript
// src/components/auth/GoogleSignInButton.astro
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
        
        // 恢复按钮状态
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = `
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span class="text-sm font-medium">使用 Google 登录</span>
        `;
      }
    });
  }
</script>
```

### 6.2 认证状态管理组件

```typescript
// src/components/auth/AuthProvider.astro
---
// 服务端逻辑
---

<div id="auth-provider" data-auth-state="loading">
  <slot />
</div>

<script>
  import { getCurrentSession, onAuthStateChange } from '../../lib/auth';
  import type { AuthSession } from '../../lib/supabase';

  class AuthProvider {
    private authState: AuthSession = { user: null, session: null };
    private listeners: ((state: AuthSession) => void)[] = [];

    constructor() {
      this.init();
    }

    private async init() {
      // 获取初始会话
      this.authState = await getCurrentSession();
      this.notifyListeners();

      // 监听认证状态变化
      onAuthStateChange((session) => {
        this.authState = session;
        this.notifyListeners();
      });

      // 更新 DOM 状态
      this.updateDOMState();
    }

    private notifyListeners() {
      this.listeners.forEach(listener => listener(this.authState));
    }

    private updateDOMState() {
      const provider = document.getElementById('auth-provider');
      if (provider) {
        provider.setAttribute('data-auth-state', 
          this.authState.user ? 'authenticated' : 'unauthenticated'
        );
        
        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('auth-state-changed', {
          detail: this.authState
        }));
      }
    }

    public getAuthState(): AuthSession {
      return this.authState;
    }

    public subscribe(listener: (state: AuthSession) => void) {
      this.listeners.push(listener);
      return () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      };
    }
  }

  // 创建全局认证提供者实例
  window.authProvider = new AuthProvider();
</script>
```

## 7. 页面路由实现

### 7.1 OAuth 回调处理页面

```typescript
// src/pages/auth/callback.astro
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
      // 等待认证完成
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { user, session } = await getCurrentSession();
      
      if (user && session) {
        // 登录成功，重定向到仪表板或首页
        const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
        window.location.href = redirectTo;
      } else {
        // 登录失败，重定向到登录页面
        window.location.href = '/auth/login?error=auth_failed';
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      window.location.href = '/auth/login?error=auth_error';
    }
  }

  // 页面加载时处理回调
  handleAuthCallback();
</script>
```

### 7.2 更新登录页面

```typescript
// src/pages/auth/login.astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton.astro';

const error = Astro.url.searchParams.get('error');
const errorMessages = {
  auth_failed: '登录失败，请重试',
  auth_error: '认证过程中出现错误',
  access_denied: '您拒绝了授权请求',
};
---

<BaseLayout title="用户登录">
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <img class="mx-auto h-12 w-auto" src="/logo.svg" alt="BacklinksBuilder">
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          登录您的账户
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          使用您的账户访问 BacklinksBuilder 的所有功能
        </p>
      </div>
      
      {error && (
        <div class="rounded-md bg-red-50 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">
                {errorMessages[error] || '登录时出现未知错误'}
              </h3>
            </div>
          </div>
        </div>
      )}

      <div class="space-y-4">
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
        
        <!-- 传统邮箱登录表单 -->
        <form class="space-y-6" action="/api/auth/login" method="POST">
          <div>
            <label for="email" class="sr-only">邮箱地址</label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              autocomplete="email" 
              required 
              class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" 
              placeholder="邮箱地址"
            >
          </div>
          <div>
            <label for="password" class="sr-only">密码</label>
            <input 
              id="password" 
              name="password" 
              type="password" 
              autocomplete="current-password" 
              required 
              class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" 
              placeholder="密码"
            >
          </div>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input 
                id="remember-me" 
                name="remember-me" 
                type="checkbox" 
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              >
              <label for="remember-me" class="ml-2 block text-sm text-gray-900">
                记住我
              </label>
            </div>
            
            <div class="text-sm">
              <a href="/auth/forgot-password" class="font-medium text-blue-600 hover:text-blue-500">
                忘记密码？
              </a>
            </div>
          </div>
          
          <div>
            <button 
              type="submit" 
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              登录
            </button>
          </div>
        </form>
        
        <div class="text-center">
          <span class="text-sm text-gray-600">
            还没有账户？
            <a href="/auth/register" class="font-medium text-blue-600 hover:text-blue-500">
              立即注册
            </a>
          </span>
        </div>
      </div>
    </div>
  </div>
</BaseLayout>
```

## 8. API 路由实现

### 8.1 用户信息同步 API

```typescript
// src/pages/api/auth/sync-user.ts
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

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!existingUser) {
      // 创建新用户记录
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url,
          plan: 'free',
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating user:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 创建用户配额记录
      const { error: quotaError } = await supabase
        .from('user_quotas')
        .insert({
          user_id: user.id,
          dr_checks_remaining: 10,
          traffic_checks_remaining: 10,
          backlink_checks_remaining: 10,
          backlink_views_remaining: 50,
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后重置
        });

      if (quotaError) {
        console.error('Error creating user quota:', quotaError);
      }
    } else {
      // 更新现有用户信息
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: user.user_metadata?.full_name || existingUser.name,
          avatar_url: user.user_metadata?.avatar_url || existingUser.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
      }
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

## 9. 数据库更新

### 9.1 用户表结构更新

```sql
-- 更新用户表，添加 Google OAuth 支持
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS provider_id TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider_id);

-- 更新现有用户的 provider 字段
UPDATE users SET provider = 'email' WHERE provider IS NULL;
```

### 9.2 RLS 策略更新

```sql
-- 用户表的行级安全策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 用户只能查看和更新自己的记录
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 允许插入新用户（用于 OAuth 注册）
CREATE POLICY "Allow user creation" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
```

## 10. 安全考虑

### 10.1 CSRF 保护

```typescript
// src/middleware/csrf.ts
import type { MiddlewareResponseHandler } from 'astro';

export const onRequest: MiddlewareResponseHandler = async (context, next) => {
  const { request } = context;
  
  // 检查 Origin 和 Referer 头
  if (request.method === 'POST') {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const allowedOrigins = [
      'http://localhost:4321',
      'https://your-domain.com'
    ];
    
    if (!origin || !allowedOrigins.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }
  }
  
  return next();
};
```

### 10.2 会话安全

```typescript
// src/lib/security.ts
import { supabase } from './supabase';

// 验证会话有效性
export const validateSession = async (sessionToken: string) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
    
    if (error || !user) {
      return null;
    }
    
    // 检查会话是否过期
    const now = new Date();
    const sessionExpiry = new Date(user.last_sign_in_at);
    sessionExpiry.setHours(sessionExpiry.getHours() + 24); // 24小时过期
    
    if (now > sessionExpiry) {
      await supabase.auth.signOut();
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
};

// 刷新访问令牌
export const refreshAccessToken = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Token refresh error:', error);
      return null;
    }
    
    return data.session;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
};
```

## 11. 测试和调试

### 11.1 本地测试配置

```bash
# 启动开发服务器
pnpm dev

# 测试 Google OAuth 流程:
# 1. 访问 http://localhost:4321/auth/login
# 2. 点击 "使用 Google 登录" 按钮
# 3. 完成 Google 授权
# 4. 验证重定向到 /auth/callback
# 5. 确认最终重定向到 /dashboard
```

### 11.2 调试工具

```typescript
// src/lib/debug.ts
export const debugAuth = {
  logSession: (session: any) => {
    if (import.meta.env.DEV) {
      console.log('Current session:', {
        user: session?.user?.email,
        provider: session?.user?.app_metadata?.provider,
        expires_at: session?.expires_at,
      });
    }
  },
  
  logError: (error: any, context: string) => {
    if (import.meta.env.DEV) {
      console.error(`[${context}] Error:`, error);
    }
  },
};
```

## 12. 部署配置

### 12.1 Vercel 环境变量

```bash
# 在 Vercel Dashboard 中设置环境变量:
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 12.2 生产环境配置

```typescript
// astro.config.mjs - 生产环境配置
export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true },
    speedInsights: { enabled: true },
  }),
  security: {
    checkOrigin: true,
  },
});
```

## 13. 监控和分析

### 13.1 认证事件跟踪

```typescript
// src/lib/analytics.ts
export const trackAuthEvent = (event: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, {
      event_category: 'Authentication',
      ...properties,
    });
  }
};

// 使用示例
trackAuthEvent('google_signin_attempt');
trackAuthEvent('google_signin_success', { provider: 'google' });
trackAuthEvent('google_signin_error', { error: 'access_denied' });
```

## 14. 故障排除

### 14.1 常见问题

1. **重定向 URI 不匹配**
   - 检查 Google Cloud Console 中的授权重定向 URI
   - 确保开发和生产环境的 URI 都已添加

2. **Supabase 配置错误**
   - 验证 Supabase 项目 URL 和密钥
   - 检查 Google 提供商是否已启用

3. **CORS 错误**
   - 确保 Supabase 项目设置中的站点 URL 正确
   - 检查重定向 URL 配置

4. **会话持久化问题**
   - 检查浏览器是否阻止第三方 Cookie
   - 验证 Supabase 客户端配置

### 14.2 错误处理

```typescript
// src/lib/error-handler.ts
export const handleAuthError = (error: any) => {
  const errorMap = {
    'access_denied': '用户拒绝了授权请求',
    'invalid_request': '请求参数无效',
    'unauthorized_client': '客户端未授权',
    'unsupported_response_type': '不支持的响应类型',
    'invalid_scope': '请求的权限范围无效',
    'server_error': '服务器内部错误',
    'temporarily_unavailable': '服务暂时不可用',
  };
  
  const message = errorMap[error.error] || '登录过程中出现未知错误';
  
  return {
    error: error.error || 'unknown_error',
    message,
    details: error.error_description,
  };
};
```

## 15. 总结

本指南提供了为 BacklinksBuilder 项目集成 Google OAuth 登录的完整解决方案。主要特点包括：

- **无缝集成**: 与现有 Supabase 认证系统完美结合
- **用户体验**: 一键 Google 登录，简化注册流程
- **安全性**: 遵循 OAuth 2.0 标准，实施多层安全措施
- **可维护性**: 模块化设计，易于扩展和维护
- **响应式**: 支持所有设备和浏览器

按照本指南的步骤，您可以成功为项目添加 Google OAuth 登录功能，提升用户体验并增加用户转化率。