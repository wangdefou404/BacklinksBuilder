import type { APIRoute } from 'astro';
import type { BacklinkResource, BacklinkFilters, BacklinkListResponse } from '../../../types/backlinks';

// Mock data - In real applications, this data should come from database
const mockBacklinks: BacklinkResource[] = [
  {
    id: '1',
    name: 'AI Valley',
    websiteLink: 'https://aivalley.ai',
    dr: 29,
    traffic: 132378,
    paymentType: 'Free',
    followType: 'NoFollow',
    platformType: 'directory',
    access: 'guest',
    updated: '2025-08-20',
    featured: true,
    tags: ['AI', 'Tools', 'Directory'],
    submissionUrl: 'https://aivalley.ai/submit',
    requirements: 'AI-related tools and services only',
    approvalTime: '2-3 days',
    contactEmail: 'submit@aivalley.ai'
  },
  {
    id: '2',
    name: 'Product Hunt',
    websiteLink: 'https://producthunt.com',
    dr: 91,
    traffic: 8500000,
    paymentType: 'Free',
    followType: 'DoFollow',
    platformType: 'directory',
    access: 'premium',
    updated: '2025-08-19',
    featured: true,
    tags: ['Startup', 'Product', 'Launch'],
    submissionUrl: 'https://producthunt.com/posts/new',
    requirements: 'New products and services',
    approvalTime: '1-2 days',
    contactEmail: 'hello@producthunt.com'
  },
  {
    id: '3',
    name: 'Hacker News',
    websiteLink: 'https://news.ycombinator.com',
    dr: 93,
    traffic: 12000000,
    paymentType: 'Free',
    followType: 'NoFollow',
    platformType: 'content',
    access: 'guest',
    updated: '2025-08-18',
    featured: true,
    tags: ['Tech', 'News', 'Startup'],
    submissionUrl: 'https://news.ycombinator.com/submit',
    requirements: 'Tech and startup related content',
    approvalTime: 'Immediate',
    contactEmail: 'hn@ycombinator.com'
  },
  {
    id: '4',
    name: 'Reddit',
    websiteLink: 'https://reddit.com',
    dr: 96,
    traffic: 52000000,
    paymentType: 'Free',
    followType: 'NoFollow',
    platformType: 'social',
    access: 'premium',
    updated: '2025-08-17',
    featured: true,
    tags: ['Social', 'Community', 'Discussion'],
    submissionUrl: 'https://reddit.com/submit',
    requirements: 'Follow subreddit rules',
    approvalTime: 'Immediate',
    contactEmail: 'contact@reddit.com'
  },
  {
    id: '5',
    name: 'Indie Hackers',
    websiteLink: 'https://indiehackers.com',
    dr: 78,
    traffic: 2100000,
    paymentType: 'Free',
    followType: 'DoFollow',
    platformType: 'comment',
    access: 'guest',
    updated: '2025-08-16',
    featured: false,
    tags: ['Entrepreneur', 'Startup', 'Community'],
    submissionUrl: 'https://indiehackers.com/post',
    requirements: 'Entrepreneur and startup content',
    approvalTime: '1 day',
    contactEmail: 'hello@indiehackers.com'
  }
];

// Generate more mock data to meet the requirement of 50+ records
for (let i = 6; i <= 60; i++) {
  mockBacklinks.push({
    id: i.toString(),
    name: `Resource ${i}`,
    websiteLink: `https://example${i}.com`,
    dr: Math.floor(Math.random() * 80) + 20,
    traffic: Math.floor(Math.random() * 1000000) + 10000,
    paymentType: ['Free', 'Paid'][Math.floor(Math.random() * 2)] as any,
    followType: ['DoFollow', 'NoFollow'][Math.floor(Math.random() * 2)] as any,
    platformType: ['blog', 'directory', 'content', 'comment', 'social'][Math.floor(Math.random() * 5)] as any,
    access: ['guest', 'premium'][Math.floor(Math.random() * 2)] as any,
    updated: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    featured: Math.random() > 0.7,
    tags: ['SEO', 'Marketing', 'Business'],
    submissionUrl: `https://example${i}.com/submit`,
    requirements: 'Quality content required',
    approvalTime: `${Math.floor(Math.random() * 7) + 1} days`,
    contactEmail: `contact@example${i}.com`
  });
}

function applyFilters(backlinks: BacklinkResource[], filters: BacklinkFilters): BacklinkResource[] {
  let filtered = [...backlinks];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(searchLower) ||
      item.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  if (filters.paymentType) {
    filtered = filtered.filter(item => item.paymentType === filters.paymentType);
  }

  if (filters.followType) {
    filtered = filtered.filter(item => item.followType === filters.followType);
  }

  if (filters.platformType) {
    filtered = filtered.filter(item => item.platformType === filters.platformType);
  }

  if (filters.minDr !== undefined) {
    filtered = filtered.filter(item => item.dr >= filters.minDr!);
  }

  if (filters.maxDr !== undefined) {
    filtered = filtered.filter(item => item.dr <= filters.maxDr!);
  }

  if (filters.minTraffic !== undefined) {
    filtered = filtered.filter(item => item.traffic >= filters.minTraffic!);
  }

  if (filters.maxTraffic !== undefined) {
    filtered = filtered.filter(item => item.traffic <= filters.maxTraffic!);
  }

  return filtered;
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

    // Apply filters
    let filteredBacklinks = applyFilters(mockBacklinks, filters);
    
    // Sort by DR (descending)
    filteredBacklinks.sort((a, b) => b.dr - a.dr);
    
    // User permission control - filter based on access field
    let availableItems: BacklinkResource[];
    if (isPremium) {
      // Premium users can see all data
      availableItems = filteredBacklinks;
    } else {
      // Free users can only see first 50 records with guest access
      const guestBacklinks = filteredBacklinks.filter(item => item.access === 'guest');
      availableItems = guestBacklinks.slice(0, 50);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = availableItems.slice(startIndex, endIndex);
    
    const response: BacklinkListResponse = {
      data: paginatedItems,
      total: availableItems.length,
      page,
      limit,
      hasMore: endIndex < availableItems.length
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
    
    // Generate new ID
    const id = (mockBacklinks.length + 1).toString();
    const backlinkWithId: BacklinkResource = {
      ...newBacklink,
      id,
      updated: new Date().toISOString().split('T')[0]
    };
    
    // Add to mock data (should be saved to database in real applications)
    mockBacklinks.push(backlinkWithId);
    
    return new Response(JSON.stringify(backlinkWithId), {
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