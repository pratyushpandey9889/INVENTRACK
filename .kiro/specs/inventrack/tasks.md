# Implementation Plan: INVENTRACK — Inventory + Low-Stock Alert System

## Overview

This plan breaks INVENTRACK into small, sequential coding tasks that build on each other.
Each task ends in working, testable code. The stack is:

- **Backend**: Node.js + Express + better-sqlite3 + zod + bcrypt + jsonwebtoken
- **Frontend**: React + Vite + Tailwind CSS + react-router-dom + @tanstack/react-query + recharts
- **Testing**: Vitest + Supertest + fast-check

Start at task 1 and work downward. Every task references the specific requirements it satisfies.

---

## Tasks

- [x] 1. Scaffold monorepo, install dependencies, and configure tooling
  - [x] 1.1 Create the root monorepo folder structure
    - Create `packages/backend` and `packages/frontend` directories
    - Add a root `package.json` with workspaces and a root `.gitignore`
    - In `packages/backend`: run `npm init`, install `express cors dotenv better-sqlite3 bcrypt jsonwebtoken zod uuid express-rate-limit`
    - In `packages/backend`: install dev deps `vitest supertest fast-check tsx @types/node @types/express @types/better-sqlite3 @types/bcrypt @types/jsonwebtoken`
    - Add a `packages/backend/tsconfig.json` targeting `ES2022`, `commonjs` module, `strict: true`
    - Add `packages/backend/src/index.ts` — a minimal Express app that returns `{ ok: true }` on `GET /health`
    - Add a `packages/backend/vitest.config.ts`
    - _Requirements: foundational — enables all other tasks_
  - [x] 1.2 Scaffold the React + Vite frontend
    - In `packages/frontend`: run `npm create vite@latest . -- --template react-ts`
    - Install `tailwindcss postcss autoprefixer react-router-dom @tanstack/react-query axios recharts react-hot-toast`
    - Run `npx tailwindcss init -p` and configure `tailwind.config.js` to scan `./src/**/*.{ts,tsx}`
    - Add Tailwind directives to `src/index.css`
    - Replace the default `App.tsx` with a placeholder `<h1>INVENTRACK</h1>`
    - _Requirements: foundational_

- [x] 2. Create the SQLite database schema and migration runner
  - [x] 2.1 Write the database initialisation module
    - Create `packages/backend/src/db/database.ts` that opens (or creates) `inventrack.db` using `better-sqlite3`
    - Enable WAL mode: `PRAGMA journal_mode=WAL`
    - Export a singleton `db` instance used by all other modules
    - Load the database path from `process.env.DATABASE_PATH` (fallback to `./inventrack.db`)
    - _Requirements: 2.10, 11.4_
  - [x] 2.2 Write and run the schema migration
    - Create `packages/backend/src/db/migrate.ts` with `CREATE TABLE IF NOT EXISTS` statements for all six tables: `shops`, `users`, `products`, `stock_movements`, `alerts`, `notifications` — copied verbatim from the design schema
    - Add the partial unique index for alert deduplication: `CREATE UNIQUE INDEX IF NOT EXISTS unique_open_alert ON alerts(product_id) WHERE status = 'open'`
    - Add performance indexes: `products(shop_id)`, `stock_movements(product_id, created_at)`, `alerts(product_id, status)`, `notifications(shop_id, is_read)`
    - Call `migrate()` from `src/index.ts` at startup before the server starts listening
    - _Requirements: 3.4, 10.5_
  - [x] 2.3 Write and run seed data for local development
    - Create `packages/backend/src/db/seed.ts` that inserts one test shop, one owner user (bcrypt-hashed password), and five sample products
    - Make the seed idempotent (check for existence before inserting) so it can be re-run safely
    - Add an npm script `"seed": "tsx src/db/seed.ts"` to `packages/backend/package.json`
    - _Requirements: foundational_

