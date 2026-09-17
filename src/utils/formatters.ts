import {
  ProductSummary,
  ProductDetail,
  ProductReviewsResponse,
  ShopInfo,
} from '../client/types.js';

/**
 * Format a number or numeric string as Indonesian Rupiah (IDR).
 * E.g. 1500000 -> "Rp 1.500.000"
 */
export function formatIDR(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') {
    return 'Rp 0';
  }
  const numeric = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, ''));
  if (isNaN(numeric)) {
    return String(amount);
  }
  return `Rp ${Math.round(numeric).toLocaleString('id-ID')}`;
}

/**
 * Parses numeric price from a Tokopedia raw price string (e.g. "Rp1.500.000", "Rp 25.000", or 25000).
 */
export function parsePrice(priceVal: string | number | undefined | null): number {
  if (typeof priceVal === 'number') return priceVal;
  if (!priceVal) return 0;
  const cleaned = String(priceVal).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Extracts shop domain and product slug from a Tokopedia URL.
 * Example: https://www.tokopedia.com/samsung/samsung-galaxy-s24-ultra-5g
 * Returns: { shopDomain: "samsung", productSlug: "samsung-galaxy-s24-ultra-5g" }
 */
export function parseTokopediaUrl(url: string): { shopDomain?: string; productSlug?: string } {
  try {
    const cleaned = url.split('?')[0].trim();
    const urlObj = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    const segments = urlObj.pathname.split('/').filter(Boolean);

    if (segments.length >= 2) {
      return {
        shopDomain: segments[0],
        productSlug: segments[1],
      };
    } else if (segments.length === 1) {
      return {
        shopDomain: segments[0],
      };
    }
  } catch {
    // URL parsing failed, try simple regex
    const match = url.match(/tokopedia\.com\/([^\/?#]+)\/([^\/?#]+)/);
    if (match) {
      return { shopDomain: match[1], productSlug: match[2] };
    }
  }
  return {};
}

/**
 * Builds a canonical product URL on Tokopedia.
 */
export function buildProductUrl(shopDomain: string, productSlug: string): string {
  if (!shopDomain || !productSlug) return 'https://www.tokopedia.com';
  return `https://www.tokopedia.com/${shopDomain}/${productSlug}`;
}

/**
 * Builds a canonical shop URL on Tokopedia.
 */
export function buildShopUrl(shopDomain: string): string {
  if (!shopDomain) return 'https://www.tokopedia.com';
  return `https://www.tokopedia.com/${shopDomain}`;
}

/**
 * Converts a list of product summaries into a clean Markdown table.
 */
export function productsToMarkdownTable(products: ProductSummary[], totalData?: number): string {
  if (!products || products.length === 0) {
    return 'No products found matching the criteria.';
  }

  const lines: string[] = [];
  if (totalData !== undefined) {
    lines.push(`### Search Results (${totalData.toLocaleString('id-ID')} items found)\n`);
  }

  lines.push('| # | Product Name | Price | Rating | Reviews | Shop | City | Link |');
  lines.push('|---|---|---|---|---|---|---|---|');

  products.forEach((p, idx) => {
    const ratingStr = p.rating ? `⭐ ${p.rating.toFixed(1)}` : '-';
    const reviewStr = p.reviewCount ? `${p.reviewCount.toLocaleString('id-ID')}` : '-';
    const shopBadge = p.shop.isOfficial ? '👑 [OS]' : p.shop.isPowerMerchant ? '⚡ [PM]' : '';
    const shopName = `${p.shop.name} ${shopBadge}`.trim();
    const link = `[View Item](${p.url})`;

    // Sanitize pipe characters in product name
    const safeName = p.name.replace(/\|/g, '-');

    lines.push(
      `| ${idx + 1} | **${safeName}** | ${p.formattedPrice} | ${ratingStr} | ${reviewStr} | ${shopName} | ${p.shop.city || '-'} | ${link} |`
    );
  });

  return lines.join('\n');
}

/**
 * Converts detailed product information into a clean Markdown summary.
 */
export function productDetailToMarkdown(product: ProductDetail): string {
  const lines: string[] = [];

  lines.push(`# ${product.name}\n`);
  lines.push(`**Price:** ${product.formattedPrice}`);
  if (product.originalPrice && product.discountPercentage) {
    lines.push(`**Original Price:** ${formatIDR(product.originalPrice)} *(-${product.discountPercentage}%)*`);
  }
  lines.push(`**Stock:** ${product.stock > 0 ? `${product.stock} available` : 'Out of stock'}`);
  lines.push(`**Rating:** ⭐ ${product.rating.toFixed(1)} (${product.reviewCount.toLocaleString('id-ID')} reviews, ${product.soldCount.toLocaleString('id-ID')} sold)`);
  lines.push(`**Seller:** [${product.shop.name}](${product.shop.url}) (${product.shop.city}) ${product.shop.isOfficial ? '👑 Official Store' : product.shop.isPowerMerchant ? '⚡ Power Merchant' : ''}`);
  lines.push(`**Product Link:** ${product.url}\n`);

  if (product.variants && product.variants.length > 0) {
    lines.push('### Available Variants');
    product.variants.forEach((v) => {
      lines.push(`- **${v.name}:** ${v.options.join(', ')}`);
    });
    lines.push('');
  }

  if (product.specifications && product.specifications.length > 0) {
    lines.push('### Specifications');
    lines.push('| Attribute | Value |');
    lines.push('|---|---|');
    product.specifications.forEach((spec) => {
      lines.push(`| ${spec.title} | ${spec.value} |`);
    });
    lines.push('');
  }

  if (product.description) {
    lines.push('### Description');
    lines.push(product.description.length > 1000 ? `${product.description.slice(0, 1000)}...\n*(truncated)*` : product.description);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Converts product reviews into a clean Markdown summary.
 */
export function reviewsToMarkdown(response: ProductReviewsResponse): string {
  const lines: string[] = [];

  lines.push(`### Customer Reviews for Product #${response.productId}\n`);
  lines.push(`**Total Reviews:** ${response.totalReviews.toLocaleString('id-ID')} | **Average Rating:** ⭐ ${response.ratingAverage.toFixed(1)}\n`);

  if (!response.reviews || response.reviews.length === 0) {
    lines.push('No written reviews found.');
    return lines.join('\n');
  }

  response.reviews.forEach((r, idx) => {
    const starStr = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    lines.push(`**${idx + 1}. ${r.userName || 'Anonymous'}** \`(${starStr} ${r.rating}/5)\``);
    if (r.variant) {
      lines.push(`*Variant: ${r.variant}*`);
    }
    if (r.createdAt) {
      lines.push(`*Date: ${r.createdAt}*`);
    }
    lines.push(`> ${r.message || '(No review comment)'}\n`);
  });

  return lines.join('\n');
}

/**
 * Converts shop information into a clean Markdown summary.
 */
export function shopInfoToMarkdown(shop: ShopInfo): string {
  const lines: string[] = [];

  const badgeStr = shop.isOfficial ? '👑 Official Store' : shop.isPowerMerchant ? '⚡ Power Merchant Pro' : 'Regular Merchant';

  lines.push(`# ${shop.name} (${badgeStr})\n`);
  if (shop.tagline) {
    lines.push(`> *${shop.tagline}*\n`);
  }
  lines.push(`**Location:** ${shop.city || 'Indonesia'}`);
  lines.push(`**Rating:** ⭐ ${shop.rating.toFixed(1)} / 5.0`);
  lines.push(`**Followers:** ${shop.followers.toLocaleString('id-ID')}`);
  lines.push(`**Products Sold:** ${shop.totalProductsSold.toLocaleString('id-ID')}`);
  lines.push(`**Shop URL:** ${shop.url}\n`);

  if (shop.description) {
    lines.push('### Shop Description');
    lines.push(shop.description.length > 800 ? `${shop.description.slice(0, 800)}...\n*(truncated)*` : shop.description);
  }

  return lines.join('\n');
}
