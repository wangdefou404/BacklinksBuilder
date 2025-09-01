import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, role } = await request.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: email and role' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证角色是否有效
    const validRoles = ['admin', 'super', 'Pro', 'user', 'free'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid role. Valid roles are: ${validRoles.join(', ')}` 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 查找用户
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'User not found',
          details: userError?.message 
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 更新users表中的role字段
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ role: role })
      .eq('id', user.id);

    if (updateUserError) {
      console.error('Update user role error:', updateUserError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update user role in users table',
          details: updateUserError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 检查user_roles表中是否已存在该用户的角色记录
    const { data: existingRole, error: checkError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (existingRole) {
      // 更新现有角色
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ 
          role: role,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRole.id);

      if (updateError) {
        console.error('Update user role error:', updateError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update user role',
            details: updateError.message 
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      // 创建新的角色记录
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: role,
          is_active: true
        });

      if (insertError) {
        console.error('Insert user role error:', insertError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create user role',
            details: insertError.message 
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully set role '${role}' for user ${email}`,
        user: {
          id: user.id,
          email: user.email,
          role: role
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};