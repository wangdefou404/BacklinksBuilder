import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    // 验证用户权限
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取系统设置
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('获取系统设置错误:', error);
      return new Response(JSON.stringify({ error: '获取设置失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 如果没有设置记录，返回默认设置
    const defaultSettings = {
      site_name: 'BacklinksBuilder',
      site_description: '专业的外链建设工具',
      site_url: 'https://backlinksbuilder.com',
      admin_email: 'admin@backlinksbuilder.com',
      support_email: 'support@backlinksbuilder.com',
      max_users: 10000,
      max_checks_per_day: 100,
      enable_registration: true,
      enable_email_verification: true,
      enable_two_factor: false,
      session_timeout: 24,
      password_min_length: 8,
      max_login_attempts: 5,
      lockout_duration: 30,
      smtp_host: '',
      smtp_port: 587,
      smtp_username: '',
      smtp_password: '',
      smtp_encryption: 'tls',
      backup_enabled: true,
      backup_frequency: 'daily',
      backup_retention: 30,
      maintenance_mode: false,
      debug_mode: false,
      analytics_enabled: true,
      cache_enabled: true,
      cdn_enabled: false
    };

    return new Response(JSON.stringify({ 
      success: true, 
      settings: settings || defaultSettings 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('系统设置API错误:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, settings } = body;

    // 验证用户权限
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'update':
        return await updateSettings(settings);
      case 'test_email':
        return await testEmailConnection(settings);
      case 'clear_cache':
        return await clearCache();
      case 'export_data':
        return await exportSystemData();
      default:
        return new Response(JSON.stringify({ error: '无效的操作' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('系统设置API错误:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// 更新系统设置
async function updateSettings(settings: any) {
  try {
    // 验证设置数据
    const validatedSettings = validateSettings(settings);
    if (!validatedSettings.valid) {
      return new Response(JSON.stringify({ error: validatedSettings.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查是否已存在设置记录
    const { data: existingSettings } = await supabase
      .from('system_settings')
      .select('id')
      .single();

    let result;
    if (existingSettings) {
      // 更新现有设置
      result = await supabase
        .from('system_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSettings.id);
    } else {
      // 创建新设置记录
      result = await supabase
        .from('system_settings')
        .insert({
          ...settings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    if (result.error) {
      console.error('更新系统设置错误:', result.error);
      return new Response(JSON.stringify({ error: '更新设置失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 记录操作日志
    await supabase
      .from('admin_logs')
      .insert({
        action: 'update_system_settings',
        details: { updated_fields: Object.keys(settings) },
        created_at: new Date().toISOString()
      });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('更新设置错误:', error);
    return new Response(JSON.stringify({ error: '更新失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 测试邮件连接
async function testEmailConnection(emailSettings: any) {
  try {
    // 这里应该实现实际的SMTP连接测试
    // 由于这是演示代码，我们模拟测试结果
    const { smtp_host, smtp_port, smtp_username, smtp_password } = emailSettings;
    
    if (!smtp_host || !smtp_username) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'SMTP服务器和用户名不能为空' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 模拟连接测试（实际应用中需要使用nodemailer等库）
    const isValidHost = smtp_host.includes('.');
    const isValidPort = smtp_port >= 1 && smtp_port <= 65535;
    
    if (!isValidHost || !isValidPort) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'SMTP服务器配置无效' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 记录测试日志
    await supabase
      .from('admin_logs')
      .insert({
        action: 'test_email_connection',
        details: { smtp_host, smtp_port },
        created_at: new Date().toISOString()
      });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('测试邮件连接错误:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: '连接测试失败' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 清除缓存
async function clearCache() {
  try {
    // 这里应该实现实际的缓存清除逻辑
    // 由于这是演示代码，我们模拟清除操作
    
    // 记录操作日志
    await supabase
      .from('admin_logs')
      .insert({
        action: 'clear_cache',
        details: { cache_type: 'all' },
        created_at: new Date().toISOString()
      });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('清除缓存错误:', error);
    return new Response(JSON.stringify({ error: '清除缓存失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 导出系统数据
async function exportSystemData() {
  try {
    // 获取系统统计数据
    const { data: users } = await supabase
      .from('users')
      .select('id, email, created_at, role')
      .order('created_at', { ascending: false });

    const { data: checks } = await supabase
      .from('backlink_checks')
      .select('id, url, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .single();

    const exportData = {
      export_date: new Date().toISOString(),
      version: '2.1.0',
      statistics: {
        total_users: users?.length || 0,
        total_checks: checks?.length || 0
      },
      users: users || [],
      recent_checks: checks || [],
      settings: settings || {}
    };

    // 记录导出日志
    await supabase
      .from('admin_logs')
      .insert({
        action: 'export_system_data',
        details: { 
          users_count: users?.length || 0,
          checks_count: checks?.length || 0
        },
        created_at: new Date().toISOString()
      });

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="system-data-${new Date().toISOString().split('T')[0]}.json"`
      }
    });

  } catch (error) {
    console.error('导出数据错误:', error);
    return new Response(JSON.stringify({ error: '导出数据失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 验证设置数据
function validateSettings(settings: any) {
  const errors = [];

  // 验证基本设置
  if (!settings.site_name || settings.site_name.trim().length === 0) {
    errors.push('网站名称不能为空');
  }

  if (settings.site_name && settings.site_name.length > 100) {
    errors.push('网站名称不能超过100个字符');
  }

  if (!settings.admin_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.admin_email)) {
    errors.push('管理员邮箱格式无效');
  }

  if (!settings.support_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.support_email)) {
    errors.push('客服邮箱格式无效');
  }

  // 验证数值设置
  if (settings.max_users && (settings.max_users < 1 || settings.max_users > 1000000)) {
    errors.push('最大用户数必须在1-1000000之间');
  }

  if (settings.max_checks_per_day && (settings.max_checks_per_day < 1 || settings.max_checks_per_day > 10000)) {
    errors.push('每日最大检查次数必须在1-10000之间');
  }

  // 验证安全设置
  if (settings.session_timeout && (settings.session_timeout < 1 || settings.session_timeout > 168)) {
    errors.push('会话超时时间必须在1-168小时之间');
  }

  if (settings.password_min_length && (settings.password_min_length < 6 || settings.password_min_length > 32)) {
    errors.push('密码最小长度必须在6-32字符之间');
  }

  if (settings.max_login_attempts && (settings.max_login_attempts < 3 || settings.max_login_attempts > 10)) {
    errors.push('最大登录尝试次数必须在3-10次之间');
  }

  if (settings.lockout_duration && (settings.lockout_duration < 5 || settings.lockout_duration > 1440)) {
    errors.push('锁定时长必须在5-1440分钟之间');
  }

  // 验证SMTP设置
  if (settings.smtp_port && (settings.smtp_port < 1 || settings.smtp_port > 65535)) {
    errors.push('SMTP端口必须在1-65535之间');
  }

  // 验证备份设置
  if (settings.backup_retention && (settings.backup_retention < 1 || settings.backup_retention > 365)) {
    errors.push('备份保留天数必须在1-365天之间');
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : null
  };
}