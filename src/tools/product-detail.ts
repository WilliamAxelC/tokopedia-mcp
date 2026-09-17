import { z } from 'zod';
import { TokopediaClient } from '../client/tokopedia-client.js';
import { GetProductDetailOptions } from '../client/types.js';

export const GetProductDetailSchema = z.object({
  url: z.string().optional().describe('Full Tokopedia product URL (e.g. "https://www.tokopedia.com/samsung/samsung-galaxy-s24-ultra")'),
  product_id: z.string().optional().describe('Tokopedia product ID (numeric or string identifier)'),
  shop_domain: z.string().optional().describe('Shop slug/domain on Tokopedia (e.g. "samsung", "asus-official")'),
  product_slug: z.string().optional().describe('Product slug from URL (e.g. "samsung-galaxy-s24-ultra")'),
  format: z.enum(['json', 'markdown']).default('json').optional().describe('Output format: "json" for structured data, or "markdown" for a formatted human-readable summary'),
  cookie: z.string().optional().describe('Optional Tokopedia session cookie for this request'),
});

export type GetProductDetailArgs = z.infer<typeof GetProductDetailSchema>;

export async function handleGetProductDetail(client: TokopediaClient, args: GetProductDetailArgs) {
  if (!args.url && !args.product_id && (!args.shop_domain || !args.product_slug)) {
    throw new Error('You must provide either a product URL, product_id, or both shop_domain and product_slug.');
  }

  const options: GetProductDetailOptions = {
    url: args.url,
    productId: args.product_id,
    shopDomain: args.shop_domain,
    productSlug: args.product_slug,
    format: args.format,
    cookie: args.cookie,
  };

  const product = await client.getProductDetail(options);

  if (args.format === 'markdown' && product.markdown) {
    return {
      text: product.markdown,
      is_mock: product.isMock,
      note: product.note,
    };
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    formatted_price: product.formattedPrice,
    original_price: product.originalPrice,
    discount_percentage: product.discountPercentage,
    stock: product.stock,
    description: product.description,
    rating: product.rating,
    review_count: product.reviewCount,
    sold_count: product.soldCount,
    images: product.images,
    url: product.url,
    shop: product.shop,
    variants: product.variants,
    specifications: product.specifications,
    is_mock: product.isMock,
    note: product.note,
  };
}
