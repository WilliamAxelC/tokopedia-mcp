# @williamaxelc/tokopedia-mcp

An Indonesian e-commerce Model Context Protocol (MCP) server for **Tokopedia** ([tokopedia.com](https://www.tokopedia.com)).

Allows AI assistants (Claude, Cursor, Antigravity, Cline, ChatGPT) to search products, inspect detailed technical specifications, compare prices, read verified buyer reviews, and evaluate seller reliability.

---

## Features

- **Direct GraphQL Engine**: Interacts with Tokopedia's web/mobile GraphQL endpoints (`gql.tokopedia.com`) directly for high speed, zero browser overhead, and structured JSON output.
- **Token-Optimized Shaping**: Prunes Tokopedia's internal UI/analytics layout bloat, preserving only high-value fields (~200–600 tokens per tool response).
- **Dual Transport Modes**:
  - **Stdio Mode (Default)**: Instant plug-and-play in Claude Desktop, Cursor, and Antigravity via `npx`.
  - **SSE / HTTP Mode**: Built-in Express server for multi-agent network access or deployment behind reverse proxies like Nginx.
- **Cookie & Proxy Flexibility**:
  - Out-of-the-box anonymous browsing with realistic desktop headers.
  - Optional `TOKOPEDIA_COOKIE` support for personalized searches, addresses, and challenge bypasses.
  - SOCKS5 / HTTP proxy support (`HTTP_PROXY` / `HTTPS_PROXY`) for deployment from cloud VPS/datacenters.
- **In-Memory TTL Caching**: Automatic query caching to prevent redundant requests and reduce ban risks.
- **Docker & Nginx Ready**: Pre-configured multi-stage Dockerfile and Docker Compose setup orchestrating alongside `shopee-indonesia-mcp` for `mcp.cuang.dev`.

---

## MCP Tools

### 1. `search_products`
Search for products on Tokopedia with flexible filters.
- **Inputs**:
  - `query` (string, required): Search term (e.g. `"laptop gaming"`, `"keyboard mechanical"`)
  - `page` (number, optional, default: 1): Page number
  - `limit` (number, optional, default: 20, max: 60): Items per page
  - `min_price` / `max_price` (number, optional): Price filter in IDR
  - `sort_by` (`relevance` | `price_asc` | `price_desc` | `rating` | `latest`): Sort order
  - `condition` (`all` | `new` | `used`): Product condition
  - `official_store_only` (boolean, optional): Only Official Store sellers
  - `location` (string, optional): Filter by seller city (e.g. `"Jakarta"`, `"Surabaya"`)
  - `format` (`json` | `markdown`): Return compact JSON or pre-rendered display table
  - `cookie` (string, optional): Session cookie override for this call

### 2. `get_product_detail`
Get full specifications, variants, pricing, stock, description, and seller information.
- **Inputs**:
  - `url` (string, optional): Full Tokopedia product URL
  - `product_id` (string, optional): Product ID
  - `shop_domain` + `product_slug` (string, optional): Shop domain and product slug
  - `format` (`json` | `markdown`)
  - `cookie` (string, optional)

### 3. `get_product_reviews`
Fetch customer reviews, star ratings, buyer feedback, and variants purchased.
- **Inputs**:
  - `product_id` (string, required): Tokopedia product ID
  - `rating_filter` (number, 0–5): 0 for all reviews, 1–5 for specific star ratings
  - `page` / `limit` (number, optional): Pagination
  - `format` (`json` | `markdown`)
  - `cookie` (string, optional)

### 4. `get_shop_info`
Inspect merchant profile, official badge status, rating, total products sold, and location.
- **Inputs**:
  - `shop_domain` (string, optional): Merchant slug (e.g. `"samsung"`, `"asus-official"`)
  - `shop_id` (string/number, optional): Merchant numeric ID
  - `format` (`json` | `markdown`)
  - `cookie` (string, optional)

---

## Submitting Cookies: Safety & Best Practices

You can submit Tokopedia cookies using either of two methods:

### Method A: Local npm / Stdio (Safest & Recommended)
When run locally via `npx`, your cookies **never leave your computer** and requests originate from your residential IP (which avoids datacenter IP blocks).

Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "tokopedia": {
      "command": "npx",
      "args": ["-y", "@williamaxelc/tokopedia-mcp", "--stdio"],
      "env": {
        "TOKOPEDIA_COOKIE": "_SID_Tokopedia=...; _abck=...; bm_sz=..."
      }
    }
  }
}
```

### Method B: Hosted Gateway (`mcp.cuang.dev/tokopedia`)
When connecting to a remote hosted server:
1. **Per-Tool Parameter**: Pass `cookie: "your_cookie_here"` directly in any tool call.
2. **HTTP Request Header**: Send header `X-Tokopedia-Cookie: your_cookie_here`.
3. **Server Environment**: Set `TOKOPEDIA_COOKIE` in your server's `.env` file.

> [!WARNING]
> Tokopedia session cookies contain sensitive account information. Never share your personal cookies in public chat rooms or commit them to git repositories.

---

## Deployment with Docker & Nginx (`mcp.cuang.dev`)

This repository includes a multi-service `docker-compose.yml` that runs both **Tokopedia MCP** and **Shopee MCP** behind an Nginx reverse proxy:

- `https://mcp.cuang.dev/tokopedia/sse` -> Tokopedia MCP Server
- `https://mcp.cuang.dev/shopee/sse` -> Shopee MCP Server
- `https://mcp.cuang.dev/health` -> Gateway status

### Starting the Stack
```bash
# Clone repositories side-by-side:
# /home/agent/orca/tokopedia-mcp
# /home/agent/orca/shopee-indonesia-mcp

cd tokopedia-mcp
docker compose up -d --build
```

### Nginx SSE Configuration
Nginx is pre-configured with critical streaming settings:
```nginx
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_buffering off;
proxy_cache off;
chunked_transfer_encoding on;
proxy_read_timeout 86400s;
proxy_set_header X-Forwarded-Prefix /tokopedia;
```

---

## REST API Endpoints

When running in HTTP mode, the server also provides REST endpoints:
- `GET /health`: Health and cache statistics
- `GET /api/search?q=laptop&sort_by=relevance`: Search products
- `GET /api/products/:slugOrId`: Product details
- `GET /api/products/:id/reviews`: Product reviews
- `GET /api/shops/:domainOrId`: Shop details

---

## Development & Testing

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Run unit tests (Vitest)
pnpm test

# Run live smoke test against live Tokopedia endpoints
pnpm run test:live
```

---

## License

MIT License - Copyright (c) 2026 William Axel C
