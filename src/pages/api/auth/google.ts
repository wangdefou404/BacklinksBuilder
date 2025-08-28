import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ redirect }) => {
  const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID;
  const SITE_URL = import.meta.env.SITE_URL || 'http://localhost:4321';
  
  if (!GOOGLE_CLIENT_ID) {
    return new Response(
      JSON.stringify({ error: 'Google Client ID not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 构建 Google OAuth URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', `${SITE_URL}/auth/callback`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  // 生成并存储 state 参数用于安全验证
  const state = crypto.randomUUID();
  
  // 在实际应用中，你可能需要将 state 存储在会话或数据库中
  // 这里为了简化，我们将其作为查询参数传递
  googleAuthUrl.searchParams.set('state', state);

  return redirect(googleAuthUrl.toString());
};