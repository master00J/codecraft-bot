// Apollo Panel API Discovery Script
// Run with: node check-apollo-api.js

const APOLLO_BASE_URL = "https://your-apollo-panel.com"; // CHANGE THIS
const API_KEY = "your-api-key-if-you-have-one"; // CHANGE THIS

async function checkApolloAPI() {
  console.log("🔍 Checking Apollo Panel API...\n");
  
  const endpoints = [
    "/api",
    "/api/v1",
    "/api/docs",
    "/docs",
    "/swagger",
    "/swagger.json",
    "/api-docs",
    "/openapi.json",
    "/api/info",
    "/api/health",
  ];
  
  for (const endpoint of endpoints) {
    const url = `${APOLLO_BASE_URL}${endpoint}`;
    
    try {
      console.log(`Trying: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          ...(API_KEY && { "Authorization": `Bearer ${API_KEY}` }),
          "Accept": "application/json"
        }
      });
      
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        
        if (contentType?.includes("application/json")) {
          const data = await response.json();
          console.log(`  ✅ FOUND! Response:`, JSON.stringify(data, null, 2).substring(0, 500));
          console.log("\n");
        } else if (contentType?.includes("text/html")) {
          console.log(`  ✅ FOUND! (HTML page - likely documentation)`);
          console.log(`  👉 Open in browser: ${url}\n`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log("\n📋 Next Steps:");
  console.log("1. If you found /api/docs or /docs → Read the documentation");
  console.log("2. Check Apollo Dashboard for 'API Keys' or 'Developer' section");
  console.log("3. Contact Apollo support if no API is visible");
  console.log("4. Consider alternative: Pterodactyl Panel (has full API)");
}

checkApolloAPI();

