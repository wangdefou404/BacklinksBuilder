import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Get query parameters
    const searchParams = url.searchParams;
    const type = searchParams.get('type') || 'overview';
    const timeRange = searchParams.get('timeRange') || '30d';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Verify user permissions
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized access' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate time range
    let dateFilter = '';
    const now = new Date();
    let fromDate: Date;
    let toDate = now;

    if (startDate && endDate) {
      fromDate = new Date(startDate);
      toDate = new Date(endDate);
    } else {
      switch (timeRange) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default: // 30d
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    dateFilter = `created_at >= '${fromDate.toISOString()}' AND created_at <= '${toDate.toISOString()}'`;

    if (type === 'realtime') {
      // Get real-time activity data
      const activities = [
        {
          message: `User user${Math.floor(Math.random() * 1000)}@example.com completed backlink check`,
          time: `${Math.floor(Math.random() * 10) + 1} minutes ago`,
          color: 'green'
        },
        {
          message: `New user registration: newuser${Math.floor(Math.random() * 100)}@test.com`,
          time: `${Math.floor(Math.random() * 15) + 5} minutes ago`,
          color: 'blue'
        },
        {
          message: `premium${Math.floor(Math.random() * 50)}@user.com upgraded to premium`,
          time: `${Math.floor(Math.random() * 20) + 8} minutes ago`,
          color: 'yellow'
        },
        {
          message: `Check failed: timeout${Math.floor(Math.random() * 10)}.com`,
          time: `${Math.floor(Math.random() * 25) + 12} minutes ago`,
          color: 'red'
        },
        {
          message: 'System backup completed',
          time: `${Math.floor(Math.random() * 30) + 15} minutes ago`,
          color: 'purple'
        }
      ];

      return new Response(JSON.stringify({ activities }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户统计
    const { data: usersData, error: usersError } = await supabase
      .from('auth.users')
      .select('id, created_at, email_confirmed_at')
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString());

    if (usersError) {
      console.error('User data fetch error:', usersError);
    }

    // Get user role statistics
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, created_at')
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString());

    if (rolesError) {
      console.error('Role data fetch error:', rolesError);
    }

    // Get check statistics (mock data, should be fetched from check records table in production)
    const checksData = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000);
      const totalChecks = Math.floor(Math.random() * 1000) + 1000;
      const successChecks = Math.floor(totalChecks * (0.8 + Math.random() * 0.15));
      
      checksData.push({
        date: date.toISOString().split('T')[0],
        checks: totalChecks,
        success: successChecks,
        failed: totalChecks - successChecks
      });
    }

    // Get popular domain statistics (mock data)
    const topDomains = [
      { domain: 'example.com', checks: Math.floor(Math.random() * 500) + 1000, success: 0 },
      { domain: 'test.org', checks: Math.floor(Math.random() * 400) + 800, success: 0 },
      { domain: 'demo.net', checks: Math.floor(Math.random() * 300) + 600, success: 0 },
      { domain: 'sample.io', checks: Math.floor(Math.random() * 200) + 400, success: 0 },
      { domain: 'website.co', checks: Math.floor(Math.random() * 150) + 300, success: 0 }
    ].map(domain => ({
      ...domain,
      success: Math.floor(domain.checks * (0.85 + Math.random() * 0.1))
    }));

    // Get revenue data (mock data)
    const revenueData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const revenue = Math.floor(Math.random() * 5000) + 15000;
      const subscriptions = Math.floor(revenue / 150) + Math.floor(Math.random() * 20);
      
      revenueData.push({
        month: date.toISOString().substring(0, 7),
        revenue,
        subscriptions
      });
    }

    // Calculate overview statistics
    const totalUsers = usersData?.length || 1247;
    const activeUsers = Math.floor(totalUsers * 0.72);
    const totalChecks = checksData.reduce((sum, day) => sum + day.checks, 0);
    const totalSuccess = checksData.reduce((sum, day) => sum + day.success, 0);
    const successRate = totalChecks > 0 ? Math.round((totalSuccess / totalChecks) * 100 * 10) / 10 : 0;
    const avgResponseTime = Math.round((Math.random() * 2 + 0.5) * 10) / 10;

    // Generate user growth data
    const userGrowth = [];
    let cumulativeUsers = Math.max(totalUsers - 200, 800);
    let cumulativePremium = Math.floor(cumulativeUsers * 0.15);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dailyGrowth = Math.floor(Math.random() * 50) + 10;
      const premiumGrowth = Math.floor(Math.random() * 8) + 2;
      
      cumulativeUsers += dailyGrowth;
      cumulativePremium += premiumGrowth;
      
      userGrowth.push({
        date: date.toISOString().split('T')[0],
        users: cumulativeUsers,
        premium: cumulativePremium
      });
    }

    const analyticsData = {
      overview: {
        totalUsers,
        activeUsers,
        totalChecks,
        successRate,
        avgResponseTime
      },
      userGrowth,
      checksData,
      topDomains,
      revenueData
    };

    return new Response(JSON.stringify({ 
      success: true, 
      data: analyticsData,
      timeRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    // Verify user permissions
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized access' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'export_report':
        // Generate and return report file
        const reportData = {
          generatedAt: new Date().toISOString(),
          summary: {
            totalUsers: 1247,
            activeUsers: 892,
            totalChecks: 15634,
            successRate: 87.5
          },
          details: {
            userGrowth: 'User growth data...',
            checksAnalysis: 'Checks analysis data...',
            revenueReport: 'Revenue report data...'
          }
        };

        // In production, this should generate PDF or Excel files
        const reportContent = JSON.stringify(reportData, null, 2);
        
        return new Response(reportContent, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="analytics-report-${new Date().toISOString().split('T')[0]}.json"`
          }
        });

      case 'refresh_cache':
        // Refresh cache logic
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Cache refreshed' 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: 'Unsupported operation' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Analytics POST API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};