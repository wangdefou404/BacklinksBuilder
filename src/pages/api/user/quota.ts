import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 根据价格页面定义的配额限制
const PLAN_QUOTAS = {
  free: {
    dr_checks: 10,
    traffic_checks: 10,
    backlink_checks: 10,
    backlink_views: 50
  },
  pro: {
    dr_checks: 1000,
    traffic_checks: 1000,
    backlink_checks: 1000,
    backlink_views: -1 // 无限制
  },
  super: {
    dr_checks: 5000,
    traffic_checks: 5000,
    backlink_checks: 5000,
    backlink_views: -1 // 无限制
  }
};

const PLAN_DISPLAY_NAMES = {
  free: 'Free',
  pro: 'Pro',
  super: 'Super'
};

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

    // 获取用户角色
    const { data: userRole, error: roleError } = await supabase
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

    // 获取用户配额详情
    const { data: quotaDetails, error: quotaError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (quotaError && quotaError.code !== 'PGRST116') {
      console.error('Get quota details error:', quotaError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get quota details',
          details: quotaError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 确定用户计划类型
    const planType = userRole === 'admin' ? 'super' : (userRole === 'premium' ? 'pro' : 'free');
    const planLimits = PLAN_QUOTAS[planType as keyof typeof PLAN_QUOTAS];

    // 构建配额信息
    const quotaInfo = {
      userId,
      planType,
      planDisplayName: PLAN_DISPLAY_NAMES[planType as keyof typeof PLAN_DISPLAY_NAMES],
      quotas: {
        dr_checks: {
          name: 'DR检查',
          limit: planLimits.dr_checks,
          used: quotaDetails?.dr_checks_used || 0,
          remaining: planLimits.dr_checks === -1 ? -1 : Math.max(0, planLimits.dr_checks - (quotaDetails?.dr_checks_used || 0)),
          unlimited: planLimits.dr_checks === -1,
          percentage: planLimits.dr_checks === -1 ? 0 : Math.min(((quotaDetails?.dr_checks_used || 0) / planLimits.dr_checks) * 100, 100)
        },
        traffic_checks: {
          name: '流量检查',
          limit: planLimits.traffic_checks,
          used: quotaDetails?.traffic_checks_used || 0,
          remaining: planLimits.traffic_checks === -1 ? -1 : Math.max(0, planLimits.traffic_checks - (quotaDetails?.traffic_checks_used || 0)),
          unlimited: planLimits.traffic_checks === -1,
          percentage: planLimits.traffic_checks === -1 ? 0 : Math.min(((quotaDetails?.traffic_checks_used || 0) / planLimits.traffic_checks) * 100, 100)
        },
        backlink_checks: {
          name: '外链检查',
          limit: planLimits.backlink_checks,
          used: quotaDetails?.backlink_checks_used || 0,
          remaining: planLimits.backlink_checks === -1 ? -1 : Math.max(0, planLimits.backlink_checks - (quotaDetails?.backlink_checks_used || 0)),
          unlimited: planLimits.backlink_checks === -1,
          percentage: planLimits.backlink_checks === -1 ? 0 : Math.min(((quotaDetails?.backlink_checks_used || 0) / planLimits.backlink_checks) * 100, 100)
        },
        backlink_views: {
          name: '外链查看',
          limit: planLimits.backlink_views,
          used: quotaDetails?.backlink_views_used || 0,
          remaining: planLimits.backlink_views === -1 ? -1 : Math.max(0, planLimits.backlink_views - (quotaDetails?.backlink_views_used || 0)),
          unlimited: planLimits.backlink_views === -1,
          percentage: planLimits.backlink_views === -1 ? 0 : Math.min(((quotaDetails?.backlink_views_used || 0) / planLimits.backlink_views) * 100, 100)
        }
      },
      resetTimes: {
        daily: quotaDetails?.reset_daily_at || null,
        monthly: quotaDetails?.reset_monthly_at || null
      },
      lastUpdated: quotaDetails?.updated_at || null
    };

    return new Response(
      JSON.stringify(quotaInfo),
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

    // 获取用户角色
    const { data: userRole, error: roleError } = await supabase
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

    // 获取用户配额详情
    const { data: quotaDetails, error: quotaError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (quotaError && quotaError.code !== 'PGRST116') {
      console.error('Get quota details error:', quotaError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get quota details',
          details: quotaError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 确定用户计划类型
    const planType = userRole === 'admin' ? 'super' : (userRole === 'premium' ? 'pro' : 'free');
    const planLimits = PLAN_QUOTAS[planType as keyof typeof PLAN_QUOTAS];

    // 构建配额信息
    const quotaInfo = {
      userId,
      planType,
      planDisplayName: PLAN_DISPLAY_NAMES[planType as keyof typeof PLAN_DISPLAY_NAMES],
      quotas: {
        dr_checks: {
          name: 'DR检查',
          limit: planLimits.dr_checks,
          used: quotaDetails?.dr_checks_used || 0,
          remaining: planLimits.dr_checks === -1 ? -1 : Math.max(0, planLimits.dr_checks - (quotaDetails?.dr_checks_used || 0)),
          unlimited: planLimits.dr_checks === -1,
          percentage: planLimits.dr_checks === -1 ? 0 : Math.min(((quotaDetails?.dr_checks_used || 0) / planLimits.dr_checks) * 100, 100)
        },
        traffic_checks: {
          name: '流量检查',
          limit: planLimits.traffic_checks,
          used: quotaDetails?.traffic_checks_used || 0,
          remaining: planLimits.traffic_checks === -1 ? -1 : Math.max(0, planLimits.traffic_checks - (quotaDetails?.traffic_checks_used || 0)),
          unlimited: planLimits.traffic_checks === -1,
          percentage: planLimits.traffic_checks === -1 ? 0 : Math.min(((quotaDetails?.traffic_checks_used || 0) / planLimits.traffic_checks) * 100, 100)
        },
        backlink_checks: {
          name: '外链检查',
          limit: planLimits.backlink_checks,
          used: quotaDetails?.backlink_checks_used || 0,
          remaining: planLimits.backlink_checks === -1 ? -1 : Math.max(0, planLimits.backlink_checks - (quotaDetails?.backlink_checks_used || 0)),
          unlimited: planLimits.backlink_checks === -1,
          percentage: planLimits.backlink_checks === -1 ? 0 : Math.min(((quotaDetails?.backlink_checks_used || 0) / planLimits.backlink_checks) * 100, 100)
        },
        backlink_views: {
          name: '外链查看',
          limit: planLimits.backlink_views,
          used: quotaDetails?.backlink_views_used || 0,
          remaining: planLimits.backlink_views === -1 ? -1 : Math.max(0, planLimits.backlink_views - (quotaDetails?.backlink_views_used || 0)),
          unlimited: planLimits.backlink_views === -1,
          percentage: planLimits.backlink_views === -1 ? 0 : Math.min(((quotaDetails?.backlink_views_used || 0) / planLimits.backlink_views) * 100, 100)
        }
      },
      resetTimes: {
        daily: quotaDetails?.reset_daily_at || null,
        monthly: quotaDetails?.reset_monthly_at || null
      },
      lastUpdated: quotaDetails?.updated_at || null
    };

    return new Response(
      JSON.stringify(quotaInfo),
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