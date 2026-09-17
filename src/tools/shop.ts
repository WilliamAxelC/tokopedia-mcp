import { z } from 'zod';
import { TokopediaClient } from '../client/tokopedia-client.js';
import { GetShopInfoOptions } from '../client/types.js';

export const GetShopInfoSchema = z.object({
  shop_id: z.string().optional().describe('Numeric or string shop ID on Tokopedia'),
  shop_domain: z.string().optional().describe('Shop slug or domain name on Tokopedia (e.g. "samsung", "asus-official", "gramedia")'),
  format: z.enum(['json', 'markdown']).default('json').optional().describe('Output format: "json" or "markdown"'),
  cookie: z.string().optional().describe('Optional Tokopedia session cookie for this request'),
});

export type GetShopInfoArgs = z.infer<typeof GetShopInfoSchema>;

export async function handleGetShopInfo(client: TokopediaClient, args: GetShopInfoArgs) {
  if (!args.shop_id && !args.shop_domain) {
    throw new Error('Please provide either shop_id or shop_domain.');
  }

  const options: GetShopInfoOptions = {
    shopId: args.shop_id,
    shopDomain: args.shop_domain,
    format: args.format,
    cookie: args.cookie,
  };

  const shop = await client.getShopInfo(options);

  if (args.format === 'markdown' && shop.markdown) {
    return {
      text: shop.markdown,
      is_mock: shop.isMock,
      note: shop.note,
    };
  }

  return {
    id: shop.id,
    name: shop.name,
    domain: shop.domain,
    tagline: shop.tagline,
    description: shop.description,
    city: shop.city,
    rating: shop.rating,
    followers: shop.followers,
    total_products_sold: shop.totalProductsSold,
    is_official: shop.isOfficial,
    is_power_merchant: shop.isPowerMerchant,
    url: shop.url,
    is_mock: shop.isMock,
    note: shop.note,
  };
}
