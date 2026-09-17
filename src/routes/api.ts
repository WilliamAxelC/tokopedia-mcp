import { Router, Request, Response } from 'express';
import { TokopediaClient } from '../client/tokopedia-client.js';
import { globalCache } from '../utils/cache.js';

export function createApiRouter(client: TokopediaClient): Router {
  const router = Router();
  const startTime = Date.now();

  // Extract optional cookie from request header
  const getRequestCookie = (req: Request): string | undefined => {
    return (req.headers['x-tokopedia-cookie'] as string) || undefined;
  };

  // 1. Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'tokopedia-mcp',
      version: '1.0.0',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      cache_entries: globalCache.size,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Search products REST endpoint
  router.get('/api/search', async (req: Request, res: Response) => {
    try {
      const q = req.query.q as string;
      if (!q) {
        return res.status(400).json({ error: 'Missing required query parameter "q"' });
      }

      const result = await client.searchProducts({
        query: q,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        minPrice: req.query.min_price ? parseFloat(req.query.min_price as string) : undefined,
        maxPrice: req.query.max_price ? parseFloat(req.query.max_price as string) : undefined,
        sortBy: (req.query.sort_by as any) || 'relevance',
        condition: (req.query.condition as any) || 'all',
        officialStoreOnly: req.query.official_store === 'true',
        location: req.query.location as string,
        format: (req.query.format as any) || 'json',
        cookie: getRequestCookie(req),
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Product detail REST endpoint
  router.get('/api/products/:identifier', async (req: Request, res: Response) => {
    try {
      const identifier = String(req.params.identifier);
      const shop = req.query.shop ? String(req.query.shop) : undefined;
      const result = await client.getProductDetail({
        productId: identifier,
        productSlug: identifier,
        shopDomain: shop,
        format: (req.query.format as any) || 'json',
        cookie: getRequestCookie(req),
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Product reviews REST endpoint
  router.get('/api/products/:id/reviews', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await client.getProductReviews({
        productId: id,
        ratingFilter: req.query.rating ? parseInt(req.query.rating as string, 10) : 0,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
        format: (req.query.format as any) || 'json',
        cookie: getRequestCookie(req),
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Shop info REST endpoint
  router.get('/api/shops/:domainOrId', async (req: Request, res: Response) => {
    try {
      const domainOrId = String(req.params.domainOrId);
      const isNumeric = /^\d+$/.test(domainOrId);

      const result = await client.getShopInfo({
        shopId: isNumeric ? domainOrId : undefined,
        shopDomain: isNumeric ? undefined : domainOrId,
        format: (req.query.format as any) || 'json',
        cookie: getRequestCookie(req),
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
