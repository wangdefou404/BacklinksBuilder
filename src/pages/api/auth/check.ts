import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    console.log('=== 认证检查开始 ===');
    
    // 从 cookies 中获取访问令牌
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    
    console.log('Access token exists:', !!accessToken);
    console.log('Refresh token exists:', !!refreshToken);
    console.log('Access token length:', accessToken?.length || 0);
    console.log('Refresh token length:', refreshToken?.length || 0);

    if (!accessToken) {
      console.log('认证失败: 未找到 access token');
      return new Response(
        JSON.stringify({ error: 'No access token found', authenticated: false }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 验证访问令牌
    console.log('验证 access token...');
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      console.log('Access token 验证失败:', error?.message);
      // 如果访问令牌无效，尝试使用刷新令牌
      if (refreshToken) {
        console.log('尝试使用 refresh token 刷新会话...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });

        if (refreshError || !refreshData.user) {
          console.log('Refresh token 也无效:', refreshError?.message);
          return new Response(
            JSON.stringify({ error: 'Invalid or expired tokens', authenticated: false }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }
        
        console.log('会话刷新成功，用户:', refreshData.user.email);

        // 检测是否为本地开发环境
        const isLocalhost = request.url.includes('localhost') || request.url.includes('127.0.0.1');
        console.log('API环境检测:', { url: request.url, isLocalhost });
        
        // 更新 cookies
        cookies.set('sb-access-token', refreshData.session?.access_token || '', {
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          httpOnly: false, // 允许前端JavaScript读取
          secure: !isLocalhost, // 本地环境不使用secure
          sameSite: 'lax',
        });

        cookies.set('sb-refresh-token', refreshData.session?.refresh_token || '', {
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          httpOnly: false, // 允许前端JavaScript读取
          secure: !isLocalhost, // 本地环境不使用secure
          sameSite: 'lax',
        });
        
        console.log('API cookies 更新完成，secure设置:', !isLocalhost);

        return new Response(
          JSON.stringify({ 
            user: refreshData.user,
            authenticated: true 
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      console.log('认证失败: 没有 refresh token');
      return new Response(
        JSON.stringify({ error: 'User not authenticated', authenticated: false }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('认证成功，用户:', user.email);
    return new Response(
      JSON.stringify({ 
        user,
        authenticated: true 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Auth check error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};