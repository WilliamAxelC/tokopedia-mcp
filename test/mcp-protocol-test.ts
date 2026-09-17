import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMcpClientTest() {
  console.log('=== Testing Tokopedia MCP Server via Stdio Client Transport ===');

  const serverPath = path.resolve(__dirname, '../dist/index.js');
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath, '--stdio'],
    env: {
      ...process.env,
      MOCK_ON_BLOCKED: 'true',
      LOG_LEVEL: 'error', // keep stderr quiet during protocol test
    },
  });

  const client = new Client(
    { name: 'mcp-test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('✓ Connected to MCP server via stdio');

  // 1. List tools
  const toolsResponse = await client.listTools();
  console.log(`✓ Tools discovered (${toolsResponse.tools.length}):`);
  const toolNames = toolsResponse.tools.map((t) => t.name);
  console.log('  Names:', toolNames.join(', '));

  const expectedTools = ['search_products', 'get_product_detail', 'get_product_reviews', 'get_shop_info'];
  for (const exp of expectedTools) {
    if (!toolNames.includes(exp)) {
      throw new Error(`Missing expected tool: ${exp}`);
    }
  }

  // 2. Test search_products (json)
  console.log('\n--- 1. Testing search_products (json) ---');
  const searchResult: any = await client.callTool({
    name: 'search_products',
    arguments: {
      query: 'sepatu lari',
      limit: 2,
      format: 'json',
    },
  });
  console.log('Raw result content type:', searchResult.content[0].type);
  const parsedSearch = JSON.parse(searchResult.content[0].text);
  console.log(`✓ Search returned ${parsedSearch.products.length} products for "${parsedSearch.query}"`);

  // 3. Test search_products (markdown table)
  console.log('\n--- 2. Testing search_products (markdown) ---');
  const searchMdResult: any = await client.callTool({
    name: 'search_products',
    arguments: {
      query: 'headphone bluetooth',
      limit: 2,
      format: 'markdown',
    },
  });
  const parsedSearchMd = JSON.parse(searchMdResult.content[0].text);
  console.log('✓ Markdown table preview:\n' + parsedSearchMd.text.slice(0, 180) + '...');

  // 4. Test get_product_detail
  console.log('\n--- 3. Testing get_product_detail ---');
  const detailResult: any = await client.callTool({
    name: 'get_product_detail',
    arguments: {
      shop_domain: 'tokopedia-official',
      product_slug: 'headset-wireless-pro',
      format: 'json',
    },
  });
  const parsedDetail = JSON.parse(detailResult.content[0].text);
  console.log(`✓ Product detail: "${parsedDetail.name}" - ${parsedDetail.formatted_price}`);
  console.log(`  Stock: ${parsedDetail.stock}, Seller: ${parsedDetail.shop.name}`);

  // 5. Test get_product_reviews
  console.log('\n--- 4. Testing get_product_reviews ---');
  const reviewsResult: any = await client.callTool({
    name: 'get_product_reviews',
    arguments: {
      product_id: '998811',
      limit: 2,
    },
  });
  const parsedReviews = JSON.parse(reviewsResult.content[0].text);
  console.log(`✓ Reviews: Total ${parsedReviews.total_reviews}, Avg Rating: ⭐ ${parsedReviews.rating_average}`);
  console.log(`  First review: "${parsedReviews.reviews[0]?.message}" by ${parsedReviews.reviews[0]?.userName}`);

  // 6. Test get_shop_info
  console.log('\n--- 5. Testing get_shop_info ---');
  const shopResult: any = await client.callTool({
    name: 'get_shop_info',
    arguments: {
      shop_domain: 'asus-official',
    },
  });
  const parsedShop = JSON.parse(shopResult.content[0].text);
  console.log(`✓ Shop: "${parsedShop.name}" (${parsedShop.city})`);
  console.log(`  Official Store: ${parsedShop.is_official}, Rating: ⭐ ${parsedShop.rating}`);

  // 7. Test cookie passing per-tool call
  console.log('\n--- 6. Testing user-submitted cookie parameter ---');
  const cookieResult: any = await client.callTool({
    name: 'search_products',
    arguments: {
      query: 'buku programming',
      cookie: '_SID_Tokopedia=user_test_token_abc; bm_sz=123',
    },
  });
  const parsedCookie = JSON.parse(cookieResult.content[0].text);
  console.log(`✓ Search with user cookie succeeded for "${parsedCookie.query}"`);

  await client.close();
  console.log('\n=== All MCP Tool & Protocol Tests Passed Successfully! ===');
}

runMcpClientTest().catch((err) => {
  console.error('MCP Protocol Test Failed:', err);
  process.exit(1);
});
