import { z } from 'zod';
import { TokopediaClient } from '../client/tokopedia-client.js';
import { GetProductReviewsOptions } from '../client/types.js';

export const GetProductReviewsSchema = z.object({
  product_id: z.string().min(1).describe('Tokopedia product ID to fetch reviews for'),
  rating_filter: z.number().int().min(0).max(5).default(0).optional().describe('Filter by star rating: 0 for all reviews, or 1 to 5 for specific stars'),
  page: z.number().int().min(1).default(1).optional().describe('Review page number (default: 1)'),
  limit: z.number().int().min(1).max(50).default(10).optional().describe('Number of reviews per page (default: 10, max: 50)'),
  format: z.enum(['json', 'markdown']).default('json').optional().describe('Output format: "json" or "markdown"'),
  cookie: z.string().optional().describe('Optional Tokopedia session cookie for this request'),
});

export type GetProductReviewsArgs = z.infer<typeof GetProductReviewsSchema>;

export async function handleGetProductReviews(client: TokopediaClient, args: GetProductReviewsArgs) {
  const options: GetProductReviewsOptions = {
    productId: args.product_id,
    ratingFilter: args.rating_filter,
    page: args.page,
    limit: args.limit,
    format: args.format,
    cookie: args.cookie,
  };

  const reviews = await client.getProductReviews(options);

  if (args.format === 'markdown' && reviews.markdown) {
    return {
      text: reviews.markdown,
      total_reviews: reviews.totalReviews,
      rating_average: reviews.ratingAverage,
      is_mock: reviews.isMock,
      note: reviews.note,
    };
  }

  return {
    product_id: reviews.productId,
    total_reviews: reviews.totalReviews,
    rating_average: reviews.ratingAverage,
    page: reviews.page,
    limit: reviews.limit,
    reviews: reviews.reviews,
    is_mock: reviews.isMock,
    note: reviews.note,
  };
}
