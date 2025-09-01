import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('🔍 Admin stats API called');
    
    // 获取总用户数
    const { count: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (usersError) {
      console.error('Error fetching total users:', usersError);
    }

    // 获取高级用户数
    const { count: premiumUsers, error: premiumError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('role', ['Pro', 'super', 'admin'])
      .single();

    if (premiumError) {
      console.error('Error fetching premium users:', premiumError);
    }

    // 获取总检查次数（如果有相关表的话）
    // 这里使用模拟数据，实际应该从相关的检查记录表获取
    const totalChecks = Math.floor(Math.random() * 10000) + 5000;
    const todayChecks = Math.floor(Math.random() * 100) + 50;

    const stats = {
      totalUsers: totalUsers || 0,
      premiumUsers: premiumUsers || 0,
      totalChecks,
      todayChecks
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