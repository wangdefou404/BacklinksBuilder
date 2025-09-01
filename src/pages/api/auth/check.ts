import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

// 获取用户角色的辅助函数
async function getUserRole(userId: string): Promise<string> {
  try {
    const { data: role, error } = await supabaseAdmin
      .rpc('get_user_role', {
        user_id_param: userId
      });
    
    if (error) {
      console.error('获取用户角色失败:', error);
      return 'free';
    }
    
    return role || 'free';
  } catch (error) {
    console.error('获取用户角色时出错:', error);
    return 'free';
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    // 从cookie中获取认证信息
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return new Response(JSON.stringify({ error: 'No cookies found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🍪 Auth check cookies:', cookies);

    // 首先检查自定义session cookie
    const sessionMatch = cookies.match(/session=([^;]+)/);
    if (sessionMatch) {
      try {
        // 尝试多种解码方式
        let sessionData;
        let sessionValue = sessionMatch[1];
        
        console.log('🔍 检查自定义session cookie:', sessionValue);
        
        // 方法1: 直接解析
        try {
          sessionData = JSON.parse(sessionValue);
        } catch (e) {
          // 方法2: 单次URL解码
          try {
            sessionValue = decodeURIComponent(sessionMatch[1]);
            sessionData = JSON.parse(sessionValue);
          } catch (e2) {
            // 方法3: 双重URL解码
            sessionValue = decodeURIComponent(decodeURIComponent(sessionMatch[1]));
            sessionData = JSON.parse(sessionValue);
          }
        }
        
        if (sessionData && sessionData.userId && sessionData.email) {
          // 获取用户角色
          const userRole = await getUserRole(sessionData.userId);
          
          const user = {
            id: sessionData.userId,
            email: sessionData.email,
            role: userRole,
            user_metadata: {
              full_name: sessionData.name,
              avatar_url: sessionData.avatar_url
            }
          };
          
          console.log('✅ 自定义session认证成功:', sessionData.email);
          
          return new Response(JSON.stringify({ 
            user,
            session: {
              user,
              access_token: 'custom-session'
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (parseError) {
        console.warn('⚠️ 解析自定义session cookie失败:', parseError.message);
      }
    }

    // 如果没有自定义session，检查Supabase cookies
    const accessTokenMatch = cookies.match(/sb-access-token=([^;]+)/);
    const refreshTokenMatch = cookies.match(/sb-refresh-token=([^;]+)/);

    if (!accessTokenMatch || !refreshTokenMatch) {
      return new Response(JSON.stringify({ error: 'Authentication tokens not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accessToken = decodeURIComponent(accessTokenMatch[1]);
    const refreshToken = decodeURIComponent(refreshTokenMatch[1]);

    // 验证access token
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      // 如果access token无效，尝试使用refresh token刷新
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (refreshError || !refreshData.session) {
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 获取用户角色
      const userRole = await getUserRole(refreshData.user!.id);
      
      // 更新cookies
      const response = new Response(JSON.stringify({ 
        user: {
          ...refreshData.user,
          role: userRole
        },
        session: refreshData.session 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      // 设置新的cookies
      response.headers.append('Set-Cookie', `sb-access-token=${encodeURIComponent(refreshData.session.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`);
      response.headers.append('Set-Cookie', `sb-refresh-token=${encodeURIComponent(refreshData.session.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);

      return response;
    }

    // 获取用户角色
    const userRole = await getUserRole(user.id);
    
    // 返回用户信息
    return new Response(JSON.stringify({ 
      user: {
        ...user,
        role: userRole
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Auth check error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};