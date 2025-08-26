import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Google OAuth登录
 * @param redirectTo 登录成功后的重定向URL
 */
export async function signInWithGoogle(redirectTo?: string) {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google登录错误:', error.message);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Google登录失败:', error);
    throw error;
  }
}

/**
 * 用户登出
 */
export async function signOut() {
  console.log('=== 开始执行signOut函数 ===');
  
  try {
    // 获取当前会话信息
    const currentSession = await getCurrentSession();
    console.log('当前会话状态:', currentSession ? '已登录' : '未登录');
    console.log('当前用户:', currentSession?.user?.email);
    
    console.log('调用supabase.auth.signOut()...');
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    
    if (error) {
      console.error('=== Supabase登出错误 ===');
      console.error('错误代码:', error.status);
      console.error('错误消息:', error.message);
      console.error('错误详情:', error);
      throw error;
    }
    
    console.log('=== Supabase登出成功 ===');
    
    // 验证登出是否成功
    const sessionAfterLogout = await getCurrentSession();
    console.log('登出后会话状态:', sessionAfterLogout ? '仍有会话' : '会话已清除');
    
    console.log('=== signOut函数执行完成 ===');
  } catch (error) {
    console.error('=== signOut函数执行失败 ===');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误详情:', error);
    throw error;
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('获取用户信息错误:', error.message);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

/**
 * 获取当前会话
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('获取会话错误:', error.message);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('获取会话失败:', error);
    return null;
  }
}

/**
 * 监听认证状态变化
 * @param callback 状态变化回调函数
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('认证状态变化:', event, session?.user?.email);
    callback(session?.user || null);
  });
}

/**
 * 检查用户是否已登录
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return !!session?.user;
}

/**
 * 同步用户数据到数据库
 * @param user Supabase用户对象
 */
export async function syncUserToDatabase(user: User) {
  try {
    const response = await fetch('/api/auth/sync-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await getCurrentSession())?.access_token}`,
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        provider: 'google',
      }),
    });

    if (!response.ok) {
      throw new Error(`同步用户数据失败: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('用户数据同步成功:', result);
    return result;
  } catch (error) {
    console.error('同步用户数据失败:', error);
    throw error;
  }
}