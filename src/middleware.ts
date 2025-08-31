import { defineMiddleware } from 'astro:middleware';
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

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    // 初始化为null
    context.locals.user = null;
    context.locals.session = null;
    
    // 获取所有cookies
    const cookies = context.request.headers.get('cookie');
    if (!cookies) {
      return next();
    }
    
    console.log('🍪 Cookies received:', cookies);
    
    // 首先检查自定义session cookie
    const sessionMatch = cookies.match(/session=([^;]+)/);
    if (sessionMatch) {
      try {
        // 尝试多种解码方式
        let sessionData;
        let sessionValue = sessionMatch[1];
        
        console.log('🔍 原始session值:', sessionValue);
        
        // 方法1: 直接解析
        try {
          sessionData = JSON.parse(sessionValue);
          console.log('✅ 直接解析成功');
        } catch (e) {
          console.log('❌ 直接解析失败，尝试URL解码');
          
          // 方法2: 单次URL解码
          try {
            sessionValue = decodeURIComponent(sessionMatch[1]);
            console.log('🔧 单次解码后:', sessionValue);
            sessionData = JSON.parse(sessionValue);
            console.log('✅ 单次URL解码成功');
          } catch (e2) {
            console.log('❌ 单次URL解码失败，尝试双重URL解码');
            
            // 方法3: 双重URL解码
            try {
              sessionValue = decodeURIComponent(decodeURIComponent(sessionMatch[1]));
              console.log('🔧 双重解码后:', sessionValue);
              sessionData = JSON.parse(sessionValue);
              console.log('✅ 双重URL解码成功');
            } catch (e3) {
              console.log('❌ 所有解码方式都失败');
              throw new Error('无法解析session cookie');
            }
          }
        }
        
        console.log('📋 Session data found:', sessionData);
        
        if (sessionData && sessionData.userId && sessionData.email) {
          // 获取用户角色
          const userRole = await getUserRole(sessionData.userId);
          console.log('🎭 User role from database:', userRole);
          
          // 检查角色是否需要更新
          if (sessionData.role !== userRole) {
            console.log('🔄 Role mismatch detected. Cookie role:', sessionData.role, 'Database role:', userRole);
            
            // 更新session数据
            const updatedSessionData = {
              ...sessionData,
              role: userRole
            };
            
            // 设置更新后的cookie
            const updatedCookieValue = encodeURIComponent(JSON.stringify(updatedSessionData));
            context.cookies.set('session', updatedCookieValue, {
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7 // 7 days
            });
            
            console.log('✅ Session cookie updated with new role:', userRole);
          }
          
          // 设置用户信息到 Astro.locals
          context.locals.user = {
            id: sessionData.userId,
            email: sessionData.email,
            role: userRole,
            user_metadata: {
              full_name: sessionData.name,
              avatar_url: sessionData.avatar_url
            }
          };
          
          // 设置用户角色到 Astro.locals.userRole
          context.locals.userRole = userRole;
          
          // 创建session对象
          context.locals.session = {
            user: {
              id: sessionData.userId,
              email: sessionData.email,
              role: userRole,
              user_metadata: {
                full_name: sessionData.name,
                avatar_url: sessionData.avatar_url
              }
            },
            access_token: 'custom-session'
          };
          
          console.log('✅ User authenticated via custom session:', sessionData.email, 'Role:', userRole);
          return next();
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse custom session cookie:', parseError.message);
      }
    }
    
    // 如果没有自定义session，检查Supabase session cookie
    const supabasePattern = /sb-fmkekjlsfnvubnvurhbt-auth-token=([^;]+)/;
    const supabaseMatch = cookies.match(supabasePattern);
    
    if (supabaseMatch) {
      try {
        const cookieValue = decodeURIComponent(supabaseMatch[1]);
        const sessionData = JSON.parse(cookieValue);
        
        if (sessionData && sessionData.access_token && sessionData.user) {
          const { data: { user }, error } = await supabase.auth.getUser(sessionData.access_token);
          
          if (!error && user) {
            // 获取用户角色
            const userRole = await getUserRole(user.id);
            console.log('🎭 User role from database (Supabase):', userRole);
            
            context.locals.user = {
              id: user.id,
              email: user.email,
              role: userRole,
              user_metadata: user.user_metadata
            };
            
            // 设置用户角色到 Astro.locals.userRole
            context.locals.userRole = userRole;
            
            context.locals.session = {
              user: {
                id: user.id,
                email: user.email,
                role: userRole,
                user_metadata: user.user_metadata
              },
              access_token: sessionData.access_token,
              expires_at: sessionData.expires_at
            };
            
            console.log('✅ User authenticated via Supabase:', user.email, 'Role:', userRole);
          } else {
            console.log('❌ Supabase token validation failed:', error?.message);
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse Supabase session cookie:', parseError.message);
      }
    } else {
      console.log('🔍 No session cookies found');
    }
    
  } catch (error) {
    console.error('💥 Middleware error:', error);
    context.locals.user = null;
    context.locals.session = null;
  }
  
  return next();
});