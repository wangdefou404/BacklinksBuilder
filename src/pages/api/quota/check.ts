import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { quotaType, userId } = await request.json();
    
    console.log('配额检查请求:', { quotaType, userId });

    if (!quotaType) {
      console.error('缺少 quotaType 参数');
      return new Response(
        JSON.stringify({ error: 'Missing quotaType' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 处理访客用户
    if (!userId || userId === 'guest') {
      const guestQuotas = {
        'dr_check': { monthlyLimit: 5, dailyLimit: 2 },
        'traffic_check': { monthlyLimit: 5, dailyLimit: 2 },
        'backlink_check': { monthlyLimit: 3, dailyLimit: 1 },
        'backlink_view': { monthlyLimit: 10, dailyLimit: 5 }
      };

      const quota = guestQuotas[quotaType] || { monthlyLimit: 3, dailyLimit: 1 };
      
      return new Response(
        JSON.stringify({
          canUse: true,
          monthlyUsed: 0,
          monthlyLimit: quota.monthlyLimit,
          dailyUsed: 0,
          dailyLimit: quota.dailyLimit,
          planType: 'guest',
          isGuest: true,
          resetMonthlyAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          resetDailyAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取用户角色
    console.log('获取用户角色:', userId);
    let { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    console.log('用户角色查询结果:', { userRole, roleError });

    // 如果用户角色不存在，创建默认的free角色
    if (roleError || !userRole) {
      console.log('创建默认用户角色: free');
      const { data: newRole, error: createRoleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'free',
          is_active: true
        })
        .select('role')
        .single();

      console.log('创建角色结果:', { newRole, createRoleError });

      if (createRoleError || !newRole) {
        // 如果创建失败，使用默认角色
        console.log('创建角色失败，使用默认 free 角色');
        userRole = { role: 'free' };
      } else {
        userRole = newRole;
      }
    }

    // 映射角色到计划类型
    const planTypeMap: Record<string, string> = {
      'free': 'free',
      'pro': 'pro',
      'Pro': 'pro', // 兼容大写
      'admin': 'super',
      'super': 'super'
    };

    const planType = planTypeMap[userRole.role] || 'free';
    console.log('角色映射结果:', { role: userRole.role, planType });

    // Admin用户拥有无限配额
    if (userRole.role === 'admin') {
      console.log('Admin用户检测到，返回无限配额');
      return new Response(
        JSON.stringify({
          canUse: true,
          monthlyUsed: 0,
          monthlyLimit: 999999,
          dailyUsed: 0,
          dailyLimit: 999999,
          planType: 'admin',
          isAdmin: true,
          resetMonthlyAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          resetDailyAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取计划配额限制
    console.log('查询配额限制:', { planType, quotaType });
    const { data: planQuota, error: planError } = await supabase
      .from('user_plan_quotas')
      .select('monthly_limit, daily_limit')
      .eq('plan_type', planType)
      .eq('quota_type', quotaType)
      .single();

    console.log('配额限制查询结果:', { planQuota, planError });

    if (planError || !planQuota) {
      console.error('未找到配额限制:', { planType, quotaType, planError });
      return new Response(
        JSON.stringify({ error: 'Plan quota not found', details: { planType, quotaType, planError } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取用户当前配额使用情况
    const { data: userQuota, error: quotaError } = await supabase
      .from('user_quotas')
      .select('monthly_used, daily_used, reset_monthly_at, reset_daily_at')
      .eq('user_id', userId)
      .eq('quota_type', quotaType)
      .single();

    if (quotaError) {
      // 如果用户配额记录不存在，创建一个
      const { data: newQuota, error: createError } = await supabase
        .from('user_quotas')
        .insert({
          user_id: userId,
          quota_type: quotaType,
          plan_type: planType,
          monthly_used: 0,
          daily_used: 0,
          monthly_limit: planQuota.monthly_limit,
          daily_limit: planQuota.daily_limit || 0,
          reset_monthly_at: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          reset_daily_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })
        .select('monthly_used, daily_used, reset_monthly_at, reset_daily_at')
        .single();

      if (createError || !newQuota) {
        return new Response(
          JSON.stringify({ error: 'Failed to create user quota' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          canUse: true,
          monthlyUsed: 0,
          monthlyLimit: planQuota.monthly_limit,
          dailyUsed: 0,
          dailyLimit: planQuota.daily_limit || 0,
          planType,
          resetMonthlyAt: newQuota.reset_monthly_at,
          resetDailyAt: newQuota.reset_daily_at
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查是否需要重置配额
    const now = new Date();
    let monthlyUsed = userQuota.monthly_used;
    let dailyUsed = userQuota.daily_used;
    let resetMonthlyAt = new Date(userQuota.reset_monthly_at);
    let resetDailyAt = new Date(userQuota.reset_daily_at);

    // 重置月度配额
    if (now >= resetMonthlyAt) {
      monthlyUsed = 0;
      resetMonthlyAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    // 重置日度配额
    if (now >= resetDailyAt) {
      dailyUsed = 0;
      resetDailyAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    // 如果需要重置，更新数据库
    if (monthlyUsed !== userQuota.monthly_used || dailyUsed !== userQuota.daily_used) {
      await supabase
        .from('user_quotas')
        .update({
          monthly_used: monthlyUsed,
          daily_used: dailyUsed,
          reset_monthly_at: resetMonthlyAt,
          reset_daily_at: resetDailyAt
        })
        .eq('user_id', userId)
        .eq('quota_type', quotaType);
    }

    // 检查是否可以使用
    const canUseMonthly = monthlyUsed < planQuota.monthly_limit;
    const canUseDaily = planQuota.daily_limit ? dailyUsed < planQuota.daily_limit : true;
    const canUse = canUseMonthly && canUseDaily;

    return new Response(
      JSON.stringify({
        canUse,
        monthlyUsed,
        monthlyLimit: planQuota.monthly_limit,
        dailyUsed,
        dailyLimit: planQuota.daily_limit || 0,
        planType,
        resetMonthlyAt,
        resetDailyAt
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking quota:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};