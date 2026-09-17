/**
 * Tokopedia GraphQL and Web endpoint constants.
 */

export const TOKOPEDIA_WEB_BASE = 'https://www.tokopedia.com';
export const TOKOPEDIA_GQL_BASE = 'https://gql.tokopedia.com/graphql';

export const GQL_OPERATIONS = {
  SEARCH_PRODUCT: 'SearchProductQueryV4',
  PDP_LAYOUT: 'pdpGetLayout',
  PRODUCT_REVIEWS: 'productReviewList',
  SHOP_INFO: 'ShopInfoCore',
} as const;

export const ENDPOINTS = {
  SEARCH: `${TOKOPEDIA_GQL_BASE}/${GQL_OPERATIONS.SEARCH_PRODUCT}`,
  PDP: `${TOKOPEDIA_GQL_BASE}/${GQL_OPERATIONS.PDP_LAYOUT}`,
  REVIEWS: `${TOKOPEDIA_GQL_BASE}/${GQL_OPERATIONS.PRODUCT_REVIEWS}`,
  SHOP: `${TOKOPEDIA_GQL_BASE}/${GQL_OPERATIONS.SHOP_INFO}`,
  GENERAL_GQL: TOKOPEDIA_GQL_BASE,
};
