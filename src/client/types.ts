/**
 * Core type definitions for Tokopedia MCP client and tools.
 */

export interface ShopSummary {
  id: string;
  name: string;
  city: string;
  isOfficial: boolean;
  isPowerMerchant: boolean;
  url: string;
}

export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  formattedPrice: string;
  originalPrice?: number;
  discountPercentage?: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  url: string;
  shop: ShopSummary;
  label?: string;
}

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'latest';
export type ConditionOption = 'all' | 'new' | 'used';
export type OutputFormat = 'json' | 'markdown';

export interface SearchProductsOptions {
  query: string;
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: SortOption;
  condition?: ConditionOption;
  officialStoreOnly?: boolean;
  location?: string;
  format?: OutputFormat;
  cookie?: string;
}

export interface SearchProductsResponse {
  query: string;
  totalData: number;
  page: number;
  limit: number;
  products: ProductSummary[];
  markdown?: string;
  isMock?: boolean;
  note?: string;
}

export interface ProductSpecification {
  title: string;
  value: string;
}

export interface ProductVariant {
  name: string;
  options: string[];
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  price: number;
  formattedPrice: string;
  originalPrice?: number;
  discountPercentage?: number;
  stock: number;
  description: string;
  rating: number;
  reviewCount: number;
  soldCount: number;
  images: string[];
  url: string;
  shop: ShopInfo;
  variants: ProductVariant[];
  specifications: ProductSpecification[];
  weightGrams?: number;
  condition?: string;
  markdown?: string;
  isMock?: boolean;
  note?: string;
}

export interface GetProductDetailOptions {
  url?: string;
  productId?: string;
  shopDomain?: string;
  productSlug?: string;
  format?: OutputFormat;
  cookie?: string;
}

export interface ProductReview {
  id: string;
  userName: string;
  rating: number;
  message: string;
  variant?: string;
  createdAt?: string;
}

export interface GetProductReviewsOptions {
  productId: string;
  ratingFilter?: number; // 0 for all, 1 to 5 for specific stars
  page?: number;
  limit?: number;
  format?: OutputFormat;
  cookie?: string;
}

export interface ProductReviewsResponse {
  productId: string;
  totalReviews: number;
  ratingAverage: number;
  page: number;
  limit: number;
  reviews: ProductReview[];
  markdown?: string;
  isMock?: boolean;
  note?: string;
}

export interface ShopInfo {
  id: string;
  name: string;
  domain: string;
  tagline?: string;
  description?: string;
  city: string;
  rating: number;
  followers: number;
  totalProductsSold: number;
  isOfficial: boolean;
  isPowerMerchant: boolean;
  url: string;
  avatarUrl?: string;
  markdown?: string;
  isMock?: boolean;
  note?: string;
}

export interface GetShopInfoOptions {
  shopId?: string | number;
  shopDomain?: string;
  format?: OutputFormat;
  cookie?: string;
}
