#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { TokopediaClient } from './client/tokopedia-client.js';
import { createExpressApp, startStdioServer } from './server.js';
import { logger } from './utils/logger.js';

async function main() {
  const args = process.argv.slice(2);
  const isStdio = args.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio';

  const client = new TokopediaClient({
    cookie: process.env.TOKOPEDIA_COOKIE,
    proxyUrl: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
    userAgent: process.env.USER_AGENT,
    requestDelayMs: process.env.REQUEST_DELAY_MS ? parseInt(process.env.REQUEST_DELAY_MS, 10) : undefined,
    mockOnBlocked: process.env.MOCK_ON_BLOCKED !== 'false',
  });

  if (isStdio) {
    await startStdioServer(client);
  } else {
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';
    const app = createExpressApp(client);

    app.listen(port, host, () => {
      logger.info(`=======================================================`);
      logger.info(`  Tokopedia MCP & REST Server is running!              `);
      logger.info(`  Listening on: http://${host}:${port}                 `);
      logger.info(`  MCP SSE Endpoint: http://${host}:${port}/sse         `);
      logger.info(`  REST Health Check: http://${host}:${port}/health     `);
      if (process.env.BASE_PATH) {
        logger.info(`  Reverse Proxy Prefix: ${process.env.BASE_PATH}       `);
      }
      logger.info(`=======================================================`);
    });
  }
}

main().catch((err) => {
  logger.error('Fatal server startup error:', err);
  process.exit(1);
});