- [x] 3. Implement authentication (register, login, JWT middleware)
  - [x] 3.1 Create Zod validation schemas for auth
    - Create `packages/backend/src/schemas/auth.schema.ts`
    - Export `registerSchema` (name, email, password 8–72 chars, shopName) and `loginSchema` (email, password)
    - _Requirements: 7.1, 7.2, 9.1, 9.2_
  - [x] 3.2 Implement the auth service
    - Create `packages/backend/src/services/auth.service.ts`
    - Implement `register(data)`: create a shop, hash password with bcrypt cost 12, insert owner user, return signed JWT + user object
    - Implement `login(data)`: find user by email, compare password with `bcrypt.compare`, return signed JWT + user object; throw `401` if invalid
    - Sign JWTs with `process.env.JWT_SECRET`; set expiry to `'24h'`
    - Throw `409` if email already exists on register
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.2_
  - [x] 3.3 Implement JWT auth middleware
    - Create `packages/backend/src/middleware/auth.middleware.ts`
    - Extract `Authorization: Bearer <token>` header, verify with `jwt.verify`
    - Attach `{ userId, shopId, role }` to `req.user`
    - Return `401` if missing, invalid, or expired (use the exact message from requirements 7.6)
    - _Requirements: 8.1, 8.2, 7.6_
  - [x] 3.4 Implement role-guard middleware
    - Create `packages/backend/src/middleware/role.middleware.ts`
    - Export `requireOwner` middleware that returns `403` if `req.user.role !== 'owner'`
    - _Requirements: 8.3, 8.4, 1.10_
  - [x] 3.5 Wire auth routes and apply rate limiting
    - Create `packages/backend/src/routes/auth.routes.ts` with `POST /register`, `POST /login`, and `GET /me`
    - Apply `express-rate-limit` to `/register` and `/login`: max 20 requests per 15 minutes per IP, respond with `429` and `Retry-After` header
    - Apply CORS: allow `CORS_ORIGIN` in production, `http://localhost:5173` in development
    - Register all routes on the main Express app in `src/index.ts`
    - _Requirements: 7.1–7.5, 7.13, 11.3, 11.5, 11.6_
  - [ ]* 3.6 Write unit tests for auth service
    - Test `register` with valid data creates user and shop, returns token
    - Test `register` with duplicate email returns 409
    - Test `login` with wrong password returns 401 with "Invalid credentials"
    - Test `login` with unknown email returns 401 with "Invalid credentials"
    - _Requirements: 7.2, 7.3, 7.5_

- [x] 4. Implement Product CRUD API
  - [x] 4.1 Create Zod schemas for products
    - Create `packages/backend/src/schemas/product.schema.ts`
    - Export `createProductSchema` (name ≤200 chars, unit, currentStock ≥0, costPrice ≥0, sellingPrice ≥0, lowStockThreshold >0, optional sku/category)
    - Export `updateProductSchema` (all fields optional, same constraints)
    - Export `productListQuerySchema` (search, category, sortBy enum, order enum, page ≥1, limit 1–100)
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.8, 9.1, 9.6, 9.7_
  - [x] 4.2 Implement the product service
    - Create `packages/backend/src/services/product.service.ts`
    - Implement `createProduct(shopId, data)` — inserts product, returns created row
    - Implement `listProducts(shopId, query)` — applies search/filter/sort/pagination; excludes archived; returns `PaginatedResponse<Product>`
    - Implement `getProduct(shopId, id)` — returns product or throws 404
    - Implement `updateProduct(shopId, id, data)` — partial update, returns updated product
    - Implement `archiveProduct(shopId, id)` — sets `is_archived = 1`, returns `{ success: true }`
    - Use parameterised queries throughout
    - Add computed `stockStatus` field by calling `classifyStockStatus` (implemented in task 5.1)
    - _Requirements: 1.1–1.13, 9.4, 11.4_
  - [x] 4.3 Wire product routes
    - Create `packages/backend/src/routes/product.routes.ts`
    - `GET /api/products` (auth), `POST /api/products` (auth + requireOwner), `GET /api/products/:id` (auth), `PATCH /api/products/:id` (auth + requireOwner), `DELETE /api/products/:id` (auth + requireOwner)
    - Register on the main app
    - _Requirements: 1.1, 1.9, 1.10, 1.11, 8.3, 8.4, 8.5_
  - [ ]* 4.4 Write integration tests for product CRUD
    - Test `POST /api/products` with owner token creates product (201)
    - Test `POST /api/products` with staff token returns 403
    - Test `GET /api/products` excludes archived products
    - Test search, sort, and pagination query parameters
    - Test `DELETE /api/products/:id` sets `is_archived = 1` without removing related rows
    - _Requirements: 1.1–1.13, 8.4_

