import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Google OAuth登录
 * @param redirectTo 登录成功后的最终重定向URL（将作为URL参数传递）
 */
export async function signInWithGoogle(redirectTo?: string) {
  try {
    // 构建回调URL，将最终重定向目标作为参数传递
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
    if (redirectTo) {
      callbackUrl.searchParams.set('redirect_to', redirectTo);
    }
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
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
 * @param options 登出选项
 */
export async function signOut(options = { retries: 2, timeout: 10000 }) {
  console.log('=== 开始执行signOut函数 ===');
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= options.retries + 1; attempt++) {
    try {
      console.log(`登出尝试 ${attempt}/${options.retries + 1}`);
      
      // 获取当前会话信息
      const currentSession = await getCurrentSession();
      console.log('当前会话状态:', currentSession ? '已登录' : '未登录');
      console.log('当前用户:', currentSession?.user?.email);
      
      if (!currentSession) {
        console.log('没有活跃会话，无需登出');
        return { success: true, message: '没有活跃会话' };
      }
      
      console.log('调用supabase.auth.signOut()...');
      
      // 使用Promise.race实现超时控制
      const signOutPromise = supabase.auth.signOut({ scope: 'global' });
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) => {
        setTimeout(() => reject(new Error('登出请求超时')), options.timeout);
      });
      
      const result = await Promise.race([signOutPromise, timeoutPromise]) as any;
      const { error } = result;
      
      if (error) {
        console.error('=== Supabase登出错误 ===');
        console.error('错误代码:', error.status);
        console.error('错误消息:', error.message);
        console.error('错误详情:', error);
        
        // 如果是网络错误且还有重试次数，继续重试
        if (attempt <= options.retries && (error.message?.includes('network') || error.message?.includes('fetch'))) {
          lastError = error;
          console.log(`网络错误，${2000 * attempt}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        
        throw error;
      }
      
      console.log('=== Supabase登出成功 ===');
      
      // 验证登出是否成功
      const sessionAfterLogout = await getCurrentSession();
      console.log('登出后会话状态:', sessionAfterLogout ? '仍有会话' : '会话已清除');
      
      console.log('=== signOut函数执行完成 ===');
      return { success: true, message: '登出成功' };
      
    } catch (error) {
      lastError = error;
      console.error(`=== 登出尝试 ${attempt} 失败 ===`);
      console.error('错误类型:', error.constructor.name);
      console.error('错误消息:', error.message);
      
      // 如果还有重试次数且是可重试的错误
      if (attempt <= options.retries && isRetryableError(error)) {
        console.log(`${2000 * attempt}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      
      // 最后一次尝试失败，抛出错误
      if (attempt === options.retries + 1) {
        console.error('=== 所有登出尝试均失败 ===');
        throw lastError;
      }
    }
  }
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: any): boolean {
  const retryableMessages = [
    'network',
    'fetch',
    'timeout',
    'connection',
    'ECONNRESET',
    'ETIMEDOUT'
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * 获取当前用户
 * @param options 获取选项
 */
export async function getCurrentUser(options = { retries: 1, timeout: 5000 }): Promise<User | null> {
  let lastError = null;
  
  for (let attempt = 1; attempt <= options.retries + 1; attempt++) {
    try {
      console.log(`获取用户信息尝试 ${attempt}/${options.retries + 1}`);
      
      // 使用超时控制
      const getUserPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise<{ data: { user: any }, error: Error }>((_, reject) => {
        setTimeout(() => reject(new Error('获取用户信息超时')), options.timeout);
      });
      
      const result = await Promise.race([getUserPromise, timeoutPromise]) as any;
      const { data: { user }, error } = result;
      
      if (error) {
        console.error('获取用户信息错误:', error.message);
        
        // 如果是可重试的错误且还有重试次数
        if (attempt <= options.retries && isRetryableError(error)) {
          lastError = error;
          console.log(`${1000 * attempt}ms后重试获取用户信息...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        return null;
      }
      
      console.log('用户信息获取成功:', user?.email || '无邮箱');
      return user;
      
    } catch (error) {
      lastError = error;
      console.error(`获取用户信息尝试 ${attempt} 失败:`, error.message);
      
      // 如果还有重试次数且是可重试的错误
      if (attempt <= options.retries && isRetryableError(error)) {
        console.log(`${1000 * attempt}ms后重试获取用户信息...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      // 最后一次尝试失败
      if (attempt === options.retries + 1) {
        console.error('所有获取用户信息尝试均失败:', lastError?.message);
        return null;
      }
    }
  }
  
  return null;
}

/**
 * 获取当前会话
 * @param options 获取选项
 */
export async function getCurrentSession(options = { retries: 1, timeout: 5000 }) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= options.retries + 1; attempt++) {
    try {
      console.log(`获取会话尝试 ${attempt}/${options.retries + 1}`);
      
      // 使用超时控制
      const getSessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<{ data: { session: any }, error: Error }>((_, reject) => {
        setTimeout(() => reject(new Error('获取会话超时')), options.timeout);
      });
      
      const result = await Promise.race([getSessionPromise, timeoutPromise]) as any;
      const { data: { session }, error } = result;
      
      if (error) {
        console.error('获取会话错误:', error.message);
        
        // 如果是可重试的错误且还有重试次数
        if (attempt <= options.retries && isRetryableError(error)) {
          lastError = error;
          console.log(`${1000 * attempt}ms后重试获取会话...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        return null;
      }
      
      console.log('会话获取成功:', session ? `用户: ${session.user?.email}` : '无会话');
      return session;
      
    } catch (error) {
      lastError = error;
      console.error(`获取会话尝试 ${attempt} 失败:`, error.message);
      
      // 如果还有重试次数且是可重试的错误
      if (attempt <= options.retries && isRetryableError(error)) {
        console.log(`${1000 * attempt}ms后重试获取会话...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      // 最后一次尝试失败
      if (attempt === options.retries + 1) {
        console.error('所有获取会话尝试均失败:', lastError?.message);
        return null;
      }
    }
  }
  
  return null;
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