export const prerender = false;

export async function POST({ request }) {
  try {
    const { domain } = await request.json();
    
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return new Response(JSON.stringify({ error: 'Invalid domain format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = import.meta.env.RAPIDAPI_KEY;
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Making API request for domain:', domain);
    
    const response = await fetch(`https://similarweb-insights.p.rapidapi.com/traffic?domain=${domain}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'similarweb-insights.p.rapidapi.com'
      }
    });

    console.log('API response status:', response.status);
    
    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      return new Response(JSON.stringify({ 
        error: `API request failed: ${response.status} ${response.statusText}` 
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    console.log('API response data:', JSON.stringify(data, null, 2));

    // Parse the response data based on the correct API format
    let visits = 'N/A';

    // Handle the simple API response structure: { "Visits": number }
    if (data && data.Visits) {
      visits = data.Visits; // Use raw number without formatting
      console.log('Parsed visits:', visits);
    }
    
    console.log('Final parsed data - visits:', visits);

    const result = {
      domain,
      visits,
      status: 'Success'
    };

    console.log('Formatted result:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in traffic-check API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Note: formatNumber function removed - now returning raw numbers