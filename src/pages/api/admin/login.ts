import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { username, password } = await request.json();
    
    // 从环境变量获取管理员账号密码
    const adminUsername = import.meta.env.ADMIN_USERNAME || process.env.ADMIN_USERNAME;
    const adminPassword = import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    
    // 验证账号密码
    if (username === adminUsername && password === adminPassword) {
      return new Response(JSON.stringify({
        success: true,
        message: '登录成功'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: '用户名或密码错误'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Login API error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '服务器错误'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};