- [x] 5. Implement Stock Status Classifier, Stock Movements, and Audit Log
  - [x] 5.1 Implement the Stock Status Classifier pure function
    - Create `packages/backend/src/utils/classifyStockStatus.ts`
    - Implement `classifyStockStatus(currentStock: number, threshold: number): StockStatus` exactly as described in Algorithm 3 of the design
    - Export the function and its return type
    - _Requirements: 3.9, 3.10, 3.11, 3.12, 3.13, 3.14_
  - [ ]* 5.2 Write property tests for the Stock Status Classifier
    - **Property 9: Stock Status Classification Exhaustiveness** — for any `currentStock >= 0` and `threshold > 0`, the result is one of the four valid values
    - **Validates: Requirements 3.9, 3.10, 3.11, 3.12**
    - Use fast-check `fc.float({ min: 0 })` and `fc.float({ min: 0.001 })` as generators
    - Also assert the four boundary conditions as unit examples: `(0, 5)→zero`, `(5, 5)→critical`, `(5.5, 5)→warning` (within 20%), `(10, 5)→healthy`
    - _Requirements: 3.9–3.14_
  - [x] 5.3 Create Zod schemas for stock movements
    - Create `packages/backend/src/schemas/movement.schema.ts`
    - Export `createMovementSchema` (productId, changeAmount non-zero between -1e6 and 1e6, type enum, optional note)
    - Export `movementListQuerySchema` (productId, limit, before cursor, from/to timestamps)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9_
  - [x] 5.4 Implement the movement service (without alert integration)
    - Create `packages/backend/src/services/movement.service.ts`
    - Implement `createMovement(shopId, userId, data)`:
      - Validate sign convention: restock must be positive, sale/damage must be negative (Property 8)
      - Validate note required for damage/adjustment
      - Check resulting stock would not go negative (Property 1)
      - Run in a `db.transaction()`: insert `stock_movements` row, update `products.current_stock`
      - Return `{ movement, updatedProduct }`
    - Implement `listMovements(shopId, query)` — returns up to 500 movements ordered by `created_at DESC`
    - _Requirements: 2.1–2.10, 9.3_
  - [x] 5.5 Wire movement routes
    - Create `packages/backend/src/routes/movement.routes.ts`
    - `POST /api/movements` (auth), `GET /api/movements` (auth)
    - Register on the main app
    - _Requirements: 2.1, 2.7, 8.6_
  - [ ]* 5.6 Write property test for Stock Non-Negativity
    - **Property 1: Stock Non-Negativity** — for any product and any decreasing movement, if `changeAmount` would make `current_stock < 0`, the API must return 400 and leave stock unchanged
    - **Validates: Requirements 2.3, 9.3**
    - Use fast-check to generate random products and movement amounts
    - _Requirements: 2.3, 9.3_
  - [ ]* 5.7 Write property test for Movement Audit Completeness
    - **Property 3: Movement Audit Completeness** — for any accepted movement, a corresponding `stock_movements` row exists with the same productId, changeAmount, type, and userId
    - **Validates: Requirements 2.1, 2.8**
    - _Requirements: 2.1, 2.8_
  - [ ]* 5.8 Write property test for Movement Sign Convention
    - **Property 8: Movement Sign Convention** — restock always has positive changeAmount; sale/damage always have negative changeAmount; API rejects violations with 400
    - **Validates: Requirements 2.4, 2.5**
    - _Requirements: 2.4, 2.5_

