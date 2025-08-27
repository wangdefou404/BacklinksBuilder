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
    const { permission, userId } = await request.json();

    if (!permission || !userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: permission and userId' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 调用数据库函数检查用户权限
    const { data, error } = await supabase
      .rpc('check_user_permission', {
        user_id_param: userId,
        permission_name_param: permission
      });

    if (error) {
      console.error('Permission check error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check permission',
          details: error.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        hasPermission: data,
        permission,
        userId
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

export const GET: APIRoute = async ({ url }) => {
  try {
    const permission = url.searchParams.get('permission');
    const userId = url.searchParams.get('userId');

    if (!permission || !userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required query parameters: permission and userId' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 调用数据库函数检查用户权限
    const { data, error } = await supabase
      .rpc('check_user_permission', {
        user_id_param: userId,
        permission_name_param: permission
      });

    if (error) {
      console.error('Permission check error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check permission',
          details: error.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        hasPermission: data,
        permission,
        userId
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