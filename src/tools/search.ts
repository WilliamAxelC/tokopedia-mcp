import { z } from 'zod';
import { TokopediaClient } from '../client/tokopedia-client.js';
import { SearchProductsOptions } from '../client/types.js';

export const SearchProductsSchema = z.object({
  query: z.string().min(1).describe('Search keyword or product name (e.g. "iPhone 15", "keyboard mechanical", "sepatu running")'),
  page: z.number().int().min(1).default(1).optional().describe('Page number for pagination (default: 1)'),
  limit: z.number().int().min(1).max(60).default(20).optional().describe('Number of items per page (default: 20, max: 60)'),
  min_price: z.number().positive().optional().describe('Minimum price in IDR (e.g. 500000)'),
  max_price: z.number().positive().optional().describe('Maximum price in IDR (e.g. 2000000)'),
  sort_by: z.enum(['relevance', 'price_asc', 'price_desc', 'rating', 'latest']).default('relevance').optional().describe('Sort order: relevance, price_asc (cheapest), price_desc (most expensive), rating (best rated), or latest'),
  condition: z.enum(['all', 'new', 'used']).default('all').optional().describe('Filter by condition: all, new, or used'),
  official_store_only: z.boolean().default(false).optional().describe('Filter only products sold by Tokopedia Official Stores'),
  location: z.string().optional().describe('Filter products by city or province location (e.g. "Jakarta", "Surabaya", "Bandung")'),
  format: z.enum(['json', 'markdown']).default('json').optional().describe('Output format: "json" for structured token-efficient data, or "markdown" for a pre-formatted display table'),
  cookie: z.string().optional().describe('Optional Tokopedia session cookie to override server default for this query'),
});

export type SearchProductsArgs = z.infer<typeof SearchProductsSchema>;

export async function handleSearchProducts(client: TokopediaClient, args: SearchProductsArgs) {
  const options: SearchProductsOptions = {
    query: args.query,
    page: args.page,
    limit: args.limit,
    minPrice: args.min_price,
    maxPrice: args.max_price,
    sortBy: args.sort_by,
    condition: args.condition,
    officialStoreOnly: args.official_store_only,
    location: args.location,
    format: args.format,
    cookie: args.cookie,
  };

  const result = await client.searchProducts(options);

  if (args.format === 'markdown' && result.markdown) {
    return {
      text: result.markdown,
      total_data: result.totalData,
      page: result.page,
      is_mock: result.isMock,
      note: result.note,
    };
  }

  return {
    query: result.query,
    total_data: result.totalData,
    page: result.page,
    limit: result.limit,
    products: result.products,
    is_mock: result.isMock,
    note: result.note,
  };
}
