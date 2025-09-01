import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const GET: APIRoute = async ({ request }) => {
  try {
    // 验证管理员权限
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查用户角色
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError || !userRole || userRole.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取各角色用户统计
    const { data: roleStats, error: statsError } = await supabase
      .from('user_roles')
      .select('role')
      .order('role');

    if (statsError) {
      console.error('Error fetching role stats:', statsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user statistics' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 统计各角色数量
    const stats = {
      free: 0,
      user: 0,
      Pro: 0,
      super: 0,
      admin: 0,
      total: roleStats?.length || 0
    };

    if (roleStats) {
      roleStats.forEach(user => {
        if (stats.hasOwnProperty(user.role)) {
          stats[user.role as keyof typeof stats]++;
        }
      });
    }

    // 获取最近30天新增用户数
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentUsers, error: recentError } = await supabase
      .from('user_roles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const recentCount = recentUsers?.length || 0;

    // 获取活跃用户数（最近7天有活动记录）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeUsers, error: activeError } = await supabase
      .from('user_access_logs')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());

    // 去重获取活跃用户数
    const uniqueActiveUsers = activeUsers ? 
      [...new Set(activeUsers.map(log => log.user_id))].length : 0;

    return new Response(JSON.stringify({
      ...stats,
      recentUsers: recentCount,
      activeUsers: uniqueActiveUsers,
      lastUpdated: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in user stats API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, dateRange = 30 } = body;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查用户角色
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError || !userRole || userRole.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取指定时间范围内的详细统计
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    // 获取新用户注册趋势
    const { data: registrationTrend, error: regError } = await supabase
      .from('user_roles')
      .select('created_at, role')
      .gte('created_at', startDate.toISOString())
      .order('created_at');

    // 获取用户活动趋势
    const { data: activityTrend, error: actError } = await supabase
      .from('user_access_logs')
      .select('created_at, activity_type')
      .gte('created_at', startDate.toISOString())
      .order('created_at');

    // 按日期分组统计
    const dailyStats = {};
    const today = new Date();
    
    // 初始化日期范围
    for (let i = 0; i < dateRange; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyStats[dateKey] = {
        date: dateKey,
        newUsers: 0,
        activities: 0,
        roleBreakdown: { free: 0, user: 0, Pro: 0, super: 0, admin: 0 }
      };
    }

    // 统计新用户注册
    if (registrationTrend) {
      registrationTrend.forEach(user => {
        const dateKey = user.created_at.split('T')[0];
        if (dailyStats[dateKey]) {
          dailyStats[dateKey].newUsers++;
          if (dailyStats[dateKey].roleBreakdown.hasOwnProperty(user.role)) {
            dailyStats[dateKey].roleBreakdown[user.role]++;
          }
        }
      });
    }

    // 统计用户活动
    if (activityTrend) {
      activityTrend.forEach(activity => {
        const dateKey = activity.created_at.split('T')[0];
        if (dailyStats[dateKey]) {
          dailyStats[dateKey].activities++;
        }
      });
    }

    // 转换为数组并排序
    const trendData = Object.values(dailyStats).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return new Response(JSON.stringify({
      dateRange,
      trendData,
      summary: {
        totalNewUsers: registrationTrend?.length || 0,
        totalActivities: activityTrend?.length || 0,
        avgDailyNewUsers: Math.round((registrationTrend?.length || 0) / dateRange * 10) / 10,
        avgDailyActivities: Math.round((activityTrend?.length || 0) / dateRange * 10) / 10
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in user stats trend API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};