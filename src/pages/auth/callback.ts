import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

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
    'the operation was aborted', 'request aborted'
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
  
  // 特殊处理Google OAuth相关错误
  const isGoogleOAuthError = errorMessage.includes('google') || 
                            errorMessage.includes('oauth') ||
                            errorMessage.includes('accounts.google.com');
  
  // 如果是Google OAuth相关的网络错误，也应该重试
  if (isGoogleOAuthError && (hasRetryableError || hasRetryableStatus)) {
    return true;
  }
  
  return hasRetryableError || hasRetryableStatus;
}

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  console.log('=== OAuth回调处理开始 ===');
  console.log('完整回调URL:', url.toString());
  console.log('URL参数:', Object.fromEntries(url.searchParams.entries()));
  console.log('请求URL:', url.toString());
  
  const maxRetries = 3;
  const baseDelay = 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
  
      console.log(`OAuth回调处理尝试 ${attempt}/${maxRetries}`);
      
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const redirectTo = url.searchParams.get('redirect_to') || '/dashboard';
      
      console.log('回调参数:', { code: code ? '存在' : '不存在', state, error, redirectTo });
      
      // 检查必需的环境变量（移到前面以确保siteUrl可用）
      const clientId = import.meta.env.GOOGLE_CLIENT_ID;
      const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
      // 优先使用生产环境URL，确保在Vercel部署时使用正确的域名
      // 在生产环境中，优先使用SITE_URL，在开发环境中使用NEXTAUTH_URL
      const isProduction = import.meta.env.NODE_ENV === 'production' || import.meta.env.PROD;
      const siteUrl = isProduction 
        ? (import.meta.env.SITE_URL || import.meta.env.PUBLIC_SITE_URL || 'https://backlinksbuilder.net')
        : (import.meta.env.NEXTAUTH_URL || import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321');
      
      console.log('环境变量检查:', {
        clientId: clientId ? `${clientId.substring(0, 10)}...` : 'MISSING',
        clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'MISSING',
        siteUrl,
        allEnvVars: Object.keys(import.meta.env).filter(key => key.includes('GOOGLE') || key.includes('SITE'))
      });
      
      if (!clientId || !clientSecret) {
        console.error('Google OAuth配置缺失:', { clientId: !!clientId, clientSecret: !!clientSecret });
        return redirect('/login?error=config_missing');
      }
      
      // 检查是否有错误参数
      if (error) {
        console.error('OAuth错误:', error);
        const errorDescription = url.searchParams.get('error_description');
        console.error('错误描述:', errorDescription);
        
        if (error === 'access_denied') {
          console.log('用户拒绝授权，重定向到登录页');
          return redirect('/login?error=access_denied&message=' + encodeURIComponent('用户取消了Google登录授权'));
        }
        
        return redirect('/login?error=oauth_error&message=' + encodeURIComponent(errorDescription || '登录过程中发生错误'));
      }
      
      // 检查授权码
      if (!code) {
        console.error('缺少授权码');
        return redirect('/login?error=missing_code&message=' + encodeURIComponent('登录过程中缺少授权码'));
      }

  if (!state) {
    console.error('No state parameter received from Google');
    return redirect('/login?error=invalid_state&message=' + encodeURIComponent('缺少状态参数'));
  }

  // 验证状态参数
  const storedState = cookies.get('oauth_state')?.value;
  console.log('状态参数验证:', { receivedState: state, storedState });
  
  if (!storedState) {
    console.error('No stored state found in cookies');
    return redirect('/login?error=invalid_state&message=' + encodeURIComponent('状态验证失败：未找到存储的状态'));
  }
  
  if (state !== storedState) {
    console.error('State parameter mismatch:', { received: state, stored: storedState });
    return redirect('/login?error=invalid_state&message=' + encodeURIComponent('状态验证失败：参数不匹配'));
  }
  
  // 清除状态cookie，使用与设置时相同的domain配置
  // 使用与前面相同的isProduction判断逻辑
  let domain = '';
  try {
    const siteUrlObj = new URL(siteUrl);
    domain = siteUrlObj.hostname;
    if (isProduction && !domain.includes('localhost')) {
      domain = domain.startsWith('www.') ? domain.substring(4) : domain;
    } else {
      domain = '';
    }
  } catch (e) {
    console.warn('无法解析siteUrl，使用默认domain设置:', e);
    domain = '';
  }
  
  const deleteOptions: any = { path: '/' };
  if (domain && isProduction) {
    deleteOptions.domain = domain;
  }
  
  cookies.delete('oauth_state', deleteOptions);
  console.log('状态参数验证成功，已清除状态cookie', { domain, deleteOptions });

  try {
      // 使用授权码交换访问令牌（带超时控制和重试机制）
      console.log('开始交换访问令牌...');
      console.log('令牌交换请求参数:', {
        code: code ? `${code.substring(0, 10)}...` : 'MISSING',
        client_id: clientId ? `${clientId.substring(0, 10)}...` : 'MISSING',
        redirect_uri: `${siteUrl}/auth/callback`
      });
      
      let tokenResponse: Response;
      let tokenAttempts = 0;
      const maxTokenAttempts = 3;
      
      while (tokenAttempts < maxTokenAttempts) {
        try {
          tokenAttempts++;
          console.log(`令牌交换尝试 ${tokenAttempts}/${maxTokenAttempts}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          
          tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'BacklinksBuilder/1.0'
            },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: `${siteUrl}/auth/callback`,
              grant_type: 'authorization_code',
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          break; // 成功则跳出循环
          
        } catch (error) {
          console.error(`令牌交换尝试 ${tokenAttempts} 失败:`, error);
          
          if (tokenAttempts >= maxTokenAttempts || !isRetryableError(error)) {
            throw error;
          }
          
          const delay = Math.min(1000 * tokenAttempts, 5000);
          console.log(`${delay}ms后重试令牌交换...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('令牌交换失败:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          headers: Object.fromEntries(tokenResponse.headers.entries()),
          error: errorText
        });
        throw new Error(`Token exchange failed: ${tokenResponse.status}`);
      }

      const tokenData: { 
        access_token: string;
        token_type?: string;
        expires_in?: number;
      } = await tokenResponse.json();
      console.log('令牌交换成功:', {
        hasAccessToken: !!tokenData.access_token,
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in
      });

      if (!tokenData.access_token) {
        console.error('访问令牌缺失:', tokenData);
        throw new Error('Access token missing from response');
      }

      const accessToken = tokenData.access_token;

      // 使用访问令牌获取用户信息（带超时控制和重试机制）
      console.log('开始获取用户信息...');
      
      let userResponse: Response;
      let userInfoAttempts = 0;
      const maxUserInfoAttempts = 3;
      
      while (userInfoAttempts < maxUserInfoAttempts) {
        try {
          userInfoAttempts++;
          console.log(`用户信息获取尝试 ${userInfoAttempts}/${maxUserInfoAttempts}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'BacklinksBuilder/1.0'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          break; // 成功则跳出循环
          
        } catch (error) {
          console.error(`用户信息获取尝试 ${userInfoAttempts} 失败:`, error);
          
          if (userInfoAttempts >= maxUserInfoAttempts || !isRetryableError(error)) {
            throw error;
          }
          
          const delay = Math.min(1000 * userInfoAttempts, 5000);
          console.log(`${delay}ms后重试用户信息获取...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('用户信息获取失败:', {
          status: userResponse.status,
          statusText: userResponse.statusText,
          headers: Object.fromEntries(userResponse.headers.entries()),
          error: errorText
        });
        throw new Error(`Failed to fetch user info: ${userResponse.status}`);
      }

      const userData: {
        id: string;
        email: string;
        name: string;
        picture: string;
        verified_email?: boolean;
      } = await userResponse.json();
      console.log('用户信息获取成功:', {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        verified_email: userData.verified_email
      });
    
    // 检查用户是否已存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', userData.email)
      .single();

    let user: any;
    if (existingUser) {
      // 更新现有用户信息
      console.log('更新现有用户:', existingUser.id);
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          name: userData.name,
          avatar_url: userData.picture,
          last_login: new Date().toISOString(),
          provider: 'google',
          google_id: userData.id
        })
        .eq('id', existingUser.id)
        .select()
        .single();
        
      console.log('用户更新结果:', { updatedUser, updateError });

      if (updateError) {
        throw updateError;
      }
      user = updatedUser;
    } else {
      // 创建新用户
      console.log('创建新用户:', userData.email);
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: userData.email,
          name: userData.name,
          full_name: userData.name,
          avatar_url: userData.picture,
          role: 'user',
          provider: 'google',
          google_id: userData.id,
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .select()
        .single();
        
      console.log('用户创建结果:', { newUser, createError });

      if (createError) {
        throw createError;
      }
      user = newUser;

      // 为新用户初始化配额
      const { error: quotaError } = await supabase
        .rpc('initialize_user_quotas', { user_id: user.id, plan_type: 'free' });

      if (quotaError) {
        console.error('Failed to initialize user quotas:', quotaError);
      }
    }

    // 生成 JWT 令牌或设置会话
    const sessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar_url: user.avatar_url,
    };

    // 设置会话 cookie，使用一致的domain配置
    const cookieOptions: any = {
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    };
    
    // 在生产环境中设置domain
    if (domain && isProduction) {
      cookieOptions.domain = domain;
    }
    
    cookies.set('session', JSON.stringify(sessionData), {
      ...cookieOptions,
      httpOnly: true,
    });

    // 同时设置用户角色cookie，供前端使用
    cookies.set('user_role', user.role, {
      ...cookieOptions,
      httpOnly: false, // 前端需要访问
    });

    // 设置用户信息cookie，供前端AuthStatus组件使用
    const userInfo = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role
    };
    
    cookies.set('user_info', JSON.stringify(userInfo), {
      ...cookieOptions,
      httpOnly: false, // 前端需要访问
    });
    
    console.log('设置会话Cookie:', { domain, cookieOptions, isProduction });

    // 重定向到用户仪表板
    return redirect(redirectTo);
    } catch (error) {
       console.error(`OAuth回调处理失败 (尝试 ${attempt}/${maxRetries}):`, error);
       
       // 检查是否为可重试的错误
       const isRetryable = isRetryableError(error);
       console.log('错误是否可重试:', isRetryable);
       
       if (attempt === maxRetries || !isRetryable) {
         // 最后一次尝试失败或不可重试的错误，返回错误
         let errorParam = 'auth_failed';
         if (error instanceof Error) {
           if (error.message.includes('Token exchange') || error.message.includes('timeout')) {
             errorParam = 'token_exchange_failed';
           } else if (error.message.includes('User info')) {
             errorParam = 'user_info_failed';
           } else if (error.message.includes('Database')) {
             errorParam = 'database_error';
           } else if (error.message.includes('abort') || error.message.includes('ERR_ABORTED')) {
             errorParam = 'network_error';
           }
         }
         
         return redirect(`/login?error=${errorParam}&message=` + encodeURIComponent('登录过程中发生错误，请重试'));
       }
       
       // 等待后重试
       const delay = baseDelay * Math.pow(2, attempt - 1);
       console.log(`网络错误，等待 ${delay}ms 后重试...`);
       await new Promise(resolve => setTimeout(resolve, delay));
     }
  }
};