- [x] 6. Implement the Alert Engine (deduplication + auto-resolve)
  - [x] 6.1 Implement the Alert Engine function
    - Create `packages/backend/src/services/alertEngine.service.ts`
    - Implement `checkAndFireAlert(productId, shopId, db)` — the exact logic from Algorithm 1 in the design:
      - If `current_stock <= low_stock_threshold` AND no open alert exists → insert alert + notification
      - If `current_stock <= low_stock_threshold` AND open alert already exists → do nothing (deduplication)
      - If `current_stock > low_stock_threshold` AND open alert exists → resolve the alert and mark the notification read
    - This function must be called inside the same `db.transaction()` used by `createMovement`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 6.2 Integrate Alert Engine into the movement service
    - Update `packages/backend/src/services/movement.service.ts`
    - After updating `current_stock` inside the transaction, call `checkAndFireAlert(productId, shopId, db)`
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 6.3 Implement the alerts service and routes
    - Create `packages/backend/src/services/alert.service.ts`
    - Implement `listAlerts(shopId, query)` — paginated, filterable by status, default page size 20, max 100
    - Implement `updateAlertStatus(shopId, alertId, status)` — accepts `'ordered'` or `'dismissed'`; returns updated alert
    - Create `packages/backend/src/routes/alert.routes.ts`
    - `GET /api/alerts` (auth), `PATCH /api/alerts/:id` (auth)
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 4.6, 4.7, 4.8, 10.3_
  - [ ]* 6.4 Write property test for Alert Deduplication
    - **Property 2: Alert Deduplication** — for any product and any sequence of movements that keep stock at or below threshold, the count of open alerts for that product is always ≤ 1
    - **Validates: Requirements 3.2, 3.4**
    - Use fast-check to generate sequences of decreasing stock movements and assert the invariant
    - _Requirements: 3.2, 3.4_
  - [ ]* 6.5 Write property test for Alert-Stock Consistency
    - **Property 4: Alert-Stock Consistency** — an open alert implies `current_stock <= low_stock_threshold`; a restock above threshold resolves any open alert
    - **Validates: Requirements 3.1, 3.3, 3.6**
    - _Requirements: 3.1, 3.3, 3.6_
  - [ ]* 6.6 Write integration tests for alert flow
    - Test `POST /api/movements` (stock drops below threshold) → alert created, notification created
    - Test `POST /api/movements` called twice on same sub-threshold product → only 1 alert and 1 notification
    - Test `POST /api/movements` (restock above threshold) → alert resolved
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 7. Checkpoint — ensure all backend core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement the Reorder Suggestion Engine
  - [x] 8.1 Implement the Reorder Engine function
    - Create `packages/backend/src/services/reorderEngine.service.ts`
    - Implement `calculateReorderSuggestion(productId, lookbackDays, db)` — exactly following Algorithm 2 from the design:
      - Query total outbound (sale + damage) and count distinct active days in the lookback window
      - If fewer than 3 active days or zero total outbound: `fallback = true`, `suggestedQty = MAX(1, CEILING(threshold * 2))`
      - Otherwise: `suggestedQty = CEILING((totalOut / lookbackDays) * lookbackDays * 2)`, `fallback = false`
    - Export the `ReorderSuggestion` type
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 8.2 Write property test for Reorder Suggestion Coverage
    - **Property 7: Reorder Suggestion Coverage** — for any product with any movement history, `suggestedQty >= 1` always; when fewer than 3 active days, `fallback = true` and `suggestedQty = CEILING(threshold * 2)`
    - **Validates: Requirements 4.3, 4.2**
    - _Requirements: 4.2, 4.3_
  - [ ]* 8.3 Write property test for Velocity-Based Reorder Formula
    - **Property 10: Velocity-Based Reorder Formula** — for a product with ≥3 active sale/damage days and non-zero totalOut, `suggestedQty = CEILING((totalOut / lookbackDays) * lookbackDays * 2)` and `fallback = false`
    - **Validates: Requirements 4.1**
    - _Requirements: 4.1_
  - [x] 8.4 Integrate Reorder Engine into the alert service
    - Update `packages/backend/src/services/alert.service.ts` so that `listAlerts` enriches each alert with the reorder suggestion by calling `calculateReorderSuggestion`
    - Add `suggestedReorderQty`, `avgDailyUsage`, and `daysSinceLastRestock` to every `AlertWithProduct` object returned
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 9. Implement the Notification system
  - [x] 9.1 Implement the notification service
    - Create `packages/backend/src/services/notification.service.ts`
    - Implement `listNotifications(shopId, limit)` — returns the most recent `limit` (default 20) notifications for the shop ordered by `created_at DESC`
    - Implement `getUnreadCount(shopId)` — returns `{ count: number }` by counting rows where `shop_id = shopId AND is_read = 0`
    - Implement `markRead(shopId, ids)` — accepts `string[]` or the string `'all'`; sets `is_read = 1` for matching notifications in the shop; returns `{ updated: number }`
    - _Requirements: 6.5, 6.6, 6.7_
  - [x] 9.2 Wire notification routes
    - Create `packages/backend/src/routes/notification.routes.ts`
    - `GET /api/notifications` (auth), `GET /api/notifications/unread-count` (auth), `POST /api/notifications/mark-read` (auth)
    - Register on the main app
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7_
  - [ ]* 9.3 Write property test for Notification Unread Count Accuracy
    - **Property 11: Notification Unread Count Accuracy** — `GET /api/notifications/unread-count` always equals the number of unread notifications for the shop; after `mark-read { ids: 'all' }`, count is 0
    - **Validates: Requirements 6.7, 6.6**
    - _Requirements: 6.6, 6.7_

- [x] 10. Implement the Dashboard API
  - [x] 10.1 Implement the dashboard service
    - Create `packages/backend/src/services/dashboard.service.ts`
    - Implement `getDashboardSummary(shopId)` — returns a `DashboardSummary` in a single SQL CTE query:
      - `totalProducts` = count of non-archived products
      - `lowStockCount` = count of non-archived products where `current_stock <= low_stock_threshold`
      - `zeroStockCount` = count where `current_stock = 0`
      - `totalInventoryValue` = SUM of `current_stock * cost_price`, rounded to 2 decimal places
      - `urgentAlerts` = top 5 open alerts ordered by: zero-stock first, then by ascending `current_stock / low_stock_threshold` ratio, then by ascending `triggered_at`; each enriched with reorder suggestion
      - `recentMovements` = last 10 movements enriched with `productName` and `userName`
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 10.2 Wire the dashboard route
    - Create `packages/backend/src/routes/dashboard.routes.ts`
    - `GET /api/dashboard` (auth)
    - Register on the main app
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 10.3 Write property test for Dashboard Aggregate Correctness
    - **Property 12: Dashboard Aggregate Correctness** — for any shop state, `totalProducts`, `lowStockCount`, `zeroStockCount`, and `totalInventoryValue` match the direct SQL counts/aggregates
    - **Validates: Requirements 5.1**
    - _Requirements: 5.1_
  - [ ]* 10.4 Write integration tests for dashboard endpoint
    - Seed products with known stock values and verify all four summary counts are exact
    - _Requirements: 5.1, 5.2_

