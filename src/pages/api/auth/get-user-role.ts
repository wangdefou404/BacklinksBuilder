import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const GET: APIRoute = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required query parameter: userId' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 调用数据库函数获取用户角色
    const { data: role, error: roleError } = await supabase
      .rpc('get_user_role', {
        user_id_param: userId
      });

    if (roleError) {
      console.error('Get user role error:', roleError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get user role',
          details: roleError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 获取用户角色详细信息
    const { data: roleDetails, error: detailsError } = await supabase
      .from('user_roles')
      .select(`
        id,
        role,
        granted_at,
        expires_at,
        is_active
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (detailsError && detailsError.code !== 'PGRST116') {
      console.error('Get role details error:', detailsError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get role details',
          details: detailsError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 获取角色权限列表
    const { data: permissions, error: permissionsError } = await supabase
      .from('role_permissions')
      .select(`
        permissions!inner(
          name,
          display_name,
          description,
          module,
          action
        )
      `)
      .eq('role', role || 'free')
      .eq('is_granted', true);

    if (permissionsError) {
      console.error('Get permissions error:', permissionsError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get role permissions',
          details: permissionsError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const response = {
      userId,
      role: role || 'free',
      roleDetails: roleDetails || null,
      permissions: permissions?.map(p => p.permissions) || [],
      isAdmin: role === 'admin',
      isPremium: role === 'premium' || role === 'admin',
      isFree: role === 'free'
    };

    return new Response(
      JSON.stringify(response),
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required field: userId' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 调用数据库函数获取用户角色
    const { data: role, error: roleError } = await supabase
      .rpc('get_user_role', {
        user_id_param: userId
      });

    if (roleError) {
      console.error('Get user role error:', roleError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get user role',
          details: roleError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 获取用户角色详细信息
    const { data: roleDetails, error: detailsError } = await supabase
      .from('user_roles')
      .select(`
        id,
        role,
        granted_at,
        expires_at,
        is_active
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (detailsError && detailsError.code !== 'PGRST116') {
      console.error('Get role details error:', detailsError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get role details',
          details: detailsError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 获取角色权限列表
    const { data: permissions, error: permissionsError } = await supabase
      .from('role_permissions')
      .select(`
        permissions!inner(
          name,
          display_name,
          description,
          module,
          action
        )
      `)
      .eq('role', role || 'free')
      .eq('is_granted', true);

    if (permissionsError) {
      console.error('Get permissions error:', permissionsError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get role permissions',
          details: permissionsError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const response = {
      userId,
      role: role || 'free',
      roleDetails: roleDetails || null,
      permissions: permissions?.map(p => p.permissions) || [],
      isAdmin: role === 'admin',
      isPremium: role === 'premium' || role === 'admin',
      isFree: role === 'free'
    };

    return new Response(
      JSON.stringify(response),
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