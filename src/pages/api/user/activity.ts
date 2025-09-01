import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const userId = url.searchParams.get('userId');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证用户是否存在
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 获取用户活动记录
    const { data: activities, error: activitiesError } = await supabase
      .from('user_access_logs')
      .select(`
        id,
        user_id,
        access_date,
        access_count,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (activitiesError) {
      console.error('Error fetching user activities:', activitiesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activities' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 检查是否还有更多数据
    const { count, error: countError } = await supabase
      .from('user_access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting activities:', countError);
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return new Response(
      JSON.stringify({
        activities: activities || [],
        hasMore,
        totalCount,
        currentOffset: offset,
        limit
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Activity API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, activityType, description, details, ipAddress, userAgent } = body;

    if (!userId || !activityType) {
      return new Response(
        JSON.stringify({ error: 'User ID and activity type are required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证用户是否存在
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 创建或更新访问记录
    const today = new Date().toISOString().split('T')[0];
    
    // 先尝试获取今天的记录
    const { data: existingLog, error: fetchError } = await supabase
      .from('user_access_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('access_date', today)
      .single();

    let activity;
    let activityError;

    if (existingLog) {
      // 更新现有记录
      const { data, error } = await supabase
        .from('user_access_logs')
        .update({
          access_count: existingLog.access_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLog.id)
        .select()
        .single();
      activity = data;
      activityError = error;
    } else {
      // 创建新记录
      const { data, error } = await supabase
        .from('user_access_logs')
        .insert({
          user_id: userId,
          access_date: today,
          access_count: 1
        })
        .select()
        .single();
      activity = data;
       activityError = error;
     }

    if (activityError) {
      console.error('Error creating activity log:', activityError);
      return new Response(
        JSON.stringify({ error: 'Failed to create activity log' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        activity
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Activity creation API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

// 获取活动统计信息
export const PUT: APIRoute = async ({ request, url }) => {
  try {
    const userId = url.searchParams.get('userId');
    const days = parseInt(url.searchParams.get('days') || '30');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证用户是否存在
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 获取活动统计
    const { data: stats, error: statsError } = await supabase
      .from('user_access_logs')
      .select('activity_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (statsError) {
      console.error('Error fetching activity stats:', statsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activity statistics' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 统计各类活动数量
    const activityCounts: Record<string, number> = {};
    const dailyActivity: Record<string, number> = {};

    stats?.forEach(activity => {
      // 按类型统计
      activityCounts[activity.activity_type] = (activityCounts[activity.activity_type] || 0) + 1;
      
      // 按日期统计
      const date = new Date(activity.created_at).toISOString().split('T')[0];
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
    });

    // 计算总活动数
    const totalActivities = stats?.length || 0;

    // 获取最常用的活动类型
    const mostUsedActivity = Object.entries(activityCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return new Response(
      JSON.stringify({
        totalActivities,
        activityCounts,
        dailyActivity,
        mostUsedActivity: mostUsedActivity ? {
          type: mostUsedActivity[0],
          count: mostUsedActivity[1]
        } : null,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Activity stats API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};