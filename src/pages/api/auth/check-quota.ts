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
    const { userId, quotaType, usageType = 'daily' } = await request.json();

    if (!userId || !quotaType) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: userId and quotaType' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证配额类型
    const validQuotaTypes = ['dr_checker', 'traffic_checker', 'backlink_generator'];
    if (!validQuotaTypes.includes(quotaType)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid quota type. Must be one of: ${validQuotaTypes.join(', ')}` 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 调用数据库函数检查用户配额
    const { data: canUse, error: quotaError } = await supabase
      .rpc('check_user_quota', {
        user_id_param: userId,
        quota_type_param: quotaType,
        usage_type: usageType
      });

    if (quotaError) {
      console.error('Quota check error:', quotaError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check quota',
          details: quotaError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 获取详细的配额信息
    const { data: quotaDetails, error: detailsError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (detailsError && detailsError.code !== 'PGRST116') {
      console.error('Get quota details error:', detailsError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get quota details',
          details: detailsError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 根据配额类型获取具体的限制和使用情况
    let quotaInfo = {
      limit: 0,
      used: 0,
      remaining: 0,
      unlimited: false
    };

    if (quotaDetails) {
      switch (quotaType) {
        case 'dr_checker':
          quotaInfo.limit = quotaDetails.dr_checks_limit || 0;
          quotaInfo.used = quotaDetails.dr_checks_used || 0;
          break;
        case 'traffic_checker':
          quotaInfo.limit = quotaDetails.traffic_checks_limit || 0;
          quotaInfo.used = quotaDetails.traffic_checks_used || 0;
          break;
        case 'backlink_generator':
          quotaInfo.limit = quotaDetails.backlink_checks_limit || 0;
          quotaInfo.used = quotaDetails.backlink_checks_used || 0;
          break;
      }

      quotaInfo.unlimited = quotaInfo.limit === -1;
      quotaInfo.remaining = quotaInfo.unlimited ? -1 : Math.max(0, quotaInfo.limit - quotaInfo.used);
    }

    const response = {
      canUse: canUse || false,
      userId,
      quotaType,
      usageType,
      quotaInfo,
      resetTime: quotaDetails?.reset_daily_at || null,
      monthlyResetTime: quotaDetails?.reset_monthly_at || null
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

export const GET: APIRoute = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');
    const quotaType = url.searchParams.get('quotaType');
    const usageType = url.searchParams.get('usageType') || 'daily';

    if (!userId || !quotaType) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required query parameters: userId and quotaType' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证配额类型
    const validQuotaTypes = ['dr_checker', 'traffic_checker', 'backlink_generator'];
    if (!validQuotaTypes.includes(quotaType)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid quota type. Must be one of: ${validQuotaTypes.join(', ')}` 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 调用数据库函数检查用户配额
    const { data: canUse, error: quotaError } = await supabase
      .rpc('check_user_quota', {
        user_id_param: userId,
        quota_type_param: quotaType,
        usage_type: usageType
      });

    if (quotaError) {
      console.error('Quota check error:', quotaError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check quota',
          details: quotaError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 获取详细的配额信息
    const { data: quotaDetails, error: detailsError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (detailsError && detailsError.code !== 'PGRST116') {
      console.error('Get quota details error:', detailsError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get quota details',
          details: detailsError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 根据配额类型获取具体的限制和使用情况
    let quotaInfo = {
      limit: 0,
      used: 0,
      remaining: 0,
      unlimited: false
    };

    if (quotaDetails) {
      switch (quotaType) {
        case 'dr_checker':
          quotaInfo.limit = quotaDetails.dr_checks_limit || 0;
          quotaInfo.used = quotaDetails.dr_checks_used || 0;
          break;
        case 'traffic_checker':
          quotaInfo.limit = quotaDetails.traffic_checks_limit || 0;
          quotaInfo.used = quotaDetails.traffic_checks_used || 0;
          break;
        case 'backlink_generator':
          quotaInfo.limit = quotaDetails.backlink_checks_limit || 0;
          quotaInfo.used = quotaDetails.backlink_checks_used || 0;
          break;
      }

      quotaInfo.unlimited = quotaInfo.limit === -1;
      quotaInfo.remaining = quotaInfo.unlimited ? -1 : Math.max(0, quotaInfo.limit - quotaInfo.used);
    }

    const response = {
      canUse: canUse || false,
      userId,
      quotaType,
      usageType,
      quotaInfo,
      resetTime: quotaDetails?.reset_daily_at || null,
      monthlyResetTime: quotaDetails?.reset_monthly_at || null
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