- [x] 11. Implement User Management API (owner-only staff accounts)
  - [x] 11.1 Create Zod schemas for user management
    - Create `packages/backend/src/schemas/user.schema.ts`
    - Export `createStaffSchema` (name, email, password 8–72 chars)
    - Export `updateStaffSchema` (name?, email?)
    - _Requirements: 7.7, 7.8, 9.1_
  - [x] 11.2 Implement the user management service
    - Create `packages/backend/src/services/user.service.ts`
    - Implement `listStaff(shopId)` — returns users with `role = 'staff'` for the shop
    - Implement `createStaff(shopId, data)` — hashes password, inserts user with `role = 'staff'`; throws 409 on duplicate email
    - Implement `updateStaff(shopId, id, data)` — updates name/email
    - Implement `deactivateStaff(shopId, id)` — marks account inactive so logins return 401
    - _Requirements: 7.7–7.12_
  - [x] 11.3 Wire user management routes
    - Create `packages/backend/src/routes/user.routes.ts`
    - `GET /api/users` (auth + requireOwner), `POST /api/users` (auth + requireOwner), `PATCH /api/users/:id` (auth + requireOwner), `DELETE /api/users/:id` (auth + requireOwner)
    - Register on main app
    - _Requirements: 7.9, 8.3_
  - [ ]* 11.4 Write property test for Role Authorization
    - **Property 5: Role Authorization** — for any staff-token request to `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`, the response is always 403; staff can always succeed on `POST /api/movements`
    - **Validates: Requirements 8.2, 8.3, 8.5, 7.7**
    - Use fast-check to generate random-but-valid payloads and assert 403
    - _Requirements: 8.2, 8.3, 8.5_
  - [ ]* 11.5 Write property test for Shop Isolation
    - **Property 6: Shop Isolation** — for any resource request, every returned resource has `shopId` matching the JWT's `shopId`; cross-shop access returns 404
    - **Validates: Requirements 1.3, 8.6, 11.6, 11.7**
    - _Requirements: 1.3, 8.6, 11.7_
  - [ ]* 11.6 Write property test for Paginated List Integrity
    - **Property 13: Paginated List Integrity** — for any page/limit combination, `data.length <= limit`, `total` matches the unpaginated count, and no item violates the active filters
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 10.2, 10.3, 10.4**
    - _Requirements: 1.7, 10.1, 10.2, 10.3_

- [x] 12. Checkpoint — full backend tests pass, backend is feature-complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Frontend: auth screens (register + login)
  - [x] 13.1 Create the API client and auth context
    - Create `packages/frontend/src/lib/api.ts` — an Axios instance that reads `VITE_API_URL` from env, attaches the JWT from localStorage on every request, and redirects to `/login` on 401
    - Create `packages/frontend/src/context/AuthContext.tsx` — stores `{ user, token }` in state, provides `login()`, `logout()`, and `register()` functions that call the API and persist the token to localStorage
    - Wrap `<App>` in `<AuthContext.Provider>` inside `main.tsx`
    - _Requirements: 7.4, 7.1_
  - [x] 13.2 Build the Login page
    - Create `packages/frontend/src/pages/LoginPage.tsx`
    - Form fields: email, password; submit calls `login()` from AuthContext
    - On success, navigate to `/`; on failure, show a toast with the error message
    - Add a link to the Register page
    - _Requirements: 7.4, 7.5_
  - [x] 13.3 Build the Register page
    - Create `packages/frontend/src/pages/RegisterPage.tsx`
    - Form fields: name, shop name, email, password, confirm password
    - Client-side validation: password ≥ 8 characters, passwords match
    - On success, navigate to `/`; on error, show a toast
    - _Requirements: 7.1, 7.2_
  - [x] 13.4 Set up React Router with a protected route wrapper
    - Create `packages/frontend/src/router/ProtectedRoute.tsx` — redirects to `/login` if no token
    - Configure routes in `App.tsx`: `/login`, `/register` (public); `/`, `/inventory`, `/inventory/:id`, `/alerts`, `/settings` (protected)
    - _Requirements: 8.1_

