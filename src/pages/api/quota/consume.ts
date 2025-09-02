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
    const { quotaType, userId, amount = 1 } = await request.json();

    if (!quotaType) {
      return new Response(
        JSON.stringify({ error: 'Missing quotaType' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 处理访客用户 - 访客配额在前端本地管理
    if (!userId || userId === 'guest') {
      return new Response(
        JSON.stringify({
          success: true,
          consumed: amount,
          message: 'Guest quota managed locally',
          isGuest: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 首先检查配额是否足够
    const checkResponse = await fetch(`${new URL(request.url).origin}/api/quota/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quotaType, userId })
    });

    if (!checkResponse.ok) {
      const error = await checkResponse.json();
      return new Response(
        JSON.stringify({ error: error.error || 'Failed to check quota' }),
        { status: checkResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const quotaInfo = await checkResponse.json();

    // Admin用户直接返回成功，不消耗配额
    if (quotaInfo.isAdmin) {
      return new Response(
        JSON.stringify({
          success: true,
          consumed: amount,
          monthlyUsed: 0,
          monthlyLimit: 999999,
          dailyUsed: 0,
          dailyLimit: 999999,
          remainingMonthly: 999999,
          remainingDaily: 999999,
          planType: 'admin',
          isAdmin: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!quotaInfo.canUse) {
      return new Response(
        JSON.stringify({ 
          error: 'Quota exceeded',
          quotaInfo
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查是否有足够的配额
    const remainingMonthly = quotaInfo.monthlyLimit - quotaInfo.monthlyUsed;
    const remainingDaily = quotaInfo.dailyLimit > 0 ? quotaInfo.dailyLimit - quotaInfo.dailyUsed : Infinity;
    const remainingQuota = Math.min(remainingMonthly, remainingDaily);

    if (remainingQuota < amount) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient quota',
          requested: amount,
          available: remainingQuota,
          quotaInfo
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 消费配额
    const { data: updatedQuota, error: updateError } = await supabase
      .from('user_quotas')
      .update({
        monthly_used: quotaInfo.monthlyUsed + amount,
        daily_used: quotaInfo.dailyUsed + amount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('quota_type', quotaType)
      .select('monthly_used, daily_used')
      .single();

    if (updateError) {
      console.error('Error updating quota:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update quota' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        consumed: amount,
        monthlyUsed: updatedQuota.monthly_used,
        monthlyLimit: quotaInfo.monthlyLimit,
        dailyUsed: updatedQuota.daily_used,
        dailyLimit: quotaInfo.dailyLimit,
        remainingMonthly: quotaInfo.monthlyLimit - updatedQuota.monthly_used,
        remainingDaily: quotaInfo.dailyLimit > 0 ? quotaInfo.dailyLimit - updatedQuota.daily_used : null,
        planType: quotaInfo.planType
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error consuming quota:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};