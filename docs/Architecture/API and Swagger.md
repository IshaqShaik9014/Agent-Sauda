# API and Swagger

Agent Sauda provides a typed Fastify backend paired with real-time interactive OpenAPI documentation via Swagger UI.

Related: [[Index]], [[System Architecture]], [[Phase 1 Foundation]], [[Phase 3 Authentication and Authorization]], [[Phase 4 Merchant and Catalog Management]]

---

## 📖 Accessing Swagger UI

* **URL:** `http://localhost:4000/docs`
* **OpenAPI JSON Spec:** `http://localhost:4000/docs/json`
* **Health Check:** `http://localhost:4000/health`

---

## 🔑 Authenticating in Swagger
1. Call `POST /api/auth/login` or `POST /api/auth/register`.
2. Copy the returned `token` string.
3. Click the green **Authorize 🔓** button at the top right of the Swagger UI.
4. Paste the token into the `Value` box and click **Authorize**.
5. All protected endpoints (`/me`, catalog CRUD, policy management, approvals) will automatically send the Bearer header.

---

## 🗂️ Documented Route Domains

| Domain Tag | Endpoints | Authentication |
| :--- | :--- | :--- |
| **System** | `GET /health` | Public |
| **Agent Tools & Public Catalog** | `GET /api/agent/catalog` | Public / AI Tool |
| **Authentication & Tenancy** | `POST /api/auth/register`<br>`POST /api/auth/login`<br>`GET /api/auth/me`<br>`POST /api/auth/logout` | Mixed (Register/Login public, Me/Logout protected) |
| **Merchant Catalog Management** | `POST /api/merchants/:merchantId/catalog/products`<br>`GET /api/merchants/:merchantId/catalog/products`<br>`GET /api/merchants/:merchantId/catalog/products/:productId`<br>`PATCH /api/merchants/:merchantId/catalog/products/:productId`<br>`PATCH /api/merchants/:merchantId/catalog/inventory/:productId` | Protected (`BearerAuth` + `requireMerchantAccess`) |
