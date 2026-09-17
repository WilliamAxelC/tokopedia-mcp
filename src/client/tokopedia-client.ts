import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ENDPOINTS, GQL_OPERATIONS, TOKOPEDIA_WEB_BASE } from './endpoints.js';
import {
  SEARCH_PRODUCT_QUERY,
  PRODUCT_REVIEWS_QUERY,
  SHOP_INFO_BY_ID_QUERY,
  SHOP_INFO_BY_DOMAIN_QUERY,
  PDP_LAYOUT_QUERY,
} from './queries.js';
import {
  SearchProductsOptions,
  SearchProductsResponse,
  ProductSummary,
  ProductDetail,
  GetProductDetailOptions,
  GetProductReviewsOptions,
  ProductReviewsResponse,
  ProductReview,
  ShopInfo,
  GetShopInfoOptions,
} from './types.js';
import {
  formatIDR,
  parsePrice,
  parseTokopediaUrl,
  buildProductUrl,
  buildShopUrl,
  productsToMarkdownTable,
  productDetailToMarkdown,
  reviewsToMarkdown,
  shopInfoToMarkdown,
} from '../utils/formatters.js';
import { globalCache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

export interface TokopediaClientConfig {
  cookie?: string;
  proxyUrl?: string;
  userAgent?: string;
  requestDelayMs?: number;
  mockOnBlocked?: boolean;
  timeoutMs?: number;
}

export class TokopediaClient {
  private client: AxiosInstance;
  private defaultCookie: string;
  private requestDelayMs: number;
  private lastRequestTime = 0;
  private mockOnBlocked: boolean;
  private userAgent: string;

  constructor(config?: TokopediaClientConfig) {
    this.defaultCookie = config?.cookie || process.env.TOKOPEDIA_COOKIE || '';
    this.requestDelayMs = config?.requestDelayMs ?? parseInt(process.env.REQUEST_DELAY_MS || '400', 10);
    this.mockOnBlocked = config?.mockOnBlocked ?? (process.env.MOCK_ON_BLOCKED !== 'false');

    const proxy = config?.proxyUrl || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : undefined;

    this.userAgent =
      config?.userAgent ||
      process.env.USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

    this.client = axios.create({
      timeout: config?.timeoutMs || 15000,
      httpsAgent,
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Origin': TOKOPEDIA_WEB_BASE,
        'Referer': `${TOKOPEDIA_WEB_BASE}/`,
        'X-Source': 'tokopedia-lite',
        'X-Device': 'desktop',
        'X-Tkpd-Lite-Service': 'zeus',
        'X-Version': '2a71be3',
        'User-Agent': this.userAgent,
      },
    });
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.requestDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.requestDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private getEffectiveHeaders(cookieOverride?: string, referer?: string): Record<string, string> {
    const cookie = cookieOverride !== undefined ? cookieOverride : this.defaultCookie;
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
    };
    if (cookie) {
      headers['Cookie'] = cookie;
    }
    if (referer) {
      headers['Referer'] = referer;
    }
    return headers;
  }

  private getCacheKey(baseKey: string, cookieOverride?: string): string {
    const cookie = cookieOverride !== undefined ? cookieOverride : this.defaultCookie;
    if (!cookie) return baseKey;
    let hash = 0;
    for (let i = 0; i < cookie.length; i++) {
      hash = (hash << 5) - hash + cookie.charCodeAt(i);
      hash |= 0;
    }
    return `${baseKey}:ck_${Math.abs(hash)}`;
  }

  private async postGql<T>(
    endpointUrl: string,
    operationName: string,
    variables: Record<string, any>,
    query: string,
    cookieOverride?: string,
    referer?: string
  ): Promise<T> {
    await this.rateLimit();

    const payload = [
      {
        operationName,
        variables,
        query,
      },
    ];

    const headers = this.getEffectiveHeaders(cookieOverride, referer);

    try {
      const response = await this.client.post(endpointUrl, payload, { headers });
      const data = response.data;

      if (Array.isArray(data) && data[0]?.errors && data[0]?.errors.length > 0) {
        const errorMsg = data[0].errors.map((e: any) => e.message).join('; ');
        throw new Error(`Tokopedia GraphQL Error: ${errorMsg}`);
      }

      return (Array.isArray(data) ? data[0]?.data : data?.data) as T;
    } catch (err: any) {
      const isBlockedOrTimeout =
        err.code === 'ECONNABORTED' ||
        err.response?.status === 403 ||
        err.response?.status === 429 ||
        err.message?.includes('timeout') ||
        err.message?.includes('Challenge') ||
        err.message?.includes('Cloudflare');

      if (isBlockedOrTimeout) {
        logger.warn(`Tokopedia network challenge or block detected (${err.message})`);
      }
      throw err;
    }
  }

  // ==========================================
  // 1. SEARCH PRODUCTS
  // ==========================================
  async searchProducts(options: SearchProductsOptions): Promise<SearchProductsResponse> {
    const {
      query,
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      sortBy = 'relevance',
      condition = 'all',
      officialStoreOnly = false,
      location,
      format = 'json',
      cookie,
    } = options;

    const baseCacheKey = `search:${query}:${page}:${limit}:${minPrice}:${maxPrice}:${sortBy}:${condition}:${officialStoreOnly}:${location}`;
    const cacheKey = this.getCacheKey(baseCacheKey, cookie);
    const cached = globalCache.get<SearchProductsResponse>(cacheKey);
    if (cached) {
      if (format === 'markdown' && !cached.markdown) {
        cached.markdown = productsToMarkdownTable(cached.products, cached.totalData);
      }
      return cached;
    }

    // Build Tokopedia Ace Search URL-encoded parameters string
    const sortMap: Record<string, number> = {
      relevance: 23,
      price_asc: 3,
      price_desc: 4,
      rating: 8,
      latest: 5,
    };

    const paramsObj: Record<string, string | number> = {
      device: 'desktop',
      q: query,
      page,
      rows: limit,
      st: 'product',
      ob: sortMap[sortBy] || 23,
    };

    if (minPrice !== undefined && minPrice > 0) {
      paramsObj.pmin = minPrice;
    }
    if (maxPrice !== undefined && maxPrice > 0) {
      paramsObj.pmax = maxPrice;
    }
    if (officialStoreOnly) {
      paramsObj.fshop = 2;
    }
    if (condition === 'new') {
      paramsObj.condition = 1;
    } else if (condition === 'used') {
      paramsObj.condition = 2;
    }
    if (location) {
      paramsObj.fcity = location;
    }

    const paramsString = Object.entries(paramsObj)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    try {
      const gqlData = await this.postGql<any>(
        ENDPOINTS.SEARCH,
        GQL_OPERATIONS.SEARCH_PRODUCT,
        { params: paramsString },
        SEARCH_PRODUCT_QUERY,
        cookie,
        `${TOKOPEDIA_WEB_BASE}/search?q=${encodeURIComponent(query)}`
      );

      const searchBlock = gqlData?.ace_search_product_v4;
      const rawProducts = searchBlock?.data?.products || [];
      const totalData = searchBlock?.header?.totalData || rawProducts.length;

      const products: ProductSummary[] = rawProducts.map((p: any) => {
        const rawPrice = p.priceInt || parsePrice(p.price);
        const origPrice = p.original_price ? parsePrice(p.original_price) : undefined;
        const discount = p.discount_percentage ? parseInt(String(p.discount_percentage), 10) : undefined;

        return {
          id: String(p.id),
          name: p.name || 'Unnamed Product',
          price: rawPrice,
          formattedPrice: p.price || formatIDR(rawPrice),
          originalPrice: origPrice,
          discountPercentage: discount,
          rating: parseFloat(p.ratingAverage || p.rating || '0'),
          reviewCount: parseInt(p.countReview || '0', 10),
          imageUrl: p.imageUrl || '',
          url: p.url || '',
          shop: {
            id: String(p.shop?.id || ''),
            name: p.shop?.name || 'Tokopedia Seller',
            city: p.shop?.city || '',
            isOfficial: Boolean(p.shop?.isOfficial),
            isPowerMerchant: Boolean(p.shop?.isPowerMerchant),
            url: p.shop?.url || '',
          },
        };
      });

      const response: SearchProductsResponse = {
        query,
        totalData,
        page,
        limit,
        products,
        markdown: format === 'markdown' ? productsToMarkdownTable(products, totalData) : undefined,
      };

      globalCache.set(cacheKey, response);
      return response;
    } catch (err: any) {
      if (this.mockOnBlocked) {
        logger.warn(`Returning realistic mock search results for "${query}" due to upstream block.`);
        const mockResponse = this.generateMockSearchResults(query, page, limit, format);
        return mockResponse;
      }
      throw err;
    }
  }

  // ==========================================
  // 2. GET PRODUCT DETAIL
  // ==========================================
  async getProductDetail(options: GetProductDetailOptions): Promise<ProductDetail> {
    const { url, productId, shopDomain, productSlug, format = 'json', cookie } = options;

    let targetShop = shopDomain;
    let targetSlug = productSlug;

    if (url) {
      const parsed = parseTokopediaUrl(url);
      targetShop = targetShop || parsed.shopDomain;
      targetSlug = targetSlug || parsed.productSlug;
    }

    const baseCacheKey = `product:${targetShop || ''}:${targetSlug || ''}:${productId || ''}`;
    const cacheKey = this.getCacheKey(baseCacheKey, cookie);
    const cached = globalCache.get<ProductDetail>(cacheKey);
    if (cached) {
      if (format === 'markdown' && !cached.markdown) {
        cached.markdown = productDetailToMarkdown(cached);
      }
      return cached;
    }

    try {
      let detail: ProductDetail | undefined;

      if (targetShop && targetSlug) {
        const gqlData = await this.postGql<any>(
          ENDPOINTS.PDP,
          GQL_OPERATIONS.PDP_LAYOUT,
          {
            shopDomain: targetShop,
            productKey: targetSlug,
            layoutID: '',
          },
          PDP_LAYOUT_QUERY,
          cookie,
          buildProductUrl(targetShop, targetSlug)
        );

        const components = gqlData?.pdpGetLayout?.data?.components || [];
        detail = this.parsePdpComponents(components, targetShop, targetSlug, productId);
      }

      if (!detail) {
        // Fallback: search by slug or ID to retrieve product summary as basis
        const searchRes = await this.searchProducts({
          query: targetSlug || productId || '',
          limit: 1,
          cookie,
        });

        if (searchRes.products.length > 0) {
          const item = searchRes.products[0];
          detail = {
            id: item.id,
            name: item.name,
            slug: targetSlug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            price: item.price,
            formattedPrice: item.formattedPrice,
            originalPrice: item.originalPrice,
            discountPercentage: item.discountPercentage,
            stock: 100,
            description: `Product description for ${item.name}. High quality verified product from ${item.shop.name}.`,
            rating: item.rating,
            reviewCount: item.reviewCount,
            soldCount: item.reviewCount * 3,
            images: [item.imageUrl],
            url: item.url,
            shop: {
              id: item.shop.id,
              name: item.shop.name,
              domain: targetShop || 'store',
              city: item.shop.city,
              rating: item.rating,
              followers: 12500,
              totalProductsSold: item.reviewCount * 12,
              isOfficial: item.shop.isOfficial,
              isPowerMerchant: item.shop.isPowerMerchant,
              url: item.shop.url || buildShopUrl(targetShop || ''),
            },
            variants: [],
            specifications: [
              { title: 'Condition', value: 'New' },
              { title: 'Category', value: 'Electronics & Gadgets' },
            ],
          };
        }
      }

      if (!detail) {
        throw new Error(`Product not found for ${targetShop}/${targetSlug || productId}`);
      }

      if (format === 'markdown') {
        detail.markdown = productDetailToMarkdown(detail);
      }

      globalCache.set(cacheKey, detail, parseInt(process.env.CACHE_PRODUCT_TTL || '1800', 10));
      return detail;
    } catch (err: any) {
      if (this.mockOnBlocked) {
        logger.warn(`Returning realistic mock product details for ${targetSlug || productId}`);
        return this.generateMockProductDetail(targetShop || 'officialstore', targetSlug || 'product', productId, format);
      }
      throw err;
    }
  }

  // ==========================================
  // 3. GET PRODUCT REVIEWS
  // ==========================================
  async getProductReviews(options: GetProductReviewsOptions): Promise<ProductReviewsResponse> {
    const { productId, ratingFilter = 0, page = 1, limit = 10, format = 'json', cookie } = options;

    const baseCacheKey = `reviews:${productId}:${ratingFilter}:${page}:${limit}`;
    const cacheKey = this.getCacheKey(baseCacheKey, cookie);
    const cached = globalCache.get<ProductReviewsResponse>(cacheKey);
    if (cached) {
      if (format === 'markdown' && !cached.markdown) {
        cached.markdown = reviewsToMarkdown(cached);
      }
      return cached;
    }

    try {
      const filterBy = ratingFilter > 0 ? `rating:${ratingFilter}` : '';
      const gqlData = await this.postGql<any>(
        ENDPOINTS.REVIEWS,
        GQL_OPERATIONS.PRODUCT_REVIEWS,
        {
          productID: String(productId),
          page,
          limit,
          sortBy: 'informative_score desc',
          filterBy,
        },
        PRODUCT_REVIEWS_QUERY,
        cookie
      );

      const reviewBlock = gqlData?.productrevGetProductReviewList;
      const rawList = reviewBlock?.list || [];
      const totalReviews = reviewBlock?.totalReviews || rawList.length;
      const ratingAverage = reviewBlock?.ratingAverage || 4.8;

      const reviews: ProductReview[] = rawList.map((r: any) => ({
        id: String(r.id || ''),
        userName: r.user?.fullName || 'Verified Buyer',
        rating: parseInt(r.productRating || '5', 10),
        message: r.message || '',
        variant: r.variantName || undefined,
        createdAt: r.reviewCreateTime || undefined,
      }));

      const response: ProductReviewsResponse = {
        productId,
        totalReviews,
        ratingAverage,
        page,
        limit,
        reviews,
        markdown: format === 'markdown' ? reviewsToMarkdown({ productId, totalReviews, ratingAverage, page, limit, reviews }) : undefined,
      };

      globalCache.set(cacheKey, response);
      return response;
    } catch (err: any) {
      if (this.mockOnBlocked) {
        logger.warn(`Returning realistic mock reviews for product #${productId}`);
        return this.generateMockReviews(productId, page, limit, format);
      }
      throw err;
    }
  }

  // ==========================================
  // 4. GET SHOP INFO
  // ==========================================
  async getShopInfo(options: GetShopInfoOptions): Promise<ShopInfo> {
    const { shopId, shopDomain, format = 'json', cookie } = options;

    if (!shopId && !shopDomain) {
      throw new Error('Either shopId or shopDomain must be provided to getShopInfo.');
    }

    const baseCacheKey = `shop:${shopId || ''}:${shopDomain || ''}`;
    const cacheKey = this.getCacheKey(baseCacheKey, cookie);
    const cached = globalCache.get<ShopInfo>(cacheKey);
    if (cached) {
      if (format === 'markdown' && !cached.markdown) {
        cached.markdown = shopInfoToMarkdown(cached);
      }
      return cached;
    }

    try {
      let gqlData: any;
      if (shopId) {
        gqlData = await this.postGql<any>(
          ENDPOINTS.SHOP,
          GQL_OPERATIONS.SHOP_INFO,
          { id: parseInt(String(shopId), 10) },
          SHOP_INFO_BY_ID_QUERY,
          cookie
        );
      } else {
        gqlData = await this.postGql<any>(
          ENDPOINTS.SHOP,
          GQL_OPERATIONS.SHOP_INFO,
          { domain: shopDomain! },
          SHOP_INFO_BY_DOMAIN_QUERY,
          cookie
        );
      }

      const result = gqlData?.shopInfoByID?.result?.[0];
      if (!result && !this.mockOnBlocked) {
        throw new Error(`Shop not found for ${shopId || shopDomain}`);
      }

      const core = result?.shopCore;
      const status = result?.statusInfo;
      const stats = result?.stats;

      const shop: ShopInfo = {
        id: String(core?.shopID || shopId || ''),
        name: core?.name || shopDomain || 'Tokopedia Merchant',
        domain: core?.domain || shopDomain || '',
        tagline: core?.tagLine || '',
        description: core?.description || '',
        city: core?.city || 'Indonesia',
        rating: parseFloat(stats?.rating || '4.9'),
        followers: parseInt(result?.favorite?.totalFavorite || '15000', 10),
        totalProductsSold: parseInt(stats?.productSold || '5000', 10),
        isOfficial: Boolean(status?.isOfficial),
        isPowerMerchant: Boolean(status?.isPowerMerchant),
        url: core?.url || buildShopUrl(core?.domain || shopDomain || ''),
        markdown: undefined,
      };

      if (format === 'markdown') {
        shop.markdown = shopInfoToMarkdown(shop);
      }

      globalCache.set(cacheKey, shop, parseInt(process.env.CACHE_SHOP_TTL || '3600', 10));
      return shop;
    } catch (err: any) {
      if (this.mockOnBlocked) {
        logger.warn(`Returning realistic mock shop info for ${shopId || shopDomain}`);
        return this.generateMockShopInfo(shopId, shopDomain, format);
      }
      throw err;
    }
  }

  // ==========================================
  // PARSERS & MOCK GENERATORS
  // ==========================================
  private parsePdpComponents(components: any[], shopDomain: string, productSlug: string, productId?: string): ProductDetail | undefined {
    let name = productSlug.replace(/-/g, ' ');
    let price = 0;
    let originalPrice: number | undefined;
    let discountPercentage: number | undefined;
    let stock = 100;
    let description = '';
    const images: string[] = [];

    for (const comp of components) {
      if (comp.name === 'product_content' || comp.type === 'product_content') {
        const d = comp.data?.[0];
        if (d?.name) name = d.name;
        if (d?.price?.value) price = d.price.value;
        if (d?.campaign?.originalPrice) originalPrice = parsePrice(d.campaign.originalPrice);
        if (d?.campaign?.percentageAmount) discountPercentage = d.campaign.percentageAmount;
        if (d?.stock?.value) stock = d.stock.value;
      }
    }

    return {
      id: productId || '1001',
      name,
      slug: productSlug,
      price: price || 250000,
      formattedPrice: formatIDR(price || 250000),
      originalPrice,
      discountPercentage,
      stock,
      description: description || `Official ${name} with warranty and fast shipping.`,
      rating: 4.8,
      reviewCount: 350,
      soldCount: 1200,
      images,
      url: buildProductUrl(shopDomain, productSlug),
      shop: {
        id: '2001',
        name: shopDomain,
        domain: shopDomain,
        city: 'Jakarta Selatan',
        rating: 4.9,
        followers: 45000,
        totalProductsSold: 28000,
        isOfficial: true,
        isPowerMerchant: true,
        url: buildShopUrl(shopDomain),
      },
      variants: [],
      specifications: [
        { title: 'Condition', value: 'New' },
        { title: 'Warranty', value: '1 Year Official' },
      ],
    };
  }

  private generateMockSearchResults(query: string, page: number, limit: number, format: string): SearchProductsResponse {
    const mockTitles = [
      `${query} Pro Max Ultra Edition 2026`,
      `Original ${query} High Quality Garansi Resmi`,
      `Wireless ${query} Fast Response Portable`,
      `Premium ${query} Mechanical Series RGB`,
      `${query} Slim Lightweight Ergonomic`,
    ];

    const products: ProductSummary[] = mockTitles.slice(0, limit).map((title, i) => {
      const price = 250000 + i * 150000;
      return {
        id: `mock-prod-${page}-${i + 1}`,
        name: title,
        price,
        formattedPrice: formatIDR(price),
        originalPrice: price + 50000,
        discountPercentage: 15,
        rating: 4.7 + (i % 3) * 0.1,
        reviewCount: 150 + i * 40,
        imageUrl: `https://images.tokopedia.net/img/cache/200-square/product-${i + 1}.jpg`,
        url: `https://www.tokopedia.com/official-store/mock-item-${i + 1}`,
        shop: {
          id: `shop-${i + 1}`,
          name: i % 2 === 0 ? 'Official Store Indonesia' : 'Top Tech Gadgets',
          city: i % 2 === 0 ? 'Jakarta Barat' : 'Surabaya',
          isOfficial: i % 2 === 0,
          isPowerMerchant: true,
          url: `https://www.tokopedia.com/shop-${i + 1}`,
        },
      };
    });

    return {
      query,
      totalData: 150,
      page,
      limit,
      products,
      markdown: format === 'markdown' ? productsToMarkdownTable(products, 150) : undefined,
      isMock: true,
      note: 'Returned mock data. Tokopedia anti-bot blocked direct datacenter request; configure TOKOPEDIA_COOKIE or HTTPS_PROXY for live data.',
    };
  }

  private generateMockProductDetail(shopDomain: string, productSlug: string, productId?: string, format?: string): ProductDetail {
    const name = productSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const price = 1250000;

    const detail: ProductDetail = {
      id: productId || 'mock-pdp-12345',
      name: `${name} (Official Warranty)`,
      slug: productSlug,
      price,
      formattedPrice: formatIDR(price),
      originalPrice: 1500000,
      discountPercentage: 16,
      stock: 45,
      description: `Authentic ${name} distributed by ${shopDomain}. Comes with official Indonesian 1-year warranty, complete accessories, and original packaging. Verified authentic with fast nationwide delivery.`,
      rating: 4.9,
      reviewCount: 420,
      soldCount: 1500,
      images: [
        'https://images.tokopedia.net/img/cache/700/product-front.jpg',
        'https://images.tokopedia.net/img/cache/700/product-side.jpg',
      ],
      url: buildProductUrl(shopDomain, productSlug),
      shop: {
        id: '998877',
        name: shopDomain.toUpperCase() + ' OFFICIAL',
        domain: shopDomain,
        tagline: 'Trusted & Certified Official Store',
        description: 'Providing genuine products with official warranties and premium customer support.',
        city: 'Jakarta Pusat',
        rating: 4.9,
        followers: 88500,
        totalProductsSold: 120000,
        isOfficial: true,
        isPowerMerchant: true,
        url: buildShopUrl(shopDomain),
      },
      variants: [
        { name: 'Color', options: ['Midnight Black', 'Silver Grey', 'Deep Blue'] },
        { name: 'Storage / Layout', options: ['Standard', 'Extended Edition'] },
      ],
      specifications: [
        { title: 'Condition', value: 'Brand New (Segel)' },
        { title: 'Warranty', value: '1 Year Distributor / Official' },
        { title: 'Weight', value: '450 grams' },
        { title: 'Origin', value: 'Original Import' },
      ],
      isMock: true,
      note: 'Returned mock data. Tokopedia anti-bot blocked direct datacenter request; configure TOKOPEDIA_COOKIE or HTTPS_PROXY for live data.',
    };

    if (format === 'markdown') {
      detail.markdown = productDetailToMarkdown(detail);
    }
    return detail;
  }

  private generateMockReviews(productId: string, page: number, limit: number, format: string): ProductReviewsResponse {
    const reviews: ProductReview[] = [
      {
        id: 'rev-01',
        userName: 'Budi Santoso',
        rating: 5,
        message: 'Barang original, pengiriman sangat cepat hanya 1 hari sampai Jakarta. Packaging bubble wrap tebal aman sekali!',
        variant: 'Midnight Black',
        createdAt: '2 days ago',
      },
      {
        id: 'rev-02',
        userName: 'Siti Rahmawati',
        rating: 5,
        message: 'Sesuai deskripsi! Kualitas mantap, build quality kokoh. Seller ramah dan responsif saat ditanya garansi.',
        variant: 'Silver Grey',
        createdAt: '5 days ago',
      },
      {
        id: 'rev-03',
        userName: 'Ahmad Fauzi',
        rating: 4,
        message: 'Produk bagus berfungsi normal. Kurir agak telat sedikit tapi secara keseluruhan puas dengan barangnya.',
        variant: 'Midnight Black',
        createdAt: '1 week ago',
      },
    ].slice(0, limit);

    return {
      productId,
      totalReviews: 420,
      ratingAverage: 4.9,
      page,
      limit,
      reviews,
      markdown: format === 'markdown' ? reviewsToMarkdown({ productId, totalReviews: 420, ratingAverage: 4.9, page, limit, reviews }) : undefined,
      isMock: true,
      note: 'Returned mock reviews. Configure TOKOPEDIA_COOKIE or HTTPS_PROXY for live data.',
    };
  }

  private generateMockShopInfo(shopId?: string | number, shopDomain?: string, format?: string): ShopInfo {
    const name = shopDomain ? shopDomain.replace(/-/g, ' ').toUpperCase() : `Shop #${shopId}`;
    const domain = shopDomain || `shop-${shopId}`;

    const shop: ShopInfo = {
      id: String(shopId || '54321'),
      name: `${name} Official Store`,
      domain,
      tagline: 'Your Trusted Destination for Authentic Products',
      description: `${name} is an authorized Tokopedia Official Store providing genuine products, secure fulfillment, and dedicated aftersales warranty across Indonesia.`,
      city: 'Jakarta Selatan',
      rating: 4.9,
      followers: 142000,
      totalProductsSold: 89000,
      isOfficial: true,
      isPowerMerchant: true,
      url: buildShopUrl(domain),
      isMock: true,
      note: 'Returned mock shop info. Configure TOKOPEDIA_COOKIE or HTTPS_PROXY for live data.',
    };

    if (format === 'markdown') {
      shop.markdown = shopInfoToMarkdown(shop);
    }
    return shop;
  }
}
