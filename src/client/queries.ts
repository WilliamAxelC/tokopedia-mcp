/**
 * GraphQL queries used for Tokopedia operations.
 */

export const SEARCH_PRODUCT_QUERY = `query SearchProductQueryV4($params: String!) {
  ace_search_product_v4(params: $params) {
    header {
      totalData
    }
    data {
      products {
        id
        name
        price
        imageUrl
        url
        ratingAverage
        countReview
        shop {
          id
          name
          city
          url
          isOfficial
        }
      }
    }
  }
}`;

export const PRODUCT_REVIEWS_QUERY = `query productReviewList($productID: String!, $page: Int!, $limit: Int!, $sortBy: String, $filterBy: String) {
  productrevGetProductReviewList(productID: $productID, page: $page, limit: $limit, sortBy: $sortBy, filterBy: $filterBy) {
    list {
      id: feedbackID
      variantName
      message
      productRating
      reviewCreateTime
      reviewCreateTimestamp
      user {
        fullName
        userID
      }
    }
    hasNext
    totalReviews
    ratingAverage
  }
}`;

export const SHOP_INFO_BY_ID_QUERY = `query ShopInfoCore($id: Int!) {
  shopInfoByID(input: { shopIDs: [$id], fields: ["core", "assets", "status", "favorite", "stats"] }) {
    result {
      shopCore {
        shopID
        name
        domain
        tagLine
        description
        city
        url
      }
      favorite {
        totalFavorite
      }
      statusInfo {
        isOfficial
        isPowerMerchant
        statusTitle
      }
      stats {
        rating
        totalTxSuccess
        productSold
      }
    }
  }
}`;

export const SHOP_INFO_BY_DOMAIN_QUERY = `query ShopInfoByDomain($domain: String!) {
  shopInfoByID(input: { domains: [$domain], fields: ["core", "assets", "status", "favorite", "stats"] }) {
    result {
      shopCore {
        shopID
        name
        domain
        tagLine
        description
        city
        url
      }
      favorite {
        totalFavorite
      }
      statusInfo {
        isOfficial
        isPowerMerchant
        statusTitle
      }
      stats {
        rating
        totalTxSuccess
        productSold
      }
    }
  }
}`;

export const PDP_LAYOUT_QUERY = `query pdpGetLayout($shopDomain: String, $productKey: String, $layoutID: String) {
  pdpGetLayout(shopDomain: $shopDomain, productKey: $productKey, layoutID: $layoutID) {
    name
    pdpSession
    data {
      components {
        name
        type
        data {
          ... on pdpDataProductContent {
            name
            price {
              value
              currency
            }
            campaign {
              originalPrice
              percentageAmount
            }
            stock {
              value
              stockWording
            }
          }
        }
      }
    }
  }
}`;