- [x] 14. Frontend: inventory table and product CRUD UI
  - [x] 14.1 Build the shared layout shell with navigation
    - Create `packages/frontend/src/components/Layout.tsx` — top nav with app logo, nav links (Dashboard, Inventory, Alerts, Settings), and a right-side placeholder for the notification bell
    - The nav links should highlight the active route
    - _Requirements: 6.1_
  - [x] 14.2 Build the Stock Status Badge component
    - Create `packages/frontend/src/components/StockBadge.tsx`
    - Accepts a `StockStatus` prop and renders a colored pill: `zero` = dark gray/black, `critical` = red, `warning` = yellow, `healthy` = green
    - _Requirements: 3.9_
  - [x] 14.3 Build the Inventory Table page
    - Create `packages/frontend/src/pages/InventoryPage.tsx`
    - Use `@tanstack/react-query` to fetch `GET /api/products`
    - Render a sortable table with columns: Name, SKU, Category, Stock (with StockBadge), Threshold, Unit Value, Actions
    - Add a search input and category dropdown that debounce and update the query params
    - Add an "Add Product" button (hidden from staff via role check); row actions: Adjust Stock, Edit, Archive
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.10, 3.9_
  - [x] 14.4 Build the Add/Edit Product modal
    - Create `packages/frontend/src/components/ProductModal.tsx`
    - Fields: name, SKU (optional), category (optional), unit, initial stock, cost price, selling price, low-stock threshold
    - On submit, call `POST /api/products` (create) or `PATCH /api/products/:id` (edit)
    - Show field-level validation errors from the API response
    - On success, invalidate the product list query and show a success toast
    - _Requirements: 1.1, 1.2, 1.9_

- [ ] 15. Frontend: stock adjustment modal
  - [-] 15.1 Build the Stock Adjustment Modal
    - Create `packages/frontend/src/components/StockAdjustmentModal.tsx`
    - Fields: movement type (radio: Restock / Sale / Damage / Adjustment), quantity (positive number), note (text input, shown with a required indicator when type is Damage or Adjustment)
    - Live preview below the form: "New stock will be: X units" — calculated as `currentStock + (type === 'restock' ? qty : -qty)`
    - Disable the submit button if the resulting stock would drop below 0
    - On submit, call `POST /api/movements`
    - On success, show a toast, invalidate product + dashboard queries, call `onSuccess(updatedProduct)`
    - On error, display the API's `message` field in a red banner inside the modal
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.3_

- [ ] 16. Frontend: alerts dashboard
  - [-] 16.1 Build the Alert Card component
    - Create `packages/frontend/src/components/AlertCard.tsx`
    - Displays: product name, current stock vs threshold (with StockBadge), days since last restock, reorder suggestion text (velocity-based or fallback format from requirements 4.4 and 4.5), "Mark as Ordered" and "Dismiss" buttons
    - On "Mark as Ordered" click, call `PATCH /api/alerts/:id { status: 'ordered' }`; on success, update the card status optimistically
    - On "Dismiss" click, call `PATCH /api/alerts/:id { status: 'dismissed' }`; on success, remove the card from the list
    - If the API call fails, show an error message and revert the card state
    - _Requirements: 3.5, 3.8, 4.4, 4.5, 5.4, 5.5, 5.6_
  - [ ] 16.2 Build the Alerts Dashboard page
    - Create `packages/frontend/src/pages/AlertsPage.tsx`
    - Tabs: Open | Ordered | Dismissed | All — each tab fetches `GET /api/alerts?status=<tab>`
    - Render `<AlertCard>` for each alert in the current tab
    - Show a "No alerts" placeholder when the list is empty
    - _Requirements: 3.5, 3.6, 3.7, 3.8_

- [ ] 17. Frontend: notification bell component
  - [-] 17.1 Build the Notification Bell component
    - Create `packages/frontend/src/components/NotificationBell.tsx`
    - Use `@tanstack/react-query` with `refetchInterval: 30_000` to poll `GET /api/notifications/unread-count`
    - Display a badge with the count; if count > 99, show "99+"
    - If the poll fails, retain the last known count (do not reset to zero)
    - On bell click, fetch `GET /api/notifications` and display the last 20 in a dropdown panel
    - If the notifications fetch fails, show an error message inside the dropdown instead of a blank panel
    - Add a "Mark all read" button in the dropdown that calls `POST /api/notifications/mark-read { ids: 'all' }` and, on success, sets the unread count to 0
    - If mark-read fails, show an error toast and do not update the count
    - Place `<NotificationBell>` in the top-right of the `<Layout>` nav bar
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

