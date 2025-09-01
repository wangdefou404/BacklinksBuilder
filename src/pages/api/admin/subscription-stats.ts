import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    // 验证管理员权限
    const session = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user;
    try {
      user = JSON.parse(decodeURIComponent(session));
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取活跃订阅数量
    const { data: activeSubscriptions, error: activeError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString());

    if (activeError) {
      console.error('Error fetching active subscriptions:', activeError);
      return new Response(JSON.stringify({ error: 'Failed to fetch active subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取本月收入
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const { data: monthlySubscriptions, error: monthlyError } = await supabase
      .from('user_subscriptions')
      .select(`
        subscription_plans!inner(
          price
        )
      `)
      .gte('start_date', startOfMonth.toISOString())
      .lte('start_date', endOfMonth.toISOString())
      .eq('status', 'active');

    if (monthlyError) {
      console.error('Error fetching monthly revenue:', monthlyError);
      return new Response(JSON.stringify({ error: 'Failed to fetch monthly revenue' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const monthlyRevenue = monthlySubscriptions?.reduce((total, sub: any) => {
      return total + (sub.subscription_plans?.price || 0);
    }, 0) || 0;

    // 获取即将到期的订阅（7天内）
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data: expiringSubscriptions, error: expiringError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .lte('end_date', sevenDaysFromNow.toISOString());

    if (expiringError) {
      console.error('Error fetching expiring subscriptions:', expiringError);
      return new Response(JSON.stringify({ error: 'Failed to fetch expiring subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取已取消的订阅数量
    const { data: cancelledSubscriptions, error: cancelledError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('status', 'cancelled');

    if (cancelledError) {
      console.error('Error fetching cancelled subscriptions:', cancelledError);
      return new Response(JSON.stringify({ error: 'Failed to fetch cancelled subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stats = {
      active: activeSubscriptions?.length || 0,
      monthlyRevenue: monthlyRevenue,
      expiring: expiringSubscriptions?.length || 0,
      cancelled: cancelledSubscriptions?.length || 0
    };

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in subscription stats API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    // 验证管理员权限
    const session = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user;
    try {
      user = JSON.parse(decodeURIComponent(session));
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { startDate, endDate } = await request.json();

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'Start date and end date are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取指定时间范围内的订阅趋势
    const { data: subscriptionTrends, error: trendsError } = await supabase
      .from('user_subscriptions')
      .select(`
        start_date,
        status,
        subscription_plans!inner(
          price,
          billing_cycle
        )
      `)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: true });

    if (trendsError) {
      console.error('Error fetching subscription trends:', trendsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscription trends' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 按日期分组统计
    const dailyStats: { [key: string]: { subscriptions: number; revenue: number } } = {};
    
    subscriptionTrends?.forEach((sub: any) => {
      const date = new Date(sub.start_date).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { subscriptions: 0, revenue: 0 };
      }
      dailyStats[date].subscriptions += 1;
      dailyStats[date].revenue += sub.subscription_plans?.price || 0;
    });

    // 转换为数组格式
    const trends = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      subscriptions: stats.subscriptions,
      revenue: stats.revenue
    }));

    return new Response(JSON.stringify({ trends }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in subscription trends API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};