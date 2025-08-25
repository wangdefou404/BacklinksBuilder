import https from 'https';

export const prerender = false;

export async function POST({ request }) {
  try {
    const { domains } = await request.json();
    
    if (!domains || !Array.isArray(domains)) {
      return new Response(JSON.stringify({ error: 'Invalid domains array' }), {
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

    const results = [];
    
    // Process domains sequentially to avoid rate limiting
    for (const domain of domains) {
      try {
        console.log(`[DEBUG] Checking domain: ${domain}`);
        const result = await checkDomainRating(domain, apiKey);
        console.log(`[DEBUG] Raw API response for ${domain}:`, JSON.stringify(result, null, 2));
        
        results.push({
          domain: domain,
          dr: result.domain_rating || 0,
          status: 'success'
        });
        console.log(`[DEBUG] Processed result for ${domain}:`, {
          domain: domain,
          dr: result.domain_rating || 0,
          status: 'success'
        });
      } catch (error) {
        console.log(`[DEBUG] Error for domain ${domain}:`, error.message);
        results.push({
          domain: domain,
          dr: 0,
          status: 'error',
          error: error.message
        });
      }
      
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function checkDomainRating(domain, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      hostname: 'seo-intelligence.p.rapidapi.com',
      port: null,
      path: `/check-dr-ar?domain=${encodeURIComponent(domain)}`,
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'seo-intelligence.p.rapidapi.com'
      }
    };

    const req = https.request(options, function (res) {
      const chunks = [];

      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        try {
          const body = Buffer.concat(chunks);
          const data = JSON.parse(body.toString());
          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', function (error) {
      reject(error);
    });

    req.setTimeout(10000, function() {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}