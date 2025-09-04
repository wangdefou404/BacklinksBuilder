import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

// 创建具有service role权限的supabase客户端，用于管理员操作绕过RLS
const supabaseAdmin = createClient(
  'https://fmkekjlsfnvubnvurhbt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZta2VramxzZm52dWJudnVyaGJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI2NzU0NCwiZXhwIjoyMDY4ODQzNTQ0fQ.fcRzWgH972dC5r65kSKQbTBWlvE-L3Osk2UQgvsjYn0'
);

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 验证用户是否已登录
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

    // 获取URL参数
    const url = new URL(request.url);
    const backlinkId = url.searchParams.get('backlinkId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const drFilter = url.searchParams.get('dr') || '';
    const trafficFilter = url.searchParams.get('traffic') || '';
    const paymentFilter = url.searchParams.get('payment') || '';
    const followFilter = url.searchParams.get('follow') || '';
    const platformFilter = url.searchParams.get('platform') || '';
    const accessFilter = url.searchParams.get('access') || '';
    const sortBy = url.searchParams.get('sortBy') || 'updated_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // 如果提供了backlinkId，返回单个外链
    if (backlinkId) {
      const { data: backlink, error: backlinkError } = await supabaseAdmin
        .from('backlink_resources')
        .select(`
          id,
          name,
          website_link,
          dr,
          traffic,
          payment_type,
          follow_type,
          platform_type,
          access_type,
          submit_url,
          created_at,
          updated_at,
          status
        `)
        .eq('id', backlinkId)
        .single();

      if (backlinkError) {
        console.error('获取反向链接失败:', backlinkError);
        return new Response(JSON.stringify({ error: '获取反向链接失败' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        backlink: backlink,
        backlinks: backlink ? [backlink] : [],
        total: backlink ? 1 : 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 构建查询 - 管理员可以查看所有外链
    let query = supabaseAdmin
      .from('backlink_resources')
      .select(`
        id,
        name,
        website_link,
        dr,
        traffic,
        payment_type,
        follow_type,
        platform_type,
        access_type,
        submit_url,
        anchor_text,
        target_url,
        notes,
        created_at,
        updated_at,
        status,
        user_id
      `);

    // 添加搜索条件
    if (search) {
      query = query.or(`name.ilike.%${search}%,website_link.ilike.%${search}%,anchor_text.ilike.%${search}%,target_url.ilike.%${search}%`);
    }

    // 添加筛选条件
    if (drFilter) {
      const [min, max] = drFilter.split('-').map(Number);
      if (max) {
        query = query.gte('dr', min).lte('dr', max);
      } else {
        query = query.gte('dr', min);
      }
    }

    if (trafficFilter) {
      const [min, max] = trafficFilter.split('-').map(Number);
      if (max) {
        query = query.gte('traffic', min).lte('traffic', max);
      } else {
        query = query.gte('traffic', min);
      }
    }

    if (paymentFilter) {
      query = query.eq('payment_type', paymentFilter);
    }

    if (followFilter) {
      query = query.eq('follow_type', followFilter);
    }

    if (platformFilter) {
      query = query.eq('platform_type', platformFilter);
    }

    if (accessFilter) {
      query = query.eq('access_type', accessFilter);
    }

    // 获取总数
    const { count: totalCount } = await query
      .select('*', { count: 'exact', head: true });

    // 获取分页数据
    const { data: backlinks, error: backlinksError } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * limit, page * limit - 1);

    if (backlinksError) {
      console.error('获取反向链接列表失败:', backlinksError);
      return new Response(JSON.stringify({ error: '获取反向链接列表失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 转换字段名以匹配前端期望，使用与前端API相同的格式化逻辑
    const formattedBacklinks = (backlinks || []).map(backlink => ({
      id: backlink.id,
      name: backlink.name,
      website_link: backlink.website_link,
      dr: backlink.dr || 0,
      traffic: backlink.traffic || 0,
      payment_type: backlink.payment_type?.toLowerCase() === 'free' ? 'Free' : 'Paid',
      follow_type: backlink.follow_type?.toLowerCase() === 'dofollow' ? 'DoFollow' : 'NoFollow',
      platform_type: backlink.platform_type || 'blog',
      access_type: backlink.access_type || 'public',
      submit_url: backlink.submit_url,
      anchor_text: backlink.anchor_text,
      target_url: backlink.target_url,
      notes: backlink.notes,
      created_at: backlink.created_at,
      updated_at: backlink.updated_at,
      status: backlink.status
    }));

    return new Response(JSON.stringify({
      success: true,
      backlinks: formattedBacklinks,
      total: totalCount || 0,
      page,
      limit,
      totalPages: Math.ceil((totalCount || 0) / limit),
      hasMore: page * limit < (totalCount || 0)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('反向链接管理API错误:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 验证用户是否已登录
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

    const { action, backlinkId, data } = await request.json();

    switch (action) {
      case 'create':
        // 创建新反向链接
        const {
          name,
          website_link,
          dr,
          traffic,
          payment_type,
          follow_type,
          platform_type,
          access_type,
          submit_url
        } = data;
        
        // 使用supabaseAdmin绕过RLS限制
        const { data: newBacklink, error: createError } = await supabaseAdmin
          .from('backlink_resources')
          .insert({
            user_id: user.id,
            name: name,
            website_link: website_link,
            submit_url: submit_url,
            dr: dr || 0,
            traffic: traffic || 0,
            payment_type: payment_type || 'free',
            follow_type: follow_type || 'dofollow',
            platform_type: platform_type || 'blog',
            access_type: access_type || 'public',
            status: 'active'
          })
          .select()
          .single();

        if (createError) {
          console.error('创建反向链接失败:', createError);
          return new Response(JSON.stringify({ error: '创建反向链接失败: ' + createError.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, backlink: newBacklink }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'update':
        // 更新反向链接信息
        const updateData = {
          name: data.name,
          website_link: data.website_link,
          submit_url: data.submit_url,
          dr: data.dr || 0,
          traffic: data.traffic || 0,
          payment_type: data.payment_type || 'free',
          follow_type: data.follow_type || 'dofollow',
          platform_type: data.platform_type || 'blog',
          access_type: data.access_type || 'public',
          anchor_text: data.anchor_text,
          target_url: data.target_url,
          notes: data.notes,
          updated_at: new Date().toISOString()
        };
        
        const { data: updatedBacklink, error: updateError } = await supabaseAdmin
          .from('backlink_resources')
          .update(updateData)
          .eq('id', backlinkId)
          .select()
          .single();

        if (updateError) {
          console.error('更新反向链接失败:', updateError);
          return new Response(JSON.stringify({ error: '更新反向链接失败: ' + updateError.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, backlink: updatedBacklink }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'delete':
        // 删除反向链接
        const { error: deleteError } = await supabaseAdmin
          .from('backlink_resources')
          .delete()
          .eq('id', backlinkId);

        if (deleteError) {
          console.error('删除反向链接失败:', deleteError);
          return new Response(JSON.stringify({ error: '删除反向链接失败: ' + deleteError.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'toggle_status':
        // 切换反向链接状态
        const { status } = data;
        
        const { error: statusError } = await supabaseAdmin
          .from('backlink_resources')
          .update({ 
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', backlinkId);

        if (statusError) {
          console.error('更新反向链接状态失败:', statusError);
          return new Response(JSON.stringify({ error: '更新状态失败: ' + statusError.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'batch_create':
        // CSV批量创建反向链接
        const batchData = data; // data应该是一个包含多个反向链接对象的数组
        const batchResults = [];
        let createdCount = 0;
        let failedCount = 0;

        for (const item of batchData) {
          try {
            const { data: newBacklink, error: batchCreateError } = await supabaseAdmin
              .from('backlink_resources')
              .insert({
                user_id: user.id,
                name: item.name,
                website_link: item.website_link,
                submit_url: item.submit_url || '',
                dr: parseInt(item.dr) || 0,
                traffic: parseInt(item.traffic) || 0,
                payment_type: item.payment_type || 'Free',
                follow_type: item.follow_type || 'DoFollow',
                platform_type: item.platform_type || 'blog',
                access_type: item.access_type || 'guest',
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();

            if (batchCreateError) {
              console.error('批量创建单项失败:', batchCreateError);
              batchResults.push({ 
                item: item.name, 
                success: false, 
                error: batchCreateError.message 
              });
              failedCount++;
            } else {
              batchResults.push({ 
                item: item.name, 
                success: true, 
                backlink: newBacklink 
              });
              createdCount++;
            }
          } catch (error) {
            console.error('批量创建异常:', error);
            batchResults.push({ 
              item: item.name || 'Unknown', 
              success: false, 
              error: error.message 
            });
            failedCount++;
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          created: createdCount,
          failed: failedCount,
          results: batchResults 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'batch':
        // 批量操作
        const { backlinkIds, batchAction } = data;
        const results = [];

        for (const id of backlinkIds) {
          try {
            switch (batchAction) {
              case 'activate':
                await supabaseAdmin
                  .from('backlink_resources')
                  .update({ 
                    status: 'active',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', id);
                break;
              case 'deactivate':
                await supabaseAdmin
                  .from('backlink_resources')
                  .update({ 
                    status: 'inactive',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', id);
                break;
              case 'delete':
                await supabaseAdmin
                  .from('backlink_resources')
                  .delete()
                  .eq('id', id);
                break;
            }
            results.push({ backlinkId: id, success: true });
          } catch (error) {
            results.push({ backlinkId: id, success: false, error: error.message });
          }
        }

        return new Response(JSON.stringify({ success: true, results }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'stats':
        // 获取统计信息
        const { data: stats } = await supabase
          .from('backlink_resources')
          .select('status, payment_type, follow_type, platform_type')
          .eq('user_id', user.id)
          .then(({ data }) => {
            if (!data) return { data: null };
            
            const totalCount = data.length;
            const activeCount = data.filter(b => b.status === 'active').length;
            const inactiveCount = data.filter(b => b.status === 'inactive').length;
            
            const paymentStats = data.reduce((acc, b) => {
              acc[b.payment_type] = (acc[b.payment_type] || 0) + 1;
              return acc;
            }, {});
            
            const followStats = data.reduce((acc, b) => {
              acc[b.follow_type] = (acc[b.follow_type] || 0) + 1;
              return acc;
            }, {});
            
            const platformStats = data.reduce((acc, b) => {
              acc[b.platform_type] = (acc[b.platform_type] || 0) + 1;
              return acc;
            }, {});
            
            return {
              data: {
                total: totalCount,
                active: activeCount,
                inactive: inactiveCount,
                payment: paymentStats,
                follow: followStats,
                platform: platformStats
              }
            };
          });

        return new Response(JSON.stringify({ success: true, stats }), {
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
    console.error('反向链接管理操作错误:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};