import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // 处理用户拒绝授权的情况
  if (error) {
    console.error('Google OAuth error:', error);
    return redirect('/login?error=access_denied');
  }

  if (!code) {
    return redirect('/login?error=no_code');
  }

  const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = import.meta.env.GOOGLE_CLIENT_SECRET;
  const SITE_URL = import.meta.env.SITE_URL || 'http://localhost:4321';

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Google OAuth credentials not configured');
    return redirect('/login?error=config_error');
  }

  try {
    // 交换授权码获取访问令牌
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${SITE_URL}/api/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 使用访问令牌获取用户信息
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userData = await userResponse.json();
    
    // 检查用户是否已存在
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', userData.email)
      .single();

    let user;
    if (existingUser) {
      // 更新现有用户信息
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          name: userData.name,
          avatar_url: userData.picture,
          last_login: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }
      user = updatedUser;
    } else {
      // 创建新用户
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: userData.email,
          name: userData.name,
          avatar_url: userData.picture,
          role: 'free',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .select()
        .single();

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

    // 设置会话 cookie
    cookies.set('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    });

    // 重定向到用户仪表板
    return redirect('/user/dashboard');
  } catch (error) {
    console.error('Authentication error:', error);
    return redirect('/login?error=auth_failed');
  }
};