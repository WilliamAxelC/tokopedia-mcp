import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TokopediaClient } from './client/tokopedia-client.js';
import { logger } from './utils/logger.js';
import { createApiRouter } from './routes/api.js';
import {
  SearchProductsSchema,
  handleSearchProducts,
} from './tools/search.js';
import {
  GetProductDetailSchema,
  handleGetProductDetail,
} from './tools/product-detail.js';
import {
  GetProductReviewsSchema,
  handleGetProductReviews,
} from './tools/reviews.js';
import {
  GetShopInfoSchema,
  handleGetShopInfo,
} from './tools/shop.js';

/**
 * Creates and configures the McpServer with all Tokopedia tools.
 */
export function createMcpServer(client: TokopediaClient): McpServer {
  const server = new McpServer({
    name: 'tokopedia-mcp',
    version: '1.0.0',
  });

  // Tool 1: search_products
  server.tool(
    'search_products',
    'Search products on Tokopedia (tokopedia.com) with price, sorting, condition, location, and official store filters.',
    SearchProductsSchema.shape,
    async (args) => {
      try {
        const result = await handleSearchProducts(client, args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error searching Tokopedia products: ${err.message}` }],
        };
      }
    }
  );

  // Tool 2: get_product_detail
  server.tool(
    'get_product_detail',
    'Get full specifications, variants, pricing, stock, description, and seller information for a Tokopedia product.',
    GetProductDetailSchema.shape,
    async (args) => {
      try {
        const result = await handleGetProductDetail(client, args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error retrieving product details: ${err.message}` }],
        };
      }
    }
  );

  // Tool 3: get_product_reviews
  server.tool(
    'get_product_reviews',
    'Retrieve customer reviews, star ratings, and buyer comments for a Tokopedia product.',
    GetProductReviewsSchema.shape,
    async (args) => {
      try {
        const result = await handleGetProductReviews(client, args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error retrieving product reviews: ${err.message}` }],
        };
      }
    }
  );

  // Tool 4: get_shop_info
  server.tool(
    'get_shop_info',
    'Retrieve merchant profile, badges (Official Store, Power Merchant), rating, follower count, and location for a Tokopedia seller.',
    GetShopInfoSchema.shape,
    async (args) => {
      try {
        const result = await handleGetShopInfo(client, args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error retrieving shop info: ${err.message}` }],
        };
      }
    }
  );

  return server;
}

/**
 * Starts the MCP server in standard I/O (stdio) mode.
 */
export async function startStdioServer(client: TokopediaClient): Promise<void> {
  logger.setStdioMode(true);
  const server = createMcpServer(client);
  const transport = new StdioServerTransport();

  logger.info('Starting Tokopedia MCP Server in stdio transport mode...');
  await server.connect(transport);
  logger.info('Tokopedia MCP Server connected via stdio successfully');
}

/**
 * Creates the Express web server supporting REST endpoints and MCP SSE connections.
 */
export function createExpressApp(client: TokopediaClient): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Optional API Key validation (as specified in MCP_HOSTING_SPEC.md)
  const configuredApiKey = process.env.API_KEY;
  if (configuredApiKey) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/health' || req.path === '/' || req.path.endsWith('/health')) {
        return next();
      }

      const apiKey =
        (req.headers['x-api-key'] as string) ||
        (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : undefined) ||
        (req.query.apiKey as string);

      if (apiKey && apiKey === configuredApiKey) {
        return next();
      }

      res.status(401).json({
        error: 'Unauthorized: Valid API Key is required.',
        hint: 'Supply via "x-api-key" header, "Authorization: Bearer <API_KEY>", or "?apiKey=<API_KEY>" query parameter.',
      });
    });
  }

  // Mount REST API endpoints
  app.use(createApiRouter(client));

  // Active SSE transports keyed by sessionId
  const transports = new Map<string, SSEServerTransport>();

  // Determine prefix from Nginx header or env var
  const getPrefix = (req: Request): string => {
    const forwardedPrefix = req.headers['x-forwarded-prefix'] as string;
    if (forwardedPrefix) {
      return forwardedPrefix.replace(/\/$/, '');
    }
    const envPrefix = process.env.BASE_PATH || '';
    return envPrefix.replace(/\/$/, '');
  };

  const handleSse = async (req: Request, res: Response) => {
    const prefix = getPrefix(req);
    const messagesEndpoint = `${prefix}/messages`;

    logger.info(`New MCP client connected via SSE. Messages endpoint: ${messagesEndpoint}`);
    const transport = new SSEServerTransport(messagesEndpoint, res);
    transports.set(transport.sessionId, transport);

    res.on('close', () => {
      logger.info(`MCP client disconnected (sessionId: ${transport.sessionId})`);
      transports.delete(transport.sessionId);
    });

    const mcpServer = createMcpServer(client);
    await mcpServer.connect(transport);
  };

  const handlePostMessages = async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send('Missing sessionId query parameter');
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send(`Session not found for sessionId: ${sessionId}`);
      return;
    }

    await transport.handlePostMessage(req, res);
  };

  // MCP SSE Stream Endpoints (mount on root and with optional base prefix)
  app.get('/sse', handleSse);
  app.post('/messages', handlePostMessages);

  // Also support direct path matching if reverse proxy doesn't rewrite
  const envPrefix = (process.env.BASE_PATH || '').replace(/\/$/, '');
  if (envPrefix && envPrefix !== '') {
    app.get(`${envPrefix}/sse`, handleSse);
    app.post(`${envPrefix}/messages`, handlePostMessages);
    app.use(envPrefix, createApiRouter(client));
  }

  return app;
}
