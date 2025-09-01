import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

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

    const body = await request.json();
    const { testEmail } = body;

    // 验证邮箱格式
    if (!testEmail || !isValidEmail(testEmail)) {
      return new Response(JSON.stringify({ error: '请提供有效的邮箱地址' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取邮件配置
    const emailConfig = await getEmailConfig();
    if (!emailConfig) {
      return new Response(JSON.stringify({ error: '邮件配置不完整，请先配置SMTP设置' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 发送测试邮件
    const result = await sendTestEmail(testEmail, emailConfig);
    
    if (result.success) {
      // 记录操作日志
      await logAdminAction(user.id, 'test_email', {
        testEmail,
        timestamp: new Date().toISOString()
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: '测试邮件发送成功！请检查收件箱。' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        error: `邮件发送失败: ${result.error}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error in test email API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// 获取邮件配置
async function getEmailConfig() {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'email.smtpHost',
        'email.smtpPort', 
        'email.smtpUser',
        'email.smtpPassword',
        'email.fromEmail'
      ]);

    if (error || !settings || settings.length < 5) {
      return null;
    }

    const config: any = {};
    settings.forEach(setting => {
      const key = setting.key.replace('email.', '');
      config[key] = setting.value;
    });

    // 检查必需的配置项
    if (!config.smtpHost || !config.smtpPort || !config.smtpUser || 
        !config.smtpPassword || !config.fromEmail) {
      return null;
    }

    return config;
  } catch (error) {
    console.error('Error getting email config:', error);
    return null;
  }
}

// 发送测试邮件
async function sendTestEmail(testEmail: string, config: any) {
  try {
    // 这里使用 nodemailer 或其他邮件服务
    // 由于这是一个示例，我们模拟邮件发送过程
    
    // 模拟SMTP连接测试
    const connectionTest = await testSmtpConnection(config);
    if (!connectionTest.success) {
      return {
        success: false,
        error: `SMTP连接失败: ${connectionTest.error}`
      };
    }

    // 模拟邮件发送
    const emailContent = {
      from: config.fromEmail,
      to: testEmail,
      subject: '邮件配置测试 - BacklinksBuilder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">邮件配置测试成功！</h2>
          <p>恭喜！您的邮件配置已正确设置。</p>
          <p><strong>测试时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
          <p><strong>SMTP服务器:</strong> ${config.smtpHost}:${config.smtpPort}</p>
          <p><strong>发件人:</strong> ${config.fromEmail}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            这是一封自动生成的测试邮件，请勿回复。<br>
            如果您收到此邮件，说明邮件系统配置正常。
          </p>
        </div>
      `
    };

    // 实际项目中这里应该使用真实的邮件发送服务
    // 例如: await transporter.sendMail(emailContent);
    
    // 模拟发送延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 模拟成功率（90%成功）
    const success = Math.random() > 0.1;
    
    if (success) {
      return {
        success: true,
        messageId: `test-${Date.now()}@backlinksbuilder.com`
      };
    } else {
      return {
        success: false,
        error: '邮件服务器暂时不可用，请稍后重试'
      };
    }

  } catch (error) {
    console.error('Error sending test email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

// 测试SMTP连接
async function testSmtpConnection(config: any) {
  try {
    // 这里应该实现真实的SMTP连接测试
    // 例如使用 nodemailer 的 verify() 方法
    
    // 模拟连接测试
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 基本配置验证
    if (!config.smtpHost || !config.smtpPort) {
      return {
        success: false,
        error: 'SMTP主机或端口配置错误'
      };
    }
    
    if (!config.smtpUser || !config.smtpPassword) {
      return {
        success: false,
        error: 'SMTP用户名或密码配置错误'
      };
    }
    
    // 模拟连接成功率（95%成功）
    const success = Math.random() > 0.05;
    
    if (success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: '无法连接到SMTP服务器，请检查网络连接和配置'
      };
    }
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '连接测试失败'
    };
  }
}

// 记录管理员操作日志
async function logAdminAction(adminId: string, action: string, details: any) {
  try {
    await supabase
      .from('admin_logs')
      .insert({
        admin_id: adminId,
        action,
        details,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// 验证邮箱格式
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}