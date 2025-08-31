import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, redirect }) => {
  try {
    console.log('=== Google OAuth登录请求 ===');
    
    const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID;
    const SITE_URL = import.meta.env.SITE_URL || import.meta.env.PUBLIC_SITE_URL || import.meta.env.NEXTAUTH_URL || 'http://localhost:4321';
    
    console.log('环境变量检查:', {
      GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'MISSING',
      SITE_URL,
      NEXTAUTH_URL: import.meta.env.NEXTAUTH_URL,
      PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL
    });
    
    if (!GOOGLE_CLIENT_ID) {
      console.error('Google OAuth凭据未配置');
      return new Response('Google OAuth凭据未配置', { status: 500 });
    }
    
    console.log('GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID?.substring(0, 20) + '...');
    console.log('SITE_URL:', SITE_URL);
    
    // 生成state参数用于安全验证
    const state = crypto.randomUUID();
    
    // 构建回调URL
    const redirectUri = `${SITE_URL}/auth/callback`;
    console.log('Redirect URI:', redirectUri);
    
    // 构建Google OAuth URL，使用更稳定的参数配置
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('include_granted_scopes', 'true');
    
    console.log('Google OAuth URL:', googleAuthUrl.toString());
    
    // 设置state到cookie中用于验证，增加安全性
    const response = redirect(googleAuthUrl.toString());
    response.headers.set('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure=${SITE_URL.startsWith('https')}; Max-Age=600`);
    
    return response;
    
  } catch (error) {
    console.error('Google OAuth登录错误:', error);
    console.error('错误堆栈:', error.stack);
    return new Response(`登录失败: ${error.message}`, { status: 500 });
  }
};