import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// 创建Supabase服务端客户端（使用SERVICE_ROLE_KEY）
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 用户数据接口
interface SyncUserRequest {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  provider?: string;
}

export const POST: APIRoute = async ({ request }) => {
  let userData: SyncUserRequest | null = null;
  
  try {
    // 验证请求方法
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证Authorization头
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 提取访问令牌
    const accessToken = authHeader.replace('Bearer ', '');

    // 验证访问令牌
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.error('Token验证失败:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid access token' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 解析请求体
    try {
      userData = await request.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证必需字段
    if (!userData.id || !userData.email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: id and email' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证用户ID匹配
    if (userData.id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('开始同步用户数据:', userData.email);

    // 检查用户是否已存在
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userData.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('检查用户存在性失败:', checkError);
      throw checkError;
    }

    const now = new Date().toISOString();
    
    if (existingUser) {
      // 更新现有用户
      console.log('更新现有用户:', userData.email);
      
      const updateData: any = {
        email: userData.email,
        full_name: userData.full_name,
        avatar_url: userData.avatar_url,
        provider: userData.provider || 'google',
        updated_at: now
      };
      
      // 根据provider设置password_hash
      if (userData.provider === 'google' || userData.provider === 'github' || userData.provider === 'facebook') {
        updateData.password_hash = null; // OAuth用户password_hash必须为null
      }
      
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userData.id)
        .select()
        .single();

      if (updateError) {
        console.error('更新用户失败:', updateError);
        throw updateError;
      }

      console.log('用户更新成功:', updatedUser.email);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User updated successfully',
          user: updatedUser
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
    } else {
      // 创建新用户
      console.log('创建新用户:', userData.email);
      const insertData: any = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        avatar_url: userData.avatar_url,
        provider: userData.provider || 'google',
        created_at: now,
        updated_at: now
      };
      
      // 根据provider设置password_hash
      if (userData.provider === 'google' || userData.provider === 'github' || userData.provider === 'facebook') {
        insertData.password_hash = null; // OAuth用户password_hash必须为null
      }
      
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('创建用户失败:', insertError);
        throw insertError;
      }

      // 为新用户创建默认配额
      const { error: quotaError } = await supabaseAdmin
        .from('user_quotas')
        .insert({
          user_id: userData.id,
          dr_checks_used: 0,
          dr_checks_limit: 10, // 免费用户默认限制
          backlink_checks_used: 0,
          backlink_checks_limit: 5,
          traffic_checks_used: 0,
          traffic_checks_limit: 5,
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后重置
          created_at: now,
          updated_at: now
        });

      if (quotaError) {
        console.error('创建用户配额失败:', quotaError);
        // 不抛出错误，因为用户已创建成功
      }

      // 为新用户创建默认订阅
      const { error: subscriptionError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: userData.id,
          plan_type: 'free',
          status: 'active',
          current_period_start: now,
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1年后
          created_at: now,
          updated_at: now
        });

      if (subscriptionError) {
        console.error('创建用户订阅失败:', subscriptionError);
        // 不抛出错误，因为用户已创建成功
      }

      // 为新用户创建默认角色
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userData.id,
          role: 'free',
          is_active: true,
          granted_at: now,
          created_at: now,
          updated_at: now
        });

      if (roleError) {
        console.error('创建用户角色失败:', roleError);
        // 不抛出错误，因为用户已创建成功
      }

      console.log('新用户创建成功:', newUser.email);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User created successfully',
          user: newUser
        }),
        { 
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('用户同步API错误:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userData: userData ? { id: userData.id, email: userData.email } : 'No user data',
      timestamp: new Date().toISOString()
    });
    
    // 提供更详细的错误信息
    let errorMessage = 'Internal server error';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // 检查常见的数据库错误
      if (error.message.includes('foreign key constraint')) {
        errorDetails = 'Database foreign key constraint violation. Please check table relationships.';
      } else if (error.message.includes('duplicate key')) {
        errorDetails = 'User already exists with this email or ID.';
      } else if (error.message.includes('null value')) {
        errorDetails = 'Required field is missing or null.';
      } else if (error.message.includes('permission denied')) {
        errorDetails = 'Database permission denied. Please check RLS policies.';
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};