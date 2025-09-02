import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('🔍 Admin stats API called');
    
    // 获取Free用户数
    const { count: freeUsers, error: freeError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'free');
    
    if (freeError) {
      console.error('Error fetching free users:', freeError);
    }

    // 获取Regular用户数
    const { count: regularUsers, error: regularError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user');

    if (regularError) {
      console.error('Error fetching regular users:', regularError);
    }

    // 获取Pro用户数
    const { count: proUsers, error: proError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'Pro');

    if (proError) {
      console.error('Error fetching pro users:', proError);
    }

    // 获取Admin用户数（包括super和admin）
    const { count: adminUsers, error: adminError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['super', 'admin']);

    if (adminError) {
      console.error('Error fetching admin users:', adminError);
    }

    // 获取总用户数
    const { count: totalUsers, error: totalError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error fetching total users:', totalError);
    }

    const stats = {
      totalUsers: totalUsers || 0,
      freeUsers: freeUsers || 0,
      regularUsers: regularUsers || 0,
      proUsers: proUsers || 0,
      adminUsers: adminUsers || 0
    };

    console.log('📊 Admin stats:', stats);

    return new Response(
      JSON.stringify(stats),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Admin stats API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch admin stats',
        details: error.message 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};