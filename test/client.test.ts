import { describe, it, expect, beforeEach } from 'vitest';
import { TokopediaClient } from '../src/client/tokopedia-client.js';
import {
  formatIDR,
  parsePrice,
  parseTokopediaUrl,
  productsToMarkdownTable,
  productDetailToMarkdown,
} from '../src/utils/formatters.js';
import { globalCache } from '../src/utils/cache.js';

describe('Tokopedia Formatters & Utilities', () => {
  it('formats amounts into IDR currency strings', () => {
    expect(formatIDR(1500000)).toBe('Rp 1.500.000');
    expect(formatIDR(25000)).toBe('Rp 25.000');
    expect(formatIDR(0)).toBe('Rp 0');
    expect(formatIDR(null)).toBe('Rp 0');
  });

  it('parses numeric prices from raw strings', () => {
    expect(parsePrice('Rp1.500.000')).toBe(1500000);
    expect(parsePrice('Rp 25.000')).toBe(25000);
    expect(parsePrice(45000)).toBe(45000);
    expect(parsePrice('')).toBe(0);
  });

  it('parses Tokopedia product URLs into shopDomain and productSlug', () => {
    const url = 'https://www.tokopedia.com/samsung-official/samsung-galaxy-s24-ultra-5g?extParam=src';
    const parsed = parseTokopediaUrl(url);
    expect(parsed.shopDomain).toBe('samsung-official');
    expect(parsed.productSlug).toBe('samsung-galaxy-s24-ultra-5g');
  });

  it('parses shop-only URLs', () => {
    const url = 'https://www.tokopedia.com/asus-store';
    const parsed = parseTokopediaUrl(url);
    expect(parsed.shopDomain).toBe('asus-store');
  });
});

describe('TokopediaClient', () => {
  let client: TokopediaClient;

  beforeEach(() => {
    globalCache.clear();
    client = new TokopediaClient({
      mockOnBlocked: true,
      requestDelayMs: 0,
    });
  });

  it('searches products and returns structured JSON', async () => {
    const res = await client.searchProducts({
      query: 'keyboard mechanical',
      limit: 5,
      sortBy: 'relevance',
      format: 'json',
    });

    expect(res).toBeDefined();
    expect(res.query).toBe('keyboard mechanical');
    expect(res.products.length).toBeGreaterThan(0);
    expect(res.products[0]).toHaveProperty('id');
    expect(res.products[0]).toHaveProperty('name');
    expect(res.products[0]).toHaveProperty('price');
    expect(res.products[0]).toHaveProperty('shop');
  });

  it('supports markdown output format for search results', async () => {
    const res = await client.searchProducts({
      query: 'laptop',
      limit: 3,
      format: 'markdown',
    });

    expect(res.markdown).toBeDefined();
    expect(res.markdown).toContain('| # | Product Name | Price |');
    expect(res.markdown).toContain('laptop');
  });

  it('retrieves product detail by URL or slug', async () => {
    const detail = await client.getProductDetail({
      shopDomain: 'logitech-official',
      productSlug: 'logitech-g-pro-wireless',
      format: 'json',
    });

    expect(detail).toBeDefined();
    expect(detail.name).toBeDefined();
    expect(detail.price).toBeGreaterThan(0);
    expect(detail.shop.domain).toBe('logitech-official');
    expect(detail.specifications.length).toBeGreaterThan(0);
  });

  it('retrieves product reviews', async () => {
    const reviewsRes = await client.getProductReviews({
      productId: '12345678',
      limit: 3,
    });

    expect(reviewsRes).toBeDefined();
    expect(reviewsRes.productId).toBe('12345678');
    expect(reviewsRes.reviews.length).toBeGreaterThan(0);
    expect(reviewsRes.reviews[0]).toHaveProperty('message');
  });

  it('retrieves shop info by domain', async () => {
    const shop = await client.getShopInfo({
      shopDomain: 'samsung-official',
    });

    expect(shop).toBeDefined();
    expect(shop.name).toBeDefined();
    expect(shop.rating).toBeGreaterThan(0);
    expect(shop.isOfficial).toBe(true);
  });

  it('utilizes in-memory cache on duplicate queries', async () => {
    const first = await client.searchProducts({ query: 'iphone', limit: 2 });
    const second = await client.searchProducts({ query: 'iphone', limit: 2 });

    expect(second).toEqual(first);
  });
});
