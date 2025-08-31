import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Google OAuth登录
 * @param redirectTo 登录成功后的最终重定向URL（将作为URL参数传递）
 * @param options 登录选项
 */
export async function signInWithGoogle(redirectTo?: string, options = { retries: 3, timeout: 20000 }) {
  console.log('=== 开始Google OAuth登录 ===');
  let lastError = null;
  
  // 预先清理可能存在的错误状态
  try {
    await clearAuthErrors();
  } catch (error) {
    console.warn('清理认证错误状态失败:', error);
  }
  
  for (let attempt = 1; attempt <= options.retries + 1; attempt++) {
    try {
      console.log(`OAuth登录尝试 ${attempt}/${options.retries + 1}`);
      
      // 构建OAuth URL，将最终重定向目标作为参数传递
      const oauthUrl = new URL(`${window.location.origin}/api/auth/google`);
      if (redirectTo) {
        oauthUrl.searchParams.set('redirect_to', redirectTo);
      }
      
      console.log('OAuth URL:', oauthUrl.toString());
      
      // 创建AbortController来处理超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, options.timeout);
      
      try {
        // 直接重定向到我们的OAuth端点
        window.location.href = oauthUrl.toString();
        
        clearTimeout(timeoutId);
        console.log('=== 重定向到Google OAuth ===');
        return { success: true };
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        // 特殊处理AbortError
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          console.warn('OAuth请求被中止，可能是超时导致');
          if (attempt <= options.retries) {
            const delay = Math.min(3000 * attempt, 15000);
            console.log(`${delay}ms后重试OAuth登录...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        throw error;
      }
      
    } catch (error) {
      lastError = error;
      console.error(`=== OAuth登录尝试 ${attempt} 失败 ===`);
      console.error('错误类型:', error.constructor.name);
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
      
      // 如果还有重试次数且是可重试的错误
      if (attempt <= options.retries && isRetryableError(error)) {
        const delay = Math.min(2000 * attempt, 10000);
        console.log(`${delay}ms后重试OAuth登录...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 最后一次尝试失败，抛出错误
      if (attempt === options.retries + 1) {
        console.error('=== 所有OAuth登录尝试均失败 ===');
        throw lastError;
      }
    }
  }
}

/**
 * 清理认证错误状态
 */
async function clearAuthErrors() {
  try {
    if (typeof window !== 'undefined') {
      // 清理可能存在的错误状态
      const errorKeys = Object.keys(localStorage).filter(key => 
        key.includes('error') || key.includes('auth_error')
      );
      errorKeys.forEach(key => localStorage.removeItem(key));
      
      // 清理URL中的错误参数
      const url = new URL(window.location.href);
      if (url.searchParams.has('error') || url.searchParams.has('error_description')) {
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        url.searchParams.delete('error_code');
        window.history.replaceState({}, document.title, url.toString());
      }
    }
  } catch (error) {
    console.warn('清理认证错误状态时出错:', error);
  }
}

/**
 * 登出
 * @param options 登出选项
 */
export async function signOut(options = { retries: 3, timeout: 8000 }) {
  console.log('=== 开始登出 ===');
  for (let attempt = 1; attempt <= options.retries; attempt++) {
    try {
      console.log(`登出尝试 ${attempt}/${options.retries}`);
      
      // 使用Promise.race实现超时控制
      const signOutPromise = supabase.auth.signOut({ scope: 'local' });
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) => {
        setTimeout(() => reject(new Error('登出请求超时')), options.timeout);
      });
      
      const result = await Promise.race([signOutPromise, timeoutPromise]) as any;
      const { error } = result;
      
      if (error) {
        console.error('=== 登出错误 ===');
        console.error('错误消息:', error.message);
        console.error('错误详情:', error);
        
        // 如果是网络错误且还有重试次数，继续重试
        if (attempt < options.retries && isRetryableError(error)) {
          console.log(`网络错误，${1000 * attempt}ms后重试登出...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        // 如果是最后一次尝试，强制清除本地状态
        if (attempt === options.retries) {
          console.warn('登出失败，强制清除本地状态');
          await forceLocalSignOut();
          return;
        }
        
        throw error;
      }
      
      console.log('=== 登出成功 ===');
      await forceLocalSignOut();
      return;
      
    } catch (error) {
      console.error(`=== 登出尝试 ${attempt} 失败 ===`);
      console.error('错误类型:', error.constructor.name);
      console.error('错误消息:', error.message);
      
      // 如果还有重试次数且是可重试的错误
      if (attempt < options.retries && isRetryableError(error)) {
        console.log(`${1000 * attempt}ms后重试登出...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      // 最后一次尝试失败，强制清除本地状态
      if (attempt === options.retries) {
        console.error('=== 所有登出尝试均失败，强制清除本地状态 ===');
        await forceLocalSignOut();
        return;
      }
    }
  }
}

/**
 * 强制清除本地登录状态
 */
async function forceLocalSignOut() {
  try {
    if (typeof window !== 'undefined') {
      // 清除所有相关的本地存储
      const keysToRemove = [
        'supabase.auth.token',
        'sb-' + window.location.hostname.replace(/\./g, '-') + '-auth-token'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // 清除所有以 'sb-' 开头的键
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
      
      console.log('本地登录状态已清除');
    }
  } catch (error) {
    console.error('清除本地状态时出错:', error);
  }
}

/**
 * 检查错误是否可重试
 * @param error 错误对象
 * @returns 是否可重试
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  const errorStatus = error.status || error.statusCode || 0;
  
  // 网络相关错误
  const networkErrors = [
    'network', 'fetch', 'timeout', 'abort', 'connection',
    'ERR_ABORTED', 'ERR_NETWORK', 'ERR_TIMEOUT', 'ERR_CONNECTION_REFUSED',
    'ERR_INTERNET_DISCONNECTED', 'ERR_NAME_NOT_RESOLVED', 'ERR_FAILED',
    'failed to fetch', 'network error', 'connection error',
    'request timeout', 'response timeout', 'load timeout',
    'aborterror', 'timeouterror', 'networkerror',
    'cors error', 'ssl error', 'certificate error',
    'dns error', 'proxy error', 'gateway timeout',
    'oauth请求超时', '登出请求超时', 'the operation was aborted',
    'request aborted', 'connection timeout', 'ECONNRESET', 'ETIMEDOUT'
  ];
  
  // HTTP状态码相关的可重试错误
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524];
  
  // 检查错误消息、名称、代码
  const hasRetryableError = networkErrors.some(errorType => 
    errorMessage.includes(errorType) || 
    errorName.includes(errorType) || 
    errorCode.includes(errorType)
  );
  
  // 检查HTTP状态码
  const hasRetryableStatus = retryableStatusCodes.includes(errorStatus);
  
  // 特殊处理：如果是DOMException且名称为AbortError
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  
  // 特殊处理：如果是TypeError且消息包含fetch相关内容
  if (error instanceof TypeError && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
    return true;
  }
  
  // 特殊处理Google OAuth相关错误
  const isGoogleOAuthError = errorMessage.includes('google') || 
                            errorMessage.includes('oauth') ||
                            errorMessage.includes('accounts.google.com');
  
  // 如果是Google OAuth相关的网络错误，也应该重试
  if (isGoogleOAuthError && (hasRetryableError || hasRetryableStatus)) {
    return true;
  }
  
  console.log('错误重试检查:', {
    isRetryable: hasRetryableError || hasRetryableStatus,
    errorName: errorName,
    errorMessage: errorMessage,
    errorCode: errorCode,
    errorStatus: errorStatus,
    errorType: error.constructor.name
  });
  
  return hasRetryableError || hasRetryableStatus;
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