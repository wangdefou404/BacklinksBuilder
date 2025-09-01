import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    // 验证管理员权限
    const session = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user;
    try {
      user = JSON.parse(decodeURIComponent(session));
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取系统设置
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('*');

    if (error) {
      console.error('Error fetching system settings:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch system settings' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 将设置转换为键值对格式
    const settingsMap: Record<string, any> = {};
    if (settings) {
      settings.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });
    }

    return new Response(JSON.stringify(settingsMap), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in system settings GET API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    // 验证管理员权限
    const session = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user;
    try {
      user = JSON.parse(decodeURIComponent(session));
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { category, settings } = await request.json();

    if (!category || !settings) {
      return new Response(JSON.stringify({ error: 'Category and settings are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证设置类别
    const validCategories = ['system', 'email', 'security', 'backup'];
    if (!validCategories.includes(category)) {
      return new Response(JSON.stringify({ error: 'Invalid category' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 根据类别验证设置
    const validationResult = validateSettings(category, settings);
    if (!validationResult.valid) {
      return new Response(JSON.stringify({ error: validationResult.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 保存设置
    const settingsToSave = [];
    for (const [key, value] of Object.entries(settings)) {
      settingsToSave.push({
        key: `${category}.${key}`,
        value: value,
        category: category,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      });
    }

    // 使用 upsert 来插入或更新设置
    const { error: upsertError } = await supabase
      .from('system_settings')
      .upsert(settingsToSave, {
        onConflict: 'key'
      });

    if (upsertError) {
      console.error('Error saving system settings:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save system settings' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 记录管理员操作日志
    await supabase
      .from('admin_logs')
      .insert({
        admin_id: user.id,
        action: 'update_system_settings',
        target_type: 'system_settings',
        target_id: category,
        details: {
          category,
          settings: Object.keys(settings)
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      });

    return new Response(JSON.stringify({ message: 'Settings saved successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in system settings POST API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// 验证设置函数
function validateSettings(category: string, settings: Record<string, any>): { valid: boolean; error?: string } {
  switch (category) {
    case 'system':
      return validateSystemSettings(settings);
    case 'email':
      return validateEmailSettings(settings);
    case 'security':
      return validateSecuritySettings(settings);
    case 'backup':
      return validateBackupSettings(settings);
    default:
      return { valid: false, error: 'Invalid category' };
  }
}

// 验证系统设置
function validateSystemSettings(settings: Record<string, any>): { valid: boolean; error?: string } {
  const { siteName, siteDescription, maintenanceMode, allowRegistration } = settings;

  if (siteName !== undefined && (typeof siteName !== 'string' || siteName.length > 100)) {
    return { valid: false, error: 'Site name must be a string with max 100 characters' };
  }

  if (siteDescription !== undefined && (typeof siteDescription !== 'string' || siteDescription.length > 500)) {
    return { valid: false, error: 'Site description must be a string with max 500 characters' };
  }

  if (maintenanceMode !== undefined && typeof maintenanceMode !== 'boolean') {
    return { valid: false, error: 'Maintenance mode must be a boolean' };
  }

  if (allowRegistration !== undefined && typeof allowRegistration !== 'boolean') {
    return { valid: false, error: 'Allow registration must be a boolean' };
  }

  return { valid: true };
}

// 验证邮件设置
function validateEmailSettings(settings: Record<string, any>): { valid: boolean; error?: string } {
  const { smtpHost, smtpPort, fromEmail, emailUsername, emailPassword } = settings;

  if (smtpHost !== undefined && (typeof smtpHost !== 'string' || smtpHost.length === 0)) {
    return { valid: false, error: 'SMTP host is required' };
  }

  if (smtpPort !== undefined && (typeof smtpPort !== 'number' || smtpPort < 1 || smtpPort > 65535)) {
    return { valid: false, error: 'SMTP port must be a valid port number' };
  }

  if (fromEmail !== undefined && (typeof fromEmail !== 'string' || !isValidEmail(fromEmail))) {
    return { valid: false, error: 'From email must be a valid email address' };
  }

  if (emailUsername !== undefined && (typeof emailUsername !== 'string' || emailUsername.length === 0)) {
    return { valid: false, error: 'Email username is required' };
  }

  if (emailPassword !== undefined && (typeof emailPassword !== 'string' || emailPassword.length === 0)) {
    return { valid: false, error: 'Email password is required' };
  }

  return { valid: true };
}

// 验证安全设置
function validateSecuritySettings(settings: Record<string, any>): { valid: boolean; error?: string } {
  const { minPasswordLength, sessionTimeout, maxLoginAttempts, force2FA } = settings;

  if (minPasswordLength !== undefined && (typeof minPasswordLength !== 'number' || minPasswordLength < 6 || minPasswordLength > 20)) {
    return { valid: false, error: 'Minimum password length must be between 6 and 20' };
  }

  if (sessionTimeout !== undefined && (typeof sessionTimeout !== 'number' || sessionTimeout < 1 || sessionTimeout > 168)) {
    return { valid: false, error: 'Session timeout must be between 1 and 168 hours' };
  }

  if (maxLoginAttempts !== undefined && (typeof maxLoginAttempts !== 'number' || maxLoginAttempts < 3 || maxLoginAttempts > 10)) {
    return { valid: false, error: 'Max login attempts must be between 3 and 10' };
  }

  if (force2FA !== undefined && typeof force2FA !== 'boolean') {
    return { valid: false, error: 'Force 2FA must be a boolean' };
  }

  return { valid: true };
}

// 验证备份设置
function validateBackupSettings(settings: Record<string, any>): { valid: boolean; error?: string } {
  const { autoBackup, backupFrequency, backupRetention } = settings;

  if (autoBackup !== undefined && typeof autoBackup !== 'boolean') {
    return { valid: false, error: 'Auto backup must be a boolean' };
  }

  if (backupFrequency !== undefined && !['daily', 'weekly', 'monthly'].includes(backupFrequency)) {
    return { valid: false, error: 'Backup frequency must be daily, weekly, or monthly' };
  }

  if (backupRetention !== undefined && (typeof backupRetention !== 'number' || backupRetention < 7 || backupRetention > 365)) {
    return { valid: false, error: 'Backup retention must be between 7 and 365 days' };
  }

  return { valid: true };
}

// 验证邮箱格式
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}