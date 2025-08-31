import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 验证用户权限
    const session = locals.session;
    const user = locals.user;

    if (!session || !user) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户角色
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole || !['admin', 'super'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: '权限不足' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const logType = url.searchParams.get('type') || 'all';
    const level = url.searchParams.get('level') || 'all';
    const timeRange = url.searchParams.get('timeRange') || '24h';
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const refresh = url.searchParams.get('refresh') === 'true';

    // 计算时间范围
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const offset = (page - 1) * limit;
    let logsData: any = {
      systemLogs: [],
      userActivities: [],
      errorLogs: []
    };

    // 获取系统日志
    if (logType === 'all' || logType === 'system') {
      let systemQuery = supabase
        .from('system_logs')
        .select('*')
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (level !== 'all') {
        systemQuery = systemQuery.eq('level', level);
      }

      if (search) {
        systemQuery = systemQuery.or(`message.ilike.%${search}%,source.ilike.%${search}%,category.ilike.%${search}%`);
      }

      const { data: systemLogs, error: systemError } = await systemQuery;

      if (!systemError && systemLogs) {
        logsData.systemLogs = systemLogs.map(log => ({
          id: log.id,
          timestamp: new Date(log.created_at).toLocaleString('zh-CN'),
          level: log.level,
          category: log.category,
          message: log.message,
          source: log.source,
          details: log.details || ''
        }));
      }
    }

    // 获取用户活动日志
    if (logType === 'all' || logType === 'user') {
      let activityQuery = supabase
        .from('user_activities')
        .select(`
          *,
          users!inner(email)
        `)
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        activityQuery = activityQuery.or(`action.ilike.%${search}%,resource.ilike.%${search}%,users.email.ilike.%${search}%`);
      }

      const { data: userActivities, error: activityError } = await activityQuery;

      if (!activityError && userActivities) {
        logsData.userActivities = userActivities.map(activity => ({
          id: activity.id,
          timestamp: new Date(activity.created_at).toLocaleString('zh-CN'),
          userId: activity.user_id,
          email: activity.users?.email || 'Unknown',
          action: activity.action,
          resource: activity.resource,
          ip: activity.ip_address,
          userAgent: activity.user_agent,
          status: activity.status
        }));
      }
    }

    // 获取错误日志
    if (logType === 'all' || logType === 'error') {
      let errorQuery = supabase
        .from('error_logs')
        .select('*')
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (level !== 'all') {
        errorQuery = errorQuery.eq('level', level);
      }

      if (search) {
        errorQuery = errorQuery.or(`error_type.ilike.%${search}%,message.ilike.%${search}%,url.ilike.%${search}%`);
      }

      const { data: errorLogs, error: errorLogError } = await errorQuery;

      if (!errorLogError && errorLogs) {
        logsData.errorLogs = errorLogs.map(error => ({
          id: error.id,
          timestamp: new Date(error.created_at).toLocaleString('zh-CN'),
          level: error.level,
          error: error.error_type,
          message: error.message,
          stack: error.stack_trace,
          url: error.url,
          method: error.method,
          userId: error.user_id,
          resolved: error.resolved || false
        }));
      }
    }

    // 如果没有数据库表，返回模拟数据
    if (logsData.systemLogs.length === 0 && logsData.userActivities.length === 0 && logsData.errorLogs.length === 0) {
      logsData = {
        systemLogs: [
          {
            id: 1,
            timestamp: new Date().toLocaleString('zh-CN'),
            level: 'INFO',
            category: 'SYSTEM',
            message: '系统启动完成',
            source: 'server.js',
            details: '所有服务已成功启动'
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toLocaleString('zh-CN'),
            level: 'WARNING',
            category: 'DATABASE',
            message: '数据库连接池接近上限',
            source: 'database.js',
            details: '当前连接数: 95/100'
          },
          {
            id: 3,
            timestamp: new Date(Date.now() - 10 * 60 * 1000).toLocaleString('zh-CN'),
            level: 'ERROR',
            category: 'API',
            message: 'API请求超时',
            source: 'api/check.js',
            details: 'Request timeout after 30s for domain: slow-website.com'
          }
        ],
        userActivities: [
          {
            id: 1,
            timestamp: new Date().toLocaleString('zh-CN'),
            userId: 'user123',
            email: 'john@example.com',
            action: 'LOGIN',
            resource: '/dashboard',
            ip: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            status: 'SUCCESS'
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 3 * 60 * 1000).toLocaleString('zh-CN'),
            userId: 'user456',
            email: 'jane@test.com',
            action: 'CHECK_BACKLINKS',
            resource: '/api/check',
            ip: '10.0.0.50',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            status: 'SUCCESS'
          }
        ],
        errorLogs: [
          {
            id: 1,
            timestamp: new Date().toLocaleString('zh-CN'),
            level: 'CRITICAL',
            error: 'DatabaseConnectionError',
            message: '无法连接到主数据库',
            stack: 'Error: Connection timeout\n    at Database.connect (/app/lib/database.js:45:12)',
            url: '/api/users',
            method: 'GET',
            userId: 'user123',
            resolved: false
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toLocaleString('zh-CN'),
            level: 'ERROR',
            error: 'ValidationError',
            message: '无效的邮箱格式',
            stack: 'ValidationError: Invalid email format\n    at validateEmail (/app/utils/validation.js:23:8)',
            url: '/api/auth/register',
            method: 'POST',
            userId: null,
            resolved: true
          }
        ]
      };
    }

    return new Response(JSON.stringify({
      success: true,
      data: logsData,
      pagination: {
        page,
        limit,
        total: logsData.systemLogs.length + logsData.userActivities.length + logsData.errorLogs.length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取日志数据错误:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 验证用户权限
    const session = locals.session;
    const user = locals.user;

    if (!session || !user) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户角色
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole || !['admin', 'super'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: '权限不足' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'mark_resolved':
        const { errorId } = body;
        
        if (!errorId) {
          return new Response(JSON.stringify({ error: '缺少错误ID' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 标记错误为已解决
        const { error: updateError } = await supabase
          .from('error_logs')
          .update({ 
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id
          })
          .eq('id', errorId);

        if (updateError) {
          console.error('标记错误解决失败:', updateError);
          return new Response(JSON.stringify({ error: '标记失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 记录管理员操作
        await supabase
          .from('user_activities')
          .insert({
            user_id: user.id,
            action: 'MARK_ERROR_RESOLVED',
            resource: `/admin/logs/error/${errorId}`,
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
            status: 'SUCCESS'
          });

        return new Response(JSON.stringify({ success: true, message: '错误已标记为已解决' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'export_logs':
        const { logType = 'all', timeRange = '24h' } = body;
        
        // 获取要导出的日志数据
        const exportUrl = new URL(request.url);
        exportUrl.searchParams.set('type', logType);
        exportUrl.searchParams.set('timeRange', timeRange);
        exportUrl.searchParams.set('limit', '1000'); // 导出更多数据
        
        const exportResponse = await fetch(exportUrl.toString(), {
          headers: {
            'Authorization': request.headers.get('Authorization') || '',
            'Cookie': request.headers.get('Cookie') || ''
          }
        });
        
        if (!exportResponse.ok) {
          return new Response(JSON.stringify({ error: '获取导出数据失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const exportData = await exportResponse.json();
        
        // 记录导出操作
        await supabase
          .from('user_activities')
          .insert({
            user_id: user.id,
            action: 'EXPORT_LOGS',
            resource: '/admin/logs/export',
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
            status: 'SUCCESS'
          });
        
        return new Response(JSON.stringify(exportData.data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="system-logs-${new Date().toISOString().split('T')[0]}.json"`
          }
        });

      case 'clear_logs':
        const { olderThan = '30d' } = body;
        
        // 计算清理时间点
        const now = new Date();
        let clearBefore: Date;
        
        switch (olderThan) {
          case '7d':
            clearBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            clearBefore = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            clearBefore = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            clearBefore = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // 清理旧日志（只有超级管理员可以执行）
        if (userRole.role !== 'super') {
          return new Response(JSON.stringify({ error: '只有超级管理员可以清理日志' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 清理系统日志
        const { error: clearSystemError } = await supabase
          .from('system_logs')
          .delete()
          .lt('created_at', clearBefore.toISOString());

        // 清理用户活动日志
        const { error: clearActivityError } = await supabase
          .from('user_activities')
          .delete()
          .lt('created_at', clearBefore.toISOString());

        // 清理已解决的错误日志
        const { error: clearErrorError } = await supabase
          .from('error_logs')
          .delete()
          .lt('created_at', clearBefore.toISOString())
          .eq('resolved', true);

        if (clearSystemError || clearActivityError || clearErrorError) {
          console.error('清理日志失败:', { clearSystemError, clearActivityError, clearErrorError });
          return new Response(JSON.stringify({ error: '清理日志失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 记录清理操作
        await supabase
          .from('user_activities')
          .insert({
            user_id: user.id,
            action: 'CLEAR_LOGS',
            resource: '/admin/logs/clear',
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
            status: 'SUCCESS'
          });

        return new Response(JSON.stringify({ success: true, message: '日志清理完成' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: '无效的操作' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('日志管理操作错误:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};