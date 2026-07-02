# Requirements Document

## Introduction

INVENTRACK is a web-based inventory management system for small shop owners (grocery, hardware, pharmacy, boutique). It replaces manual spreadsheet tracking with a clean, mobile-responsive application that manages products and stock levels, logs every stock movement, automatically flags low-stock items, suggests reorder quantities based on real sales velocity, and delivers in-app notifications through a bell icon. The system supports two roles — Shop Owner (full access) and Staff Member (stock updates and read access only).

---

## Glossary

- **System**: The INVENTRACK web application (React frontend + Express API + SQLite/PostgreSQL database).
- **API**: The Node.js/Express REST API server that processes all data operations.
- **Frontend**: The React + Vite single-page application served to users in a browser.
- **Shop**: A single business entity whose data is isolated from all other shops in the system.
- **Owner**: A user with the `owner` role who has full access to all features within their shop.
- **Staff**: A user with the `staff` role who may update stock and view data but may not delete products or manage user accounts.
- **Product**: A physical item tracked by the system, belonging to exactly one shop.
- **SKU**: Stock Keeping Unit — an optional unique code assigned to a product for identification.
- **current_stock**: The current quantity on hand for a product, always a non-negative real number.
- **low_stock_threshold**: The quantity at or below which a product is considered low-stock and triggers an alert.
- **StockMovement**: An immutable audit record of a change to a product's `current_stock`, including amount, type, performer, and timestamp.
- **MovementType**: One of `restock`, `sale`, `damage`, or `adjustment`.
- **Alert**: A record indicating a product's stock has fallen to or below its threshold. At most one `open` alert may exist per product at any time.
- **AlertStatus**: One of `open`, `ordered`, `dismissed`, or `resolved`.
- **Notification**: An in-app message linked to an alert, powering the bell icon unread count.
- **Alert_Engine**: The server-side component that runs after every stock movement to create, deduplicate, or resolve alerts.
- **Reorder_Engine**: The server-side component that calculates suggested reorder quantities from movement history.
- **Stock_Classifier**: The pure function `classifyStockStatus(currentStock, threshold)` that returns a stock status badge value.
- **StockStatus**: One of `zero`, `critical`, `warning`, or `healthy` — computed from `current_stock` and `low_stock_threshold`.
- **Dashboard**: The home screen displaying summary statistics, urgent alerts, and recent activity.
- **JWT**: JSON Web Token — the bearer credential used to authenticate API requests.

---

## Requirements

### Requirement 1: Product Management

**User Story:** As a shop owner, I want to add, view, edit, and archive products, so that I can maintain an accurate and up-to-date product catalogue for my shop.

#### Acceptance Criteria

1. WHEN an Owner submits a create-product request with all required fields (`name` as a non-empty string up to 200 characters, `unit` as a non-empty string, `currentStock` as a number >= 0, `costPrice` as a number >= 0, `sellingPrice` as a number >= 0, and `lowStockThreshold` as a number > 0), THE API SHALL create a new Product record scoped to the Owner's Shop and return the created Product with HTTP 201.
2. IF a create-product request is missing any required field (`name`, `unit`, `currentStock`, `costPrice`, `sellingPrice`, `lowStockThreshold`), THEN THE API SHALL return a `400 Bad Request` response identifying which field(s) are missing.
3. WHEN an authenticated user requests the product list, THE API SHALL return only Products belonging to the requesting user's Shop.
4. WHEN a product list request includes a `search` query parameter, THE API SHALL return only Products whose `name` or `SKU` contains the search string (case-insensitive).
5. WHEN a product list request includes a `category` filter parameter, THE API SHALL return only Products whose `category` exactly matches the parameter value (case-insensitive).
6. WHEN a product list request includes a `sortBy` parameter with one of the accepted values (`name`, `current_stock`, `low_stock_threshold`, `cost_price`, `selling_price`, `created_at`) and an `order` parameter of `asc` or `desc`, THE API SHALL return Products sorted by the specified field in the specified direction.
7. WHEN a product list request includes `page` (integer >= 1) and `limit` (integer 1–100) parameters, THE API SHALL return the requested page of results and include `total`, `page`, and `limit` in the response; if `page` or `limit` are outside these bounds THE API SHALL return `400 Bad Request`.
8. IF a product list request includes a `sortBy` value not in the accepted set or an `order` value other than `asc`/`desc`, THEN THE API SHALL return `400 Bad Request` identifying the invalid parameter.
9. WHEN an Owner submits a valid update-product request, THE API SHALL update only the supplied fields on the Product and return the updated Product.
10. WHEN a Staff member attempts to create, update, or archive a Product, THE API SHALL return a `403 Forbidden` response.
11. WHEN an Owner submits an archive request for a Product, THE API SHALL set `is_archived = true` on the Product without deleting any associated StockMovement, Alert, or Notification records.
12. THE API SHALL always exclude Products where `is_archived = true` from all product list responses.
13. WHEN a request references a Product that does not exist in the requesting user's Shop, THE API SHALL return a `404 Not Found` response.

