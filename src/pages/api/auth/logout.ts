import type { APIRoute } from 'astro';
import { signOut } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  console.log('=== 收到退出登录API请求 ===');
  console.log('请求方法:', request.method);
  console.log('请求URL:', request.url);
  console.log('请求头:', Object.fromEntries(request.headers.entries()));
  
  try {
    console.log('调用signOut函数...');
    await signOut();
    console.log('signOut函数执行成功');
    
    const successResponse = {
      success: true,
      message: '登出成功'
    };
    
    console.log('=== 退出登录API成功 ===');
    console.log('响应内容:', successResponse);
    
    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('=== 退出登录API失败 ===');
    console.error('错误详情:', error);
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
    
    const errorResponse = {
      success: false,
      error: '登出失败',
      details: error.message
    };
    
    console.log('错误响应内容:', errorResponse);
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};