- [ ] 18. Frontend: dashboard home screen
  - [-] 18.1 Build the Summary Cards component
    - Create `packages/frontend/src/components/SummaryCards.tsx`
    - Four cards: Total Products, Low-Stock Items (highlighted in red/orange), Total Inventory Value, Zero-Stock Count
    - Fetch data via `GET /api/dashboard`
    - _Requirements: 5.1_
  - [~] 18.2 Build the Dashboard page
    - Create `packages/frontend/src/pages/DashboardPage.tsx`
    - Compose: `<SummaryCards>` at top, then an "Urgent Alerts" section rendering the top 5 `urgentAlerts` as `<AlertCard>` components, then a "Recent Activity" table showing the last 10 movements (product name, change amount, type, who, when)
    - When "Mark as Ordered" or "Dismiss" succeeds, update the card state without a full page reload
    - When the action fails, display an error message and leave the card unchanged
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 19. Frontend: product detail page with 30-day chart
  - [~] 19.1 Build the 30-day stock history chart
    - Create `packages/frontend/src/components/StockHistoryChart.tsx`
    - Fetch `GET /api/movements?productId=<id>&from=<30daysAgo>` and transform the data into a time-series of stock levels (each point = `createdAt` + cumulative stock level)
    - Use `recharts` `<LineChart>` to render the chart; x-axis = date, y-axis = stock quantity
    - Show a loading skeleton while fetching and an error message if the fetch fails
    - _Requirements: 2.11_
  - [~] 19.2 Build the Product Detail page
    - Create `packages/frontend/src/pages/ProductDetailPage.tsx`
    - Fetch product via `GET /api/products/:id`
    - Render product info at the top (name, SKU, category, unit, prices, threshold) — fields are editable by owner (inline edit opens the ProductModal)
    - Render `<StockHistoryChart>` below the product info
    - Render a paginated movement log table below the chart (columns: date, type, change, note, performed by)
    - _Requirements: 2.11, 1.9_

- [ ] 20. Frontend: settings and staff management
  - [~] 20.1 Build the Staff Management table
    - Create `packages/frontend/src/components/StaffTable.tsx`
    - Fetch `GET /api/users` to list staff members (only visible to owner)
    - Render a table with columns: name, email, date joined, actions (Edit, Deactivate)
    - "Invite Staff" button opens a modal form (name, email, password)
    - Deactivate button calls `DELETE /api/users/:id`; on success, remove the row
    - Edit button opens a modal to update name/email
    - _Requirements: 7.7–7.12_
  - [~] 20.2 Build the Settings page
    - Create `packages/frontend/src/pages/SettingsPage.tsx`
    - Sections: "Account" (edit own name and email), "Staff Management" (renders `<StaffTable>`, owner-only — show a "You don't have access" message to staff)
    - _Requirements: 7.7, 7.9_