---

### Requirement 2: Stock Adjustment and Movement History

**User Story:** As a shop owner or staff member, I want to record every stock change with a type and optional note, so that I have a complete audit trail of all inventory movements.

#### Acceptance Criteria

1. WHEN an authenticated user submits a valid stock movement with `productId` (existing product in the user's shop), `changeAmount` (non-zero number between -1,000,000 and 1,000,000), and `type` (one of `restock`, `sale`, `damage`, `adjustment`), THE API SHALL insert a StockMovement record, update `products.current_stock` within a single database transaction, and return the new movement and updated Product with HTTP 200.
2. WHEN a stock movement of type `damage` or `adjustment` is submitted without a `note` field, THE API SHALL return a `400 Bad Request` response with a message stating that a note is required for this movement type.
3. WHEN a stock movement would result in `current_stock` dropping below 0, THE API SHALL return a `400 Bad Request` response with a message that includes both the current stock level and the fact that the movement would exceed available stock.
4. WHEN a `restock` movement is submitted with a `changeAmount <= 0`, THE API SHALL return a `400 Bad Request` response indicating that restock movements require a positive change amount.
5. WHEN a `sale` or `damage` movement is submitted with a `changeAmount >= 0`, THE API SHALL return a `400 Bad Request` response indicating that sale and damage movements require a negative change amount.
6. WHEN a stock movement is submitted referencing a `productId` that does not exist in the requesting user's Shop, THE API SHALL return a `404 Not Found` response.
7. WHEN an authenticated user requests the movement list for a Product, THE API SHALL return at most 500 StockMovement records for that Product ordered by `created_at` descending.
8. WHEN the movement list request includes `from` and `to` timestamp parameters, THE API SHALL return only StockMovement records whose `created_at` falls within the range [`from`, `to`] inclusive; if `from > to` THE API SHALL return `400 Bad Request`.
9. IF a movement list request includes a date range where `from` is later than `to`, THEN THE API SHALL return `400 Bad Request` with a message indicating the date range is invalid.
10. THE System SHALL never modify `products.current_stock` without creating a corresponding StockMovement record in the same database transaction.
11. WHEN an authenticated user navigates to a product detail page, THE Frontend SHALL display the movement history for the rolling 30-day period ending at the current date and time as a line chart of stock level over time.

---

### Requirement 3: Low-Stock Alert System

**User Story:** As a shop owner, I want to be automatically notified when a product's stock falls to or below its threshold, so that I can take reorder action before running out.

#### Acceptance Criteria

1. WHEN a stock movement causes `current_stock <= low_stock_threshold` for a Product AND no `open` alert exists for that Product, THE Alert_Engine SHALL insert an `alerts` row with `status = 'open'` and insert a corresponding Notification row with `is_read = false`.
2. WHEN a stock movement causes `current_stock <= low_stock_threshold` for a Product AND an `open` alert already exists for that Product, THE Alert_Engine SHALL create no new alert or notification (deduplication).
3. WHEN a stock movement causes `current_stock > low_stock_threshold` for a Product AND an `open` alert exists for that Product, THE Alert_Engine SHALL set `alerts.status = 'resolved'`, `alerts.resolved_at = CURRENT_TIMESTAMP`, and set the associated Notification's `is_read = true`.
4. THE System SHALL maintain the invariant that at most one alert with `status = 'open'` exists per Product at any time.
5. WHEN an authenticated user requests the alerts list with a valid `status` parameter (one of `open`, `ordered`, `dismissed`, `resolved`), THE API SHALL return a paginated list of AlertWithProduct records matching that status, with a default page size of 20 and a maximum page size of 100.
6. WHEN an authenticated user requests the alerts list with `status = 'open'`, THE API SHALL return only alerts whose corresponding Product has `current_stock <= low_stock_threshold`.
7. WHEN an authenticated but unauthorized user (no valid JWT) sends a status update to an alert, THE API SHALL return `401 Unauthorized`.
8. WHEN an authenticated user with role `owner` or `staff` sends a valid status update (`ordered` or `dismissed`) to an alert, THE API SHALL process the update and return the updated Alert.
9. THE Frontend SHALL display a color-coded stock badge on every Product row: `zero` status uses a black badge, `critical` uses red, `warning` uses yellow, and `healthy` uses green.
10. WHEN the Stock_Classifier receives `currentStock = 0` and any `threshold > 0`, THE Stock_Classifier SHALL return `'zero'`.
11. WHEN the Stock_Classifier receives `0 < currentStock <= threshold`, THE Stock_Classifier SHALL return `'critical'`.
12. WHEN the Stock_Classifier receives `threshold < currentStock <= threshold * 1.2`, THE Stock_Classifier SHALL return `'warning'`.
13. WHEN the Stock_Classifier receives `currentStock > threshold * 1.2`, THE Stock_Classifier SHALL return `'healthy'`.
14. IF the Stock_Classifier receives `currentStock = 0` and `threshold = 0`, THEN THE Stock_Classifier SHALL return `'zero'`.

---

### Requirement 4: Reorder Suggestions

**User Story:** As a shop owner, I want the system to suggest how many units to reorder based on recent sales velocity, so that I can make data-driven restocking decisions quickly.

#### Acceptance Criteria

1. WHEN the Reorder_Engine calculates a suggestion for a Product with at least 3 distinct calendar days of `sale` or `damage` movements and non-zero total outbound quantity in the lookback window, THE Reorder_Engine SHALL set `fallback = false` and compute `suggestedQty = CEILING((totalOut / lookbackDays) * lookbackDays * 2)`, where `totalOut` is the sum of absolute `changeAmount` values for `sale` and `damage` movements in the window.
2. WHEN the Reorder_Engine calculates a suggestion for a Product with fewer than 3 distinct calendar days of `sale` or `damage` movements, or zero total outbound quantity in the lookback window, THE Reorder_Engine SHALL set `fallback = true` and return `suggestedQty = MAX(1, CEILING(low_stock_threshold * 2))`.
3. THE Reorder_Engine SHALL always return a `suggestedQty >= 1` for any valid Product, regardless of movement history.
4. WHEN displaying an alert card with a velocity-based suggestion (`fallback = false`), THE Frontend SHALL show text in the format `"Sold ~{avgDailyUsage} units/day over last 30 days. Suggest reordering {suggestedQty} units."` where `avgDailyUsage` is rounded to one decimal place.
5. WHEN displaying an alert card with a fallback suggestion (`fallback = true`), THE Frontend SHALL show text in the format `"Not enough sales data. Suggest reordering {suggestedQty} units (2× your threshold)."`.
6. WHEN an authenticated user sends `PATCH /api/alerts/:id` with `{ status: 'ordered' }`, THE API SHALL set `alerts.status = 'ordered'` and return the updated Alert with HTTP 200; IF the database update fails, THE API SHALL return HTTP 500.
7. WHEN an authenticated user sends `PATCH /api/alerts/:id` with `{ status: 'dismissed' }`, THE API SHALL set `alerts.status = 'dismissed'` and return the updated Alert with HTTP 200; IF the database update fails, THE API SHALL return HTTP 500.
8. IF an alert status update targets an alert ID that does not exist in the requesting user's Shop, THEN THE API SHALL return `404 Not Found`.

---

### Requirement 5: Dashboard

**User Story:** As a shop owner or staff member, I want a dashboard that gives me an at-a-glance overview of my inventory health, so that I can quickly identify what needs attention each day.

#### Acceptance Criteria

1. WHEN an authenticated user calls `GET /api/dashboard`, THE API SHALL return a `DashboardSummary` containing: `totalProducts` (count of non-archived Products in the Shop), `lowStockCount` (count of non-archived Products with `current_stock <= low_stock_threshold`), `zeroStockCount` (count of non-archived Products with `current_stock = 0`), and `totalInventoryValue` (SUM of `current_stock * cost_price` across non-archived Products, treating null `cost_price` as 0, rounded to 2 decimal places).
2. THE `DashboardSummary` SHALL include an `urgentAlerts` array of at most 5 open AlertWithProduct records, ordered by severity: zero-stock products first, then by ascending `current_stock / low_stock_threshold` ratio, with ties broken by ascending `triggered_at`.
3. THE `DashboardSummary` SHALL include a `recentMovements` array of at most 10 StockMovement records for the Shop ordered by `created_at` descending, each enriched with `productName` and `userName`.
4. WHEN an authenticated user clicks "Mark as Ordered" on an urgent alert card, THE Frontend SHALL send `PATCH /api/alerts/:id` with `{ status: 'ordered' }`, and on success update the card's displayed status to "Ordered" without triggering a full page reload.
5. WHEN an authenticated user clicks "Dismiss" on an urgent alert card, THE Frontend SHALL send `PATCH /api/alerts/:id` with `{ status: 'dismissed' }`, and on success remove the card from the urgent alerts section without triggering a full page reload.
6. IF `PATCH /api/alerts/:id` returns a non-2xx response while processing a "Mark as Ordered" or "Dismiss" action, THEN THE Frontend SHALL display an error message to the user and leave the card in its previous state.

---

### Requirement 6: In-App Notification Bell

**User Story:** As a shop owner or staff member, I want a notification bell in the navigation bar that shows me new low-stock alerts, so that I am always aware of urgent inventory issues without navigating to the alerts page.

#### Acceptance Criteria

1. WHILE an authenticated user has a valid session, THE Frontend SHALL display a notification bell icon in the top navigation bar showing the current count of unread Notifications; if the count exceeds 99, the badge SHALL display "99+".
2. THE Frontend SHALL poll `GET /api/notifications/unread-count` at an interval between 25 and 35 seconds to refresh the unread count badge.
3. WHEN a user clicks the notification bell, THE Frontend SHALL fetch and display the most recent 20 Notifications ordered by `created_at` descending in a dropdown panel.
4. WHEN a user clicks "Mark all read" in the notification dropdown, THE Frontend SHALL call `POST /api/notifications/mark-read` with `{ ids: 'all' }` and, on a 2xx response, set the unread badge count to 0.
5. WHEN `POST /api/notifications/mark-read` is called with `{ ids: [id1, id2, ...] }`, THE API SHALL set `is_read = true` for each specified Notification belonging to the requesting user's Shop and return `{ updated: <count> }`.
6. WHEN `POST /api/notifications/mark-read` is called with `{ ids: 'all' }`, THE API SHALL set `is_read = true` for all Notifications belonging to the requesting user's Shop and return `{ updated: <count> }`.
7. WHEN `GET /api/notifications/unread-count` is called, THE API SHALL return `{ count: <integer> }` where `count` equals the number of Notifications in the requesting user's Shop where `is_read = false`.
8. IF the poll request to `GET /api/notifications/unread-count` fails with a network or server error, THEN THE Frontend SHALL retain the last known unread count and not reset the badge to zero.
9. IF the request to `GET /api/notifications` fails when the dropdown is opened, THEN THE Frontend SHALL display an error message inside the dropdown and not show a blank panel.
10. IF `POST /api/notifications/mark-read` returns a non-2xx response, THEN THE Frontend SHALL display an error message and not update the badge count.

---

### Requirement 7: Authentication and User Management

**User Story:** As a shop owner, I want to register an account for my shop, log in securely, and manage staff accounts, so that my team can use the system with appropriate access levels.

#### Acceptance Criteria

1. WHEN a new user submits a registration request with a valid `name` (non-empty string), a well-formed `email`, a `password` between 8 and 72 characters, and a non-empty `shopName`, THE API SHALL create a Shop record, create an Owner user record with the password stored as a bcrypt hash (cost factor 12), and return a JWT and a user object containing `id`, `name`, `email`, `role`, and `shopId`.
2. IF a registration request includes a `password` shorter than 8 characters or longer than 72 characters or a malformed `email`, THEN THE API SHALL return `400 Bad Request` identifying the invalid field.
3. IF a registration request is submitted with an email that already exists in the system, THEN THE API SHALL return `409 Conflict`.
4. WHEN a user submits a login request with a valid email and correct password, THE API SHALL return a signed JWT (expiry of at most 24 hours) and a user object containing `id`, `name`, `email`, `role`, and `shopId`.
5. IF a user submits a login request with an email that does not exist or a password that does not match, THEN THE API SHALL return `401 Unauthorized` with the message `"Invalid credentials"` (the response SHALL NOT indicate whether it was the email or the password that was wrong).
6. IF an API request is received with an expired JWT, THEN THE API SHALL return `401 Unauthorized` with the message `"Session expired. Please log in again."`.
7. WHEN an Owner submits a create-staff request with a valid `name`, well-formed `email`, and `password` between 8 and 72 characters, THE API SHALL create a new user with `role = 'staff'` scoped to the Owner's Shop and return the created user's `id`, `name`, `email`, `role`, and `shopId`.
8. IF a create-staff request is submitted with an email that already exists in the system, THEN THE API SHALL return `409 Conflict`.
9. WHEN a Staff member attempts to call `POST /api/users`, `PATCH /api/users/:id`, or `DELETE /api/users/:id`, THE API SHALL return `403 Forbidden`.
10. WHEN an Owner requests the staff list, THE API SHALL return only users with `role = 'staff'` belonging to the Owner's Shop.
11. WHEN an Owner submits a deactivate-staff request for a staff account in their Shop, THE API SHALL mark the account inactive so that subsequent login attempts with that account return `401 Unauthorized`.
12. IF an Owner submits a deactivate-staff request for a user ID that does not exist in their Shop, THEN THE API SHALL return `404 Not Found`.
13. WHEN an authenticated user calls `GET /api/auth/me`, THE API SHALL return the current user's `id`, `name`, `email`, `role`, and `shopId` (password hash SHALL NOT be included).

---

### Requirement 8: Role-Based Access Control

**User Story:** As a shop owner, I want the system to enforce access restrictions by role, so that staff members can perform their daily tasks without being able to accidentally or intentionally modify critical settings.

#### Acceptance Criteria

1. IF an API request is received with no Authorization header, an invalid JWT, or an expired JWT, THEN THE API SHALL return `401 Unauthorized` before executing any business logic.
2. WHEN a valid JWT is present, THE API SHALL verify the JWT signature and extract the `userId`, `shopId`, and `role` claims before executing any business logic.
3. WHEN a Staff member sends `DELETE /api/products/:id`, THE API SHALL return `403 Forbidden` regardless of the product's current state.
4. WHEN a Staff member sends `POST /api/products` or `PATCH /api/products/:id`, THE API SHALL return `403 Forbidden`.
5. WHEN an Owner sends `DELETE /api/products/:id` for a Product in their Shop, THE API SHALL process the soft-delete and return a 2xx success response.
6. WHEN a Staff member sends `POST /api/movements` with a valid payload, THE API SHALL apply the stock update and return a 2xx success response.
7. WHEN any authenticated user accesses a resource whose `shopId` does not match the `shopId` in the user's JWT, THE API SHALL return `404 Not Found` regardless of the user's role.

---

### Requirement 9: Input Validation and Error Handling

**User Story:** As a shop owner or staff member, I want clear, actionable error messages when I make a mistake, so that I can quickly understand and correct the problem without needing technical knowledge.

#### Acceptance Criteria

1. THE API SHALL validate all request bodies against defined schemas before executing any database operation.
2. WHEN a request body fails validation, THE API SHALL return a `400 Bad Request` response whose body contains a `message` field that is a non-empty string identifying the invalid field(s) and the reason each failed.
3. WHEN a stock adjustment would reduce `current_stock` below zero, THE API SHALL return `400 Bad Request` with a `message` that includes the current stock level and indicates the movement would exceed available stock.
4. WHEN a referenced resource is not found or belongs to a different shop, THE API SHALL return `404 Not Found` with a `message` identifying the resource type that was not found (e.g., "Product not found", "Alert not found").
5. WHEN an unexpected server error occurs, THE API SHALL return `500 Internal Server Error` with a `message` that does not expose internal implementation details (e.g., stack traces or raw SQL errors).
6. IF a `low_stock_threshold` value of `0` or below is submitted in a product creation or update request, THEN THE API SHALL return `400 Bad Request` with a `message` indicating the threshold must be greater than zero.
7. IF a `currentStock` value below `0` is submitted in a product creation request, THEN THE API SHALL return `400 Bad Request` with a `message` indicating stock cannot be negative.

---

### Requirement 10: Performance and Scalability

**User Story:** As a shop owner, I want the system to remain fast and responsive even when I have hundreds of products and a long history of stock movements, so that my daily workflow is never slowed down.

#### Acceptance Criteria

1. WHEN the product list endpoint is called without explicit pagination parameters, THE API SHALL default to returning at most 50 records per page.
2. WHEN the movement list endpoint is called without explicit pagination parameters, THE API SHALL default to returning at most 50 records per page.
3. WHEN the alerts list endpoint is called without explicit pagination parameters, THE API SHALL default to returning at most 50 records per page.
4. IF a `limit` parameter greater than 100 is supplied to any list endpoint, THEN THE API SHALL return `400 Bad Request`.
5. WHEN the Dashboard summary endpoint is called for a Shop with up to 1,000 non-archived Products, THE API SHALL return a complete `DashboardSummary` response within 2 seconds under normal single-user load.

---

### Requirement 11: Security

**User Story:** As a shop owner, I want my data and my staff's credentials to be stored and transmitted securely, so that unauthorized users cannot access or tamper with my inventory data.

#### Acceptance Criteria

1. THE API SHALL store all user passwords as bcrypt hashes with a cost factor of at least 12, and SHALL NOT store or log plaintext passwords at any point.
2. THE API SHALL sign JWTs using a secret loaded from an environment variable (`JWT_SECRET`) with a minimum entropy of 256 bits; the secret SHALL NOT appear in source code or version-controlled files.
3. IF `POST /api/auth/login` or `POST /api/auth/register` receives more than 20 requests from the same IP address within any 15-minute window, THEN THE API SHALL return `429 Too Many Requests` with a `Retry-After` header indicating when the limit resets.
4. THE API SHALL use parameterized queries for all database operations and SHALL NOT interpolate user-supplied values directly into SQL strings.
5. WHILE the application is running in production mode (`NODE_ENV=production`), THE API SHALL reject cross-origin requests whose `Origin` header does not match the configured `CORS_ORIGIN` environment variable.
6. WHILE the application is running in development mode (`NODE_ENV=development`), THE API SHALL allow cross-origin requests from `http://localhost:5173`.
7. IF a request targets a resource whose `shopId` does not match the authenticated user's `shopId`, THEN THE API SHALL return `404 Not Found` and SHALL NOT return `403 Forbidden` for such cross-shop access attempts.
