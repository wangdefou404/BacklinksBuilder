import type { APIRoute } from 'astro';
import type { BacklinkResource } from '../../../types/backlinks';

// 这里应该从数据库获取数据，现在使用模拟数据
// 注意：在实际应用中，这个数据应该与 index.ts 中的数据共享同一个数据源
let mockBacklinks: BacklinkResource[] = [];

// 初始化模拟数据（与index.ts保持一致）
if (mockBacklinks.length === 0) {
  mockBacklinks = [
    {
      id: '1',
      name: 'AI Valley',
      websiteLink: 'https://aivalley.ai',
      dr: 29,
      traffic: 132378,
      paymentType: 'Free',
      followType: 'NoFollow',
      platformType: 'Directory',
      updated: '2025-08-20',
      featured: true,
      tags: ['AI', 'Tools', 'Directory'],
      submissionUrl: 'https://aivalley.ai/submit',
      requirements: 'AI-related tools and services only',
      approvalTime: '2-3 days',
      contactEmail: 'submit@aivalley.ai'
    },
    // 添加更多模拟数据...
  ];
  
  // 生成更多模拟数据
  for (let i = 2; i <= 60; i++) {
    mockBacklinks.push({
      id: i.toString(),
      name: `Resource ${i}`,
      websiteLink: `https://example${i}.com`,
      dr: Math.floor(Math.random() * 80) + 20,
      traffic: Math.floor(Math.random() * 1000000) + 10000,
      paymentType: ['Free', 'Paid'][Math.floor(Math.random() * 2)] as any,
      followType: ['DoFollow', 'NoFollow'][Math.floor(Math.random() * 2)] as any,
      platformType: ['Directory', 'Blog', 'Forum', 'Social', 'News', 'Other'][Math.floor(Math.random() * 6)] as any,
      updated: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      featured: Math.random() > 0.7,
      tags: ['SEO', 'Marketing', 'Business'],
      submissionUrl: `https://example${i}.com/submit`,
      requirements: 'Quality content required',
      approvalTime: `${Math.floor(Math.random() * 7) + 1} days`,
      contactEmail: `contact@example${i}.com`
    });
  }
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID parameter is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const backlink = mockBacklinks.find(item => item.id === id);
    
    if (!backlink) {
      return new Response(JSON.stringify({ error: 'Backlink not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    return new Response(JSON.stringify(backlink), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching backlink:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID parameter is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const updateData: Partial<BacklinkResource> = await request.json();
    const backlinkIndex = mockBacklinks.findIndex(item => item.id === id);
    
    if (backlinkIndex === -1) {
      return new Response(JSON.stringify({ error: 'Backlink not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // 更新backlink
    mockBacklinks[backlinkIndex] = {
      ...mockBacklinks[backlinkIndex],
      ...updateData,
      id, // 确保ID不被更改
      updated: new Date().toISOString().split('T')[0] // 更新时间戳
    };
    
    return new Response(JSON.stringify(mockBacklinks[backlinkIndex]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating backlink:', error);
    return new Response(JSON.stringify({ error: 'Invalid request data' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID parameter is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const backlinkIndex = mockBacklinks.findIndex(item => item.id === id);
    
    if (backlinkIndex === -1) {
      return new Response(JSON.stringify({ error: 'Backlink not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // 删除backlink
    const deletedBacklink = mockBacklinks.splice(backlinkIndex, 1)[0];
    
    return new Response(JSON.stringify({ 
      message: 'Backlink deleted successfully',
      deletedBacklink 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error deleting backlink:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};