import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async () => {
  try {
    // 查询特定用户的数据
    const { data: specificUsers, error: specificError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        provider,
        created_at,
        user_roles!user_roles_user_id_fkey (
          role,
          granted_at,
          granted_by
        )
      `)
      .in('email', ['wangpangzier@gmail.com', 'wangdefou404@gmail.com']);

    if (specificError) {
      console.error('Error fetching specific users:', specificError);
    }

    // 查询所有用户的角色分配
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select(`
        email,
        role,
        user_roles!user_roles_user_id_fkey (
          role
        )
      `);

    if (allError) {
      console.error('Error fetching all users:', allError);
    }

    return new Response(JSON.stringify({
      specificUsers: specificUsers || [],
      allUsers: allUsers || [],
      errors: {
        specificError: specificError?.message,
        allError: allError?.message
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};