import dotenv from 'dotenv';
dotenv.config();

import { TokopediaClient } from '../src/client/tokopedia-client.js';
import { logger } from '../src/utils/logger.js';

async function runLiveSmokeTest() {
  logger.info('--- Starting Tokopedia Live Smoke Test ---');

  const client = new TokopediaClient({
    cookie: process.env.TOKOPEDIA_COOKIE,
    proxyUrl: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
    mockOnBlocked: true,
  });

  try {
    logger.info('1. Testing searchProducts: "mechanical keyboard"...');
    const searchRes = await client.searchProducts({
      query: 'mechanical keyboard',
      limit: 3,
      sortBy: 'relevance',
      format: 'json',
    });
    logger.info(`Search succeeded! Total data: ${searchRes.totalData}, returned ${searchRes.products.length} products`);
    if (searchRes.isMock) {
      logger.warn(`Note: Mock data was used (${searchRes.note})`);
    } else {
      logger.info(`First product: ${searchRes.products[0]?.name} - ${searchRes.products[0]?.formattedPrice}`);
    }

    logger.info('2. Testing getProductDetail...');
    const detail = await client.getProductDetail({
      shopDomain: 'samsung-official',
      productSlug: 'samsung-galaxy-s24-ultra',
      format: 'markdown',
    });
    logger.info(`Product detail retrieved: ${detail.name} (Stock: ${detail.stock})`);

    logger.info('3. Testing getShopInfo...');
    const shop = await client.getShopInfo({
      shopDomain: 'samsung-official',
    });
    logger.info(`Shop info retrieved: ${shop.name} (${shop.city}, Rating: ${shop.rating})`);

    logger.info('--- Live Smoke Test Completed Successfully! ---');
  } catch (err: any) {
    logger.error('Live smoke test failed:', err);
    process.exit(1);
  }
}

runLiveSmokeTest();