- [~] 21. Checkpoint — frontend is feature-complete, all screens wired
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Deployment configuration
  - [~] 22.1 Write production environment configuration
    - Add `packages/backend/.env.example` with: `DATABASE_PATH`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV`, `PORT`
    - Add `packages/frontend/.env.example` with: `VITE_API_URL`
    - Add a root `README.md` explaining how to run locally and how to set environment variables
    - _Requirements: 11.2, 11.5, 11.6_
  - [~] 22.2 Add production build scripts and a health check
    - Add a `"build"` npm script to `packages/backend/package.json` that compiles TypeScript to `dist/`
    - Add a `"start"` script: `node dist/index.js`
    - Update `GET /health` to return `{ ok: true, env: process.env.NODE_ENV }` — useful for Render/Railway health checks
    - Add a `"build"` script to `packages/frontend/package.json` that runs `vite build`
    - _Requirements: foundational_

- [~] 23. Final checkpoint — all tests pass, project is ready to deploy
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 7, 12, 21, 23) are sync points — verify tests before moving on
- Property tests validate universal correctness invariants; unit/integration tests validate specific flows
- All API calls in the frontend use the Axios instance from `src/lib/api.ts` — never fetch directly
- Keep `.env` files out of version control; commit only `.env.example`

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2"],
      "note": "Scaffold both packages independently and in parallel"
    },
    {
      "id": 1,
      "tasks": ["2.1"],
      "note": "DB module depends on backend scaffold"
    },
    {
      "id": 2,
      "tasks": ["2.2", "2.3"],
      "note": "Migration and seed both depend on the DB module"
    },
    {
      "id": 3,
      "tasks": ["3.1", "3.2"],
      "note": "Auth schemas and auth service depend on DB being ready"
    },
    {
      "id": 4,
      "tasks": ["3.3", "3.4"],
      "note": "Middleware depends on the auth service being available"
    },
    {
      "id": 5,
      "tasks": ["3.5", "3.6"],
      "note": "Auth routes wire together schemas + service + middleware; tests verify the wired flow"
    },
    {
      "id": 6,
      "tasks": ["4.1", "5.1"],
      "note": "Product schemas and the Stock Status Classifier are independent; both need only DB + auth"
    },
    {
      "id": 7,
      "tasks": ["5.2", "4.2"],
      "note": "Property test for classifier; product service depends on classifier (stockStatus field)"
    },
    {
      "id": 8,
      "tasks": ["4.3", "5.3"],
      "note": "Product routes (depends on service + middleware); movement schemas (depends on DB)"
    },
    {
      "id": 9,
      "tasks": ["4.4", "5.4"],
      "note": "Product integration tests; movement service (depends on schemas + DB)"
    },
    {
      "id": 10,
      "tasks": ["5.5"],
      "note": "Movement routes depend on movement service + auth middleware"
    },
    {
      "id": 11,
      "tasks": ["5.6", "5.7", "5.8"],
      "note": "Property tests for movement properties — all depend on routes being wired"
    },
    {
      "id": 12,
      "tasks": ["6.1"],
      "note": "Alert Engine depends on movement service being implemented"
    },
    {
      "id": 13,
      "tasks": ["6.2"],
      "note": "Alert Engine integration into movement service depends on Alert Engine existing"
    },
    {
      "id": 14,
      "tasks": ["6.3"],
      "note": "Alert service and routes depend on Alert Engine being integrated"
    },
    {
      "id": 15,
      "tasks": ["6.4", "6.5", "6.6"],
      "note": "Alert property tests and integration tests depend on alert routes being wired"
    },
    {
      "id": 16,
      "tasks": ["8.1"],
      "note": "Reorder Engine depends on movement data being in DB (movement service complete)"
    },
    {
      "id": 17,
      "tasks": ["8.2", "8.3", "8.4"],
      "note": "Reorder property tests and alert enrichment depend on Reorder Engine"
    },
    {
      "id": 18,
      "tasks": ["9.1", "10.1", "11.1"],
      "note": "Notification service, dashboard service, and user schemas are independent of each other"
    },
    {
      "id": 19,
      "tasks": ["9.2", "10.2", "11.2"],
      "note": "Routes for each new service depend on their respective services"
    },
    {
      "id": 20,
      "tasks": ["9.3", "10.3", "10.4", "11.3"],
      "note": "Property/integration tests for notifications, dashboard, and user management routes"
    },
    {
      "id": 21,
      "tasks": ["11.4", "11.5", "11.6"],
      "note": "Role auth, shop isolation, and pagination property tests — need all routes wired"
    },
    {
      "id": 22,
      "tasks": ["13.1"],
      "note": "API client + auth context is the foundation for all frontend pages"
    },
    {
      "id": 23,
      "tasks": ["13.2", "13.3"],
      "note": "Login and register pages depend on auth context"
    },
    {
      "id": 24,
      "tasks": ["13.4", "14.1", "14.2"],
      "note": "Router setup, layout shell, and stock badge are independent; all need auth context"
    },
    {
      "id": 25,
      "tasks": ["14.3", "15.1"],
      "note": "Inventory table and stock adjustment modal both depend on layout + badge + router"
    },
    {
      "id": 26,
      "tasks": ["14.4"],
      "note": "Add/Edit product modal depends on inventory table being built"
    },
    {
      "id": 27,
      "tasks": ["16.1", "17.1"],
      "note": "Alert card and notification bell are independent; both need layout shell"
    },
    {
      "id": 28,
      "tasks": ["16.2", "18.1"],
      "note": "Alerts page depends on AlertCard; SummaryCards component is independent"
    },
    {
      "id": 29,
      "tasks": ["18.2"],
      "note": "Dashboard page composes SummaryCards + AlertCard — depends on both"
    },
    {
      "id": 30,
      "tasks": ["19.1"],
      "note": "Stock history chart depends on router + query client setup"
    },
    {
      "id": 31,
      "tasks": ["19.2", "20.1"],
      "note": "Product detail page depends on chart; staff table depends on layout + router"
    },
    {
      "id": 32,
      "tasks": ["20.2"],
      "note": "Settings page composes StaffTable — depends on StaffTable being built"
    },
    {
      "id": 33,
      "tasks": ["22.1", "22.2"],
      "note": "Deployment config is independent of frontend/backend feature work — can run in final wave"
    }
  ]
}
```
