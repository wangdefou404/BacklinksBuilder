import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);



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

    // Get user role
    const { data: userRole, error: roleError } = await supabase
      .rpc('get_user_active_role', {
        p_user_id: userId
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

    // Get user quota statistics
    const { data: quotaStats, error: quotaError } = await supabase
      .rpc('get_user_quota_stats', {
        p_user_id: userId
      });

    if (quotaError) {
      console.error('Get quota stats error:', quotaError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get quota statistics',
          details: quotaError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Determine user plan type and display name
    const planType = userRole || 'free';
    const planDisplayName = {
      'free': 'Free',
      'user': 'User', 
      'pro': 'Pro',
      'super': 'Super',
      'admin': 'Admin'
    }[planType] || 'Free';

    // Build quota information
    const quotas: Record<string, any> = {};
    const resetTimes: Record<string, string | null> = {};
    
    if (quotaStats && Array.isArray(quotaStats)) {
      quotaStats.forEach((stat: any) => {
        const productType = stat.product_type;
        quotas[productType] = {
          name: {
            'dr_check': 'DR Check',
            'traffic_check': 'Traffic Check', 
            'backlink_check': 'Backlink Check',
            'backlink_view': 'Backlink View'
          }[productType] || productType,
          limit: stat.total_quota,
          used: stat.used_quota,
          remaining: stat.remaining_quota,
          unlimited: stat.is_unlimited,
          percentage: stat.usage_percentage
        };
        
        // Collect reset time information
        if (stat.next_reset_at && stat.reset_cycle) {
          resetTimes[stat.reset_cycle] = stat.next_reset_at;
        }
      });
    }

    const quotaInfo = {
      userId,
      planType,
      planDisplayName,
      quotas,
      resetTimes,
      lastUpdated: new Date().toISOString()
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
    const { userId, quotaType, amount } = await request.json();

    if (!userId || !quotaType || !amount) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: userId, quotaType, amount' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Update quota usage
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_user_quota_usage', {
        p_user_id: userId,
        p_product_type: quotaType,
        p_usage_amount: amount
      });

    if (updateError) {
      console.error('Update quota usage error:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update quota usage',
          details: updateError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Quota usage updated successfully',
        result: updateResult
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