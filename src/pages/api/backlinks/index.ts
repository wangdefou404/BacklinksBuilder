import type { APIRoute } from 'astro';
import type { BacklinkResource, BacklinkFilters, BacklinkListResponse } from '../../../types/backlinks';
import { supabase } from '../../../lib/supabase';

// Helper function to convert database record to BacklinkResource format
function formatBacklinkResource(dbRecord: any): BacklinkResource {
  return {
    id: dbRecord.id,
    name: dbRecord.name,
    websiteLink: dbRecord.website_link,
    dr: dbRecord.dr || 0,
    traffic: dbRecord.traffic || 0,
    paymentType: dbRecord.payment_type?.toLowerCase() === 'free' ? 'Free' : 'Paid',
    followType: dbRecord.follow_type?.toLowerCase() === 'dofollow' ? 'DoFollow' : 'NoFollow',
    platformType: dbRecord.platform_type || 'blog',
    access: dbRecord.access_type === 'guest' ? 'guest' : 'premium',
    updated: new Date(dbRecord.updated_at).toISOString().split('T')[0],
    featured: dbRecord.status === 'featured',
    tags: ['SEO', 'Marketing', 'Business'], // Default tags
    submissionUrl: dbRecord.submit_url || dbRecord.website_link,
    requirements: 'Quality content required',
    approvalTime: '1-3 days',
    contactEmail: 'contact@example.com'
  };
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = url.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const isPremium = searchParams.get('premium') === 'true';
    
    const filters: BacklinkFilters = {
      search: searchParams.get('search') || undefined,
      paymentType: searchParams.get('paymentType') || undefined,
      followType: searchParams.get('followType') || undefined,
      platformType: searchParams.get('platformType') || undefined,
      minDr: searchParams.get('minDr') ? parseInt(searchParams.get('minDr')!) : undefined,
      maxDr: searchParams.get('maxDr') ? parseInt(searchParams.get('maxDr')!) : undefined,
      minTraffic: searchParams.get('minTraffic') ? parseInt(searchParams.get('minTraffic')!) : undefined,
      maxTraffic: searchParams.get('maxTraffic') ? parseInt(searchParams.get('maxTraffic')!) : undefined,
    };

    // Build query for backlink_resources table
    let query = supabase
      .from('backlink_resources')
      .select(`
        id,
        name,
        website_link,
        submit_url,
        dr,
        traffic,
        payment_type,
        follow_type,
        platform_type,
        access_type,
        status,
        updated_at
      `);

    // Apply search filter
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,website_link.ilike.%${filters.search}%`);
    }

    // Apply payment type filter
    if (filters.paymentType) {
      const dbPaymentType = filters.paymentType.toLowerCase() === 'free' ? 'free' : 'paid';
      query = query.eq('payment_type', dbPaymentType);
    }

    // Apply follow type filter
    if (filters.followType) {
      const dbFollowType = filters.followType.toLowerCase() === 'dofollow' ? 'dofollow' : 'nofollow';
      query = query.eq('follow_type', dbFollowType);
    }

    // Apply platform type filter
    if (filters.platformType) {
      query = query.eq('platform_type', filters.platformType);
    }

    // Apply DR filters
    if (filters.minDr !== undefined) {
      query = query.gte('dr', filters.minDr);
    }
    if (filters.maxDr !== undefined) {
      query = query.lte('dr', filters.maxDr);
    }

    // Apply traffic filters
    if (filters.minTraffic !== undefined) {
      query = query.gte('traffic', filters.minTraffic);
    }
    if (filters.maxTraffic !== undefined) {
      query = query.lte('traffic', filters.maxTraffic);
    }

    // User permission control - filter based on access_type
    if (!isPremium) {
      // Free users can only see guest access resources
      query = query.eq('access_type', 'guest');
    }

    // Get total count
    const { count: totalCount } = await query
      .select('*', { count: 'exact', head: true });

    // Get paginated data with sorting by DR (descending)
    const { data: backlinks, error: backlinksError } = await query
      .order('dr', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (backlinksError) {
      console.error('Error fetching backlinks:', backlinksError);
      return new Response(JSON.stringify({ error: 'Failed to fetch backlinks' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Format data for frontend
    const formattedBacklinks = (backlinks || []).map(formatBacklinkResource);
    
    const response = {
      backlinks: formattedBacklinks,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        hasMore: page * limit < (totalCount || 0)
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching backlinks:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const newBacklink: Omit<BacklinkResource, 'id'> = await request.json();
    
    // Convert frontend format to database format
    const dbRecord = {
      name: newBacklink.name,
      website_link: newBacklink.websiteLink,
      submit_url: newBacklink.submissionUrl || newBacklink.websiteLink,
      dr: newBacklink.dr || 0,
      traffic: newBacklink.traffic || 0,
      payment_type: newBacklink.paymentType?.toLowerCase() === 'free' ? 'free' : 'paid',
      follow_type: newBacklink.followType?.toLowerCase() === 'dofollow' ? 'dofollow' : 'nofollow',
      platform_type: newBacklink.platformType || 'blog',
      access_type: newBacklink.access === 'guest' ? 'guest' : 'premium',
      status: newBacklink.featured ? 'featured' : 'active',
      user_id: '00000000-0000-0000-0000-000000000000' // Default system user for public resources
    };
    
    // Insert into database
    const { data: insertedBacklink, error: insertError } = await supabase
      .from('backlink_resources')
      .insert([dbRecord])
      .select()
      .single();
    
    if (insertError) {
      console.error('Error inserting backlink:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create backlink' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Format response for frontend
    const formattedBacklink = formatBacklinkResource(insertedBacklink);
    
    return new Response(JSON.stringify(formattedBacklink), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error creating backlink:', error);
    return new Response(JSON.stringify({ error: 'Invalid request data' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};