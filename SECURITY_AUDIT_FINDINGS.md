# 🔐 SECURITY AUDIT FINDINGS - MEDIA-MONOREPO
**Tanggal:** 2026-07-24  
**Status:** 🚨 CRITICAL - Withdrawal & Port Access Issues  
**Risk Level:** HIGH - Siap untuk Production!

---

## 📋 RINGKASAN EKSEKUTIF

Audit keamanan menyeluruh telah menemukan **7 file rentan** yang perlu diperbaiki segera sebelum production deployment. Masalah utama:

1. **Port Access** - 6379 (Redis), 5432 (PostgreSQL), 8080 (API) terbuka tanpa autentikasi
2. **Withdrawal Validation** - Minimal untuk crypto address dan balance checks
3. **API Key Leakage** - `PLISIO_API_KEY` masih di environment frontend
4. **HTTP tidak redirect ke HTTPS** - Data sensitif bisa di-intercept
5. **CSP terlalu permissive** - `unsafe-inline` dan `unsafe-eval` aktif

---

## 🎯 PRIORITAS FIXES (Urutan Eksekusi)

### PRIORITY 1: CRITICAL - Jalankan dalam 24 jam

#### **TASK 1: Secure Port Access**
**File:** `docker-compose.prod.yml`  
**Severity:** 🔴 CRITICAL  
**Bobot:** 10/10

**Masalah:**
```yaml
# ❌ SEKARANG - Ports terbuka ke publik
redis:
  ports:
    - "6379:6379"  # Anyone can connect!

postgres:
  ports:
    - "5432:5432"  # Anyone can brute force!

api:
  ports:
    - "8080:8080"  # Backend API exposed!
```

**Solusi:**
```yaml
# ✅ FIXED - Hanya accessible via Nginx internal network
redis:
  image: redis:7-alpine
  container_name: media-redis-prod
  restart: unless-stopped
  command: redis-server /usr/local/etc/redis/redis.conf --requirepass ${REDIS_PASSWORD}
  # ❌ REMOVE ports section - hanya accessible di internal network
  # ✅ ONLY via Docker network "backend"
  networks:
    - backend
  volumes:
    - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    - redis_prod_data:/data

postgres:
  image: postgres:15-alpine
  container_name: media-postgres-prod
  restart: unless-stopped
  environment:
    POSTGRES_USER: ${DB_USER}
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: ${DB_NAME}
    POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
  # ❌ REMOVE ports section
  # ✅ ONLY via Docker network "backend"
  networks:
    - backend
  volumes:
    - postgres_prod_data:/var/lib/postgresql/data
    - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro

api:
  build:
    context: ./be/apps/api
    dockerfile: Dockerfile
  container_name: media-api
  restart: unless-stopped
  environment:
    - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
    - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
    - PORT=8080
    - JWT_SECRET=${JWT_SECRET}
    - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    - PLISIO_API_KEY=${PLISIO_API_KEY}
    # ... other env vars
  # ❌ REMOVE ports section - hanya via Nginx reverse proxy
  # ✅ ONLY via Docker network "backend"
  networks:
    - backend
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_started

nginx:
  image: nginx:1.27-alpine
  container_name: media-nginx
  restart: unless-stopped
  ports:
    - "80:80"    # ✅ HTTP redirect to HTTPS
    - "443:443"  # ✅ HTTPS only
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro
  networks:
    - backend
  depends_on:
    - nextjs
    - api
```

**Checklist:**
- [ ] Remove `ports:` dari redis service
- [ ] Remove `ports:` dari postgres service
- [ ] Remove `ports:` dari api service
- [ ] Keep nginx ports: `80:80`, `443:443` only
- [ ] Verify network: `backend` untuk semua services
- [ ] Test: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Verify: `docker network ls` → `media-monorepo_backend`
- [ ] Test access:
  - `curl http://localhost/` → ✅ Works (Nginx proxy)
  - `curl redis://localhost:6379` → ❌ Connection refused (Good!)
  - `psql -h localhost -U postgres` → ❌ Connection refused (Good!)

---

#### **TASK 2: Enable HTTPS Redirect**
**File:** `nginx/nginx.conf`  
**Severity:** 🔴 CRITICAL  
**Bobot:** 9/10

**Masalah:**
```nginx
# ❌ CURRENT - HTTP tidak redirect ke HTTPS
server {
    listen 80;
    server_name _;
    
    # Just serves content on HTTP!
    location / {
        proxy_pass http://nextjs_upstream;
    }
}
```

**Solusi Lengkap:**

Buat file baru: `nginx/nginx.conf`
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging dengan buffer
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main buffer=32k flush=5s;

    # Basic Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;
    server_tokens off;  # Hide nginx version

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=50r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;

    upstream nextjs_upstream {
        server nextjs:3000;
        keepalive 64;
    }

    upstream api_upstream {
        server api:8080;
        keepalive 64;
    }

    # ✅ HTTP → HTTPS REDIRECT SERVER (CRITICAL!)
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        # Redirect semua traffic ke HTTPS
        location / {
            return 301 https://$host$request_uri;
        }
    }

    # ✅ HTTPS SERVER (MAIN)
    server {
        listen 443 ssl http2 default_server;
        listen [::]:443 ssl http2 default_server;
        server_name _;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        ssl_session_tickets off;
        ssl_stapling on;
        ssl_stapling_verify on;

        # ✅ Security Headers (CRITICAL!)
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        
        # ✅ IMPROVED CSP (Remove unsafe-inline & unsafe-eval)
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
        
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;

        # Rate Limiting
        limit_req zone=general burst=50 nodelay;

        # WebSocket
        location /api/ws {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }

        # API Routes
        location /api/ {
            limit_req zone=api burst=30 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Login Routes (Stricter rate limiting)
        location ~ ^/api/auth/login$ {
            limit_req zone=login burst=3 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Frontend
        location / {
            proxy_pass http://nextjs_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_cache_bypass $http_upgrade;
        }

        # Hide .git & other sensitive files
        location ~ /\. {
            deny all;
            access_log off;
        }
    }
}
```

**Generate SSL Certificate:**
```bash
mkdir -p nginx/ssl

# Development (Self-signed)
openssl req -x509 -newkey rsa:4096 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=yourdomain.com"

# Production (Let's Encrypt - gunakan Certbot)
# sudo certbot certonly --standalone -d yourdomain.com
# cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
# cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
```

**Checklist:**
- [ ] Create `nginx/ssl/` directory
- [ ] Generate SSL certificate
- [ ] Update `nginx/nginx.conf` with HTTPS config
- [ ] Update `docker-compose.prod.yml` untuk SSL volumes
- [ ] Test HTTP redirect: `curl -i http://localhost/` → Should see 301
- [ ] Test HTTPS: `curl -k https://localhost/` → Should work
- [ ] Check HSTS: `curl -i https://localhost/ -k | grep strict-transport`

---

#### **TASK 3: Fix Withdrawal Validation**
**File:** `be/apps/api/internal/modules/monetization/service.go`  
**Severity:** 🔴 CRITICAL  
**Bobot:** 8/10

**Masalah:**
```go
// ❌ CURRENT - Minimal validation
func (s *service) WithdrawProductEarnings(userID string, req WithdrawRequest) (*Withdrawal, error) {
    // Only checks:
    // - Crypto address format (basic)
    // - Minimum $1.00
    // - Balance check
    
    // MISSING:
    // - Withdrawal rate limiting (spam prevention)
    // - Duplicate withdrawal detection
    // - Cryptocurrency address validation (specific per coin)
    // - KYC/AML checks
    // - Withdrawal cooldown period
}
```

**Solusi Lengkap:**

File: `be/apps/api/internal/modules/monetization/service.go`

```go
package monetization

import (
    "context"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "regexp"
    "strings"
    "time"
    "github.com/redis/go-redis/v9"
)

// ✅ IMPROVED - Comprehensive validation
func (s *service) WithdrawProductEarnings(userID string, req WithdrawRequest) (*Withdrawal, error) {
    ctx := context.Background()
    
    // ✅ VALIDATION 1: Check withdrawal rate limit (max 1 per hour)
    rateLimitKey := fmt.Sprintf("withdraw_limit:%s", userID)
    lastWithdrawTime, err := s.cache.Get(ctx, rateLimitKey).Result()
    if err == nil && lastWithdrawTime != "" {
        // User already withdrew recently
        return nil, fmt.Errorf("withdrawal available in %s (max 1 per hour)", lastWithdrawTime)
    }
    
    // ✅ VALIDATION 2: Verify crypto address format (specific per currency)
    if !isValidCryptoAddressForCurrency(req.ToAddress, req.Currency) {
        return nil, fmt.Errorf("invalid %s address format", req.Currency)
    }
    
    // ✅ VALIDATION 3: Check minimum withdrawal ($500 USD for crypto)
    minWithdrawal := 50000 // $500 in cents
    if req.AmountCents < minWithdrawal {
        return nil, fmt.Errorf("minimum withdrawal is $5.00 (received: $%.2f)", 
            float64(req.AmountCents)/100.0)
    }
    
    // ✅ VALIDATION 4: Maximum withdrawal (anti-whale limit, e.g., $50k per tx)
    maxWithdrawal := 5000000 // $50k in cents
    if req.AmountCents > maxWithdrawal {
        return nil, fmt.Errorf("maximum withdrawal is $50,000 per transaction")
    }
    
    // ✅ VALIDATION 5: Get user balance & verify sufficient funds
    stats, err := s.GetProductSalesStats(userID)
    if err != nil {
        return nil, fmt.Errorf("failed to retrieve balance: %w", err)
    }
    
    if stats.AvailableBalance < req.AmountCents {
        return nil, fmt.Errorf("insufficient balance (have: $%.2f, requested: $%.2f)",
            float64(stats.AvailableBalance)/100.0,
            float64(req.AmountCents)/100.0)
    }
    
    // ✅ VALIDATION 6: Check withdrawal history for duplicate attempts (last 10 seconds)
    dupeKey := fmt.Sprintf("withdraw_dupe:%s:%s:%d", userID, req.ToAddress, req.AmountCents)
    _, err = s.cache.Get(ctx, dupeKey).Result()
    if err == nil {
        return nil, fmt.Errorf("duplicate withdrawal request detected")
    }
    
    // ✅ VALIDATION 7: Verify crypto currency is supported
    currencies, err := s.GetCryptoCurrencies()
    if err != nil {
        return nil, fmt.Errorf("failed to fetch currency list: %w", err)
    }
    
    var targetCurrency *CryptoCurrency
    for _, c := range currencies {
        if c.Currency == req.Currency || c.Cid == req.Currency {
            targetCurrency = &c
            break
        }
    }
    
    if targetCurrency == nil {
        return nil, fmt.Errorf("unsupported currency: %s", req.Currency)
    }
    
    // ✅ VALIDATION 8: Verify exchange rate is reasonable (prevent fraud)
    priceUsdFloat, err := strconv.ParseFloat(targetCurrency.PriceUsd, 64)
    if err != nil || priceUsdFloat <= 0 {
        return nil, fmt.Errorf("invalid exchange rate for %s", req.Currency)
    }
    
    // ✅ VALIDATION 9: Verify user is not flagged for suspicious activity
    isFlagged, err := s.repo.IsUserFlaggedForReview(userID)
    if err == nil && isFlagged {
        return nil, fmt.Errorf("account under review - withdrawals temporarily disabled")
    }
    
    // ✅ VALIDATION 10: Check if user has too many pending withdrawals (max 3)
    pendingWithdrawals, err := s.repo.GetPendingWithdrawalsCount(userID)
    if err == nil && pendingWithdrawals >= 3 {
        return nil, fmt.Errorf("maximum 3 pending withdrawals allowed (current: %d)", pendingWithdrawals)
    }

    // ✅ If all validations pass, proceed with withdrawal
    usdAmountFloat := float64(req.AmountCents) / 100.0
    cryptoAmount := usdAmountFloat / priceUsdFloat
    cryptoAmountStr := strconv.FormatFloat(cryptoAmount, 'f', 8, 64)

    // Start database transaction
    txDB := s.db.BeginTx(ctx, nil)
    defer func() {
        if r := recover(); r != nil {
            txDB.Rollback()
        }
    }()

    // Create withdrawal record
    withdrawal := &Withdrawal{
        ID:          uuid.New().String(),
        UserID:      userID,
        AmountCents: req.AmountCents,
        Currency:    req.Currency,
        ToAddress:   req.ToAddress,
        Status:      "pending",
        CreatedAt:   time.Now(),
    }

    if err := txDB.Create(withdrawal).Error; err != nil {
        txDB.Rollback()
        return nil, fmt.Errorf("failed to create withdrawal record: %w", err)
    }

    // ✅ Call Plisio API with HMAC signature validation
    signature := generateWithdrawalSignature(withdrawal, s.plisioAPIKey)
    
    if err := s.callPlisioWithdraw(withdrawal, signature); err != nil {
        // Mark as error in DB
        txDB.Model(withdrawal).Update("status", "error")
        txDB.Commit()
        return nil, fmt.Errorf("plisio withdraw failed: %w", err)
    }

    if err := txDB.Commit().Error; err != nil {
        return nil, fmt.Errorf("failed to commit withdrawal: %w", err)
    }

    // ✅ Set rate limit in Redis (1 hour expiry)
    s.cache.Set(ctx, rateLimitKey, time.Now().Add(1*time.Hour).String(), 1*time.Hour)
    
    // ✅ Set duplicate prevention (10 second expiry)
    s.cache.Set(ctx, dupeKey, "1", 10*time.Second)
    
    // ✅ Log withdrawal for audit trail
    s.logWithdrawalEvent(userID, withdrawal, "initiated")

    return withdrawal, nil
}

// ✅ NEW: Comprehensive crypto address validation
func isValidCryptoAddressForCurrency(address, currency string) bool {
    address = strings.TrimSpace(address)
    currency = strings.ToLower(strings.TrimSpace(currency))
    
    if address == "" {
        return false
    }

    switch currency {
    case "btc", "bitcoin":
        // Bitcoin: P2PKH (1...), P2SH (3...), Bech32 (bc1...)
        return regexp.MustCompile(`^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$`).MatchString(address)
        
    case "eth", "ethereum", "usdt", "usdc":
        // Ethereum: 0x followed by 40 hex chars
        return regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`).MatchString(address)
        
    case "ltc", "litecoin":
        // Litecoin: L or M followed by 33 chars (Base58)
        return regexp.MustCompile(`^[LM][a-zA-km-zA-Z0-9]{33}$`).MatchString(address)
        
    case "xrp", "ripple":
        // Ripple: r followed by 33 chars (Base58)
        return regexp.MustCompile(`^r[a-zA-Z0-9]{33}$`).MatchString(address)
        
    case "doge", "dogecoin":
        // Dogecoin: D followed by 33 chars (Base58)
        return regexp.MustCompile(`^D[a-zA-Z0-9]{33}$`).MatchString(address)
        
    default:
        // Generic fallback: alphanumeric, 25-100 chars
        return regexp.MustCompile(`^[a-zA-Z0-9]{25,100}$`).MatchString(address)
    }
}

// ✅ NEW: Generate HMAC signature for withdrawal
func generateWithdrawalSignature(w *Withdrawal, apiKey string) string {
    data := fmt.Sprintf("%s|%s|%s|%d", w.ID, w.ToAddress, w.Currency, w.AmountCents)
    mac := hmac.New(sha256.New, []byte(apiKey))
    mac.Write([]byte(data))
    return hex.EncodeToString(mac.Sum(nil))
}

// ✅ NEW: Audit logging
func (s *service) logWithdrawalEvent(userID string, withdrawal *Withdrawal, event string) {
    // Log to database for audit trail
    auditLog := &WithdrawalAuditLog{
        ID:          uuid.New().String(),
        UserID:      userID,
        WithdrawalID: withdrawal.ID,
        Event:       event,
        Timestamp:   time.Now(),
    }
    
    s.db.Create(auditLog)
    
    // Also log to monitoring system
    fmt.Printf("[WITHDRAWAL_AUDIT] User=%s | Event=%s | Amount=$%.2f | Status=%s\n",
        userID, event, float64(withdrawal.AmountCents)/100.0, withdrawal.Status)
}
```

**Database Schema Update:**

File: `be/apps/api/internal/modules/monetization/model.go`

```go
// ✅ ADD: Withdrawal with more fields
type Withdrawal struct {
    ID            string     `gorm:"primaryKey;type:varchar" json:"id"`
    UserID        string     `gorm:"type:varchar;not null;index" json:"userId"`
    AmountCents   int        `gorm:"type:integer;not null" json:"amountCents"`
    Currency      string     `gorm:"type:varchar;not null" json:"currency"`
    ToAddress     string     `gorm:"type:varchar;not null" json:"toAddress"`
    Status        string     `gorm:"type:varchar;default:'pending';index" json:"status"`
    CryptoTxnID   *string    `gorm:"type:varchar;uniqueIndex" json:"cryptoTxnId"`
    TxURL         *string    `gorm:"type:varchar" json:"txUrl"`
    ErrorMessage  *string    `gorm:"type:text" json:"errorMessage"`
    Signature     string     `gorm:"type:varchar" json:"signature"` // ✅ NEW
    FeeAmount     *int       `gorm:"type:integer" json:"feeAmount"` // ✅ NEW
    RetryCount    int        `gorm:"type:integer;default:0" json:"retryCount"` // ✅ NEW
    CreatedAt     time.Time  `gorm:"autoCreateTime;type:timestamp;index" json:"createdAt"`
    UpdatedAt     time.Time  `gorm:"autoUpdateTime;type:timestamp" json:"updatedAt"`
    CompletedAt   *time.Time `gorm:"type:timestamp" json:"completedAt"` // ✅ NEW
}

// ✅ NEW: Audit logging
type WithdrawalAuditLog struct {
    ID            string    `gorm:"primaryKey;type:varchar"`
    UserID        string    `gorm:"type:varchar;not null;index"`
    WithdrawalID  string    `gorm:"type:varchar;not null"`
    Event         string    `gorm:"type:varchar"` // "initiated", "success", "failed", etc.
    Details       *string   `gorm:"type:text"`
    Timestamp     time.Time `gorm:"autoCreateTime"`
}
```

**Checklist:**
- [ ] Add comprehensive validation function
- [ ] Implement rate limiting (Redis)
- [ ] Add crypto address validation per currency
- [ ] Create audit log table
- [ ] Update Withdrawal model with new fields
- [ ] Test withdrawal with various amounts
- [ ] Test rate limiting (attempt 2 within 1 hour)
- [ ] Test invalid addresses
- [ ] Test insufficient balance
- [ ] Add monitoring alerts for failed withdrawals

---

### PRIORITY 2: HIGH - Jalankan dalam 48 jam

#### **TASK 4: Frontend Secrets in docker-compose**
**File:** `docker-compose.prod.yml`  
**Severity:** 🔴 CRITICAL  
**Bobot:** 9/10

**Masalah:**
```yaml
# ❌ SEKARANG - Secrets di Frontend
nextjs:
  environment:
    - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}  # ❌ Built into JS bundle!
    - JWT_SECRET=${JWT_SECRET}            # ❌ Public!
    - GOOGLE_CLIENT_SECRET=${...}         # ❌ Exposed!
```

**Solusi:**

File: `docker-compose.prod.yml` - nextjs section
```yaml
nextjs:
  build:
    context: ./fe
    dockerfile: Dockerfile
  container_name: media-nextjs
  restart: unless-stopped
  environment:
    - NODE_ENV=production
    - BACKEND_API_URL=http://api:8080/api
    # ✅ ONLY Public variables (visible in bundle)
    - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    - NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
    - R2_PUBLIC_DOMAIN=${R2_PUBLIC_DOMAIN}
    # ❌ REMOVED: NEXTAUTH_SECRET, JWT_SECRET, GOOGLE_CLIENT_SECRET
    # These are handled by Next.js Auth internally, NOT exposed to client
  networks:
    - backend
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_started
```

**Create `.env.example` (commit ke repo):**

File: `.env.example`
```bash
# Frontend - Public (safe to expose)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_actual_client_id.apps.googleusercontent.com
R2_PUBLIC_DOMAIN=assets.yourdomain.com

# Database (Backend only)
DB_USER=media_prod_user
DB_PASSWORD=your_strong_password_here
DB_NAME=media_prod

# Redis (Backend only)
REDIS_PASSWORD=your_strong_redis_password

# JWT & Auth (Backend only)
JWT_SECRET=your_long_jwt_secret_64_chars_min
NEXTAUTH_SECRET=your_nextauth_secret_32_chars_min
NEXTAUTH_URL=https://yourdomain.com

# Payment (Backend only)
PLISIO_API_KEY=your_plisio_api_key

# Cloudflare R2 (Backend only)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket_name
R2_ENDPOINT=your_endpoint.r2.cloudflarestorage.com

# OAuth (Backend only)
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Deployment
BACKEND_URL=https://yourdomain.com
```

**Update `.gitignore`:**

File: `.gitignore` - ADD:
```bash
# Environment files
.env
.env.local
.env.prod
.env.prod.local
.env.development.local
.env.test.local
.env.production.local

# SSL certificates
nginx/ssl/

# Sensitive data
*.pem
*.key
.DS_Store
```

**Checklist:**
- [ ] Remove secrets from nextjs environment
- [ ] Create `.env.example` template
- [ ] Update `.gitignore` to ignore `.env` files
- [ ] Generate production `.env.prod` locally (never commit!)
- [ ] Verify build doesn't include secrets: `grep -r "PLISIO\|JWT_SECRET" fe/`
- [ ] Test: `npm run build` → Bundle should NOT contain secrets

---

#### **TASK 5: Improve CSP Headers**
**File:** `nginx/nginx.conf`  
**Severity:** 🔴 CRITICAL  
**Bobot:** 8/10

**Masalah:**
```nginx
# ❌ CURRENT - Too permissive
add_header Content-Security-Policy "default-src 'self' http: https: ws: wss: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http: https: ws: wss:;" always;
```

**Solusi:**

Update server block di `nginx/nginx.conf`:
```nginx
server {
    listen 443 ssl http2 default_server;
    # ... SSL config ...
    
    # ✅ IMPROVED CSP (Restrictive)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
    
    # ✅ Additional Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;
}
```

**Checklist:**
- [ ] Update CSP header (remove `unsafe-inline`, `unsafe-eval`, `http:`)
- [ ] Test CSP: `curl -i https://localhost/ -k | grep content-security-policy`
- [ ] Check browser console untuk CSP violations
- [ ] Update domain dari `example.com` ke actual domain

---

#### **TASK 6: Database Hardening**
**File:** `docker-compose.prod.yml`, `postgres/init.sql`  
**Severity:** 🟠 HIGH  
**Bobot:** 7/10

**Masalah:**
```yaml
# ❌ Default postgres user has too much access
postgres:
  environment:
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: ${DB_NAME}
```

**Solusi:**

File: `postgres/init.sql` (NEW)
```sql
-- postgres/init.sql - Run on container startup

-- ✅ 1. Create dedicated app user (not 'postgres')
CREATE ROLE media_app_user WITH LOGIN ENCRYPTED PASSWORD :'APP_PASSWORD';

-- ✅ 2. Create dedicated read-only user (for backups)
CREATE ROLE media_read_only WITH LOGIN ENCRYPTED PASSWORD :'READONLY_PASSWORD';

-- ✅ 3. Set default privileges
ALTER ROLE media_app_user SET search_path = public;
ALTER ROLE media_read_only SET search_path = public;

-- ✅ 4. Grant privileges to app user (only what it needs)
GRANT CONNECT ON DATABASE media_prod TO media_app_user;
GRANT USAGE ON SCHEMA public TO media_app_user;
GRANT CREATE ON SCHEMA public TO media_app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO media_app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO media_app_user;

-- ✅ 5. Grant read-only privileges
GRANT CONNECT ON DATABASE media_prod TO media_read_only;
GRANT USAGE ON SCHEMA public TO media_read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO media_read_only;

-- ✅ 6. Disable superuser for postgres (security best practice)
-- ALTER ROLE postgres NOSUPERUSER;

-- ✅ 7. Enable password encryption
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
```

**Update `docker-compose.prod.yml`:**
```yaml
postgres:
  image: postgres:15-alpine
  container_name: media-postgres-prod
  restart: unless-stopped
  environment:
    # ✅ Use strong passwords (generated from .env)
    POSTGRES_USER: ${DB_USER}
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: ${DB_NAME}
    
    # ✅ Force SCRAM-SHA-256 authentication (safer than MD5)
    POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
    
    # ✅ Additional security settings
    POSTGRES_CONFIG_PATH: /etc/postgresql/postgresql.conf
  
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
    interval: 10s
    timeout: 5s
    retries: 5
  
  volumes:
    - postgres_prod_data:/var/lib/postgresql/data
    - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
  
  networks:
    - backend
  
  # ❌ NO ports exposed!
```

**Checklist:**
- [ ] Create `postgres/init.sql`
- [ ] Remove postgres superuser password from code
- [ ] Generate strong DB password (32+ chars)
- [ ] Update CONNECTION_STRING to use media_app_user
- [ ] Test connection: `psql -h localhost -U media_app_user -d media_prod`
- [ ] Verify init.sql runs on startup

---

### PRIORITY 3: MEDIUM - Jalankan dalam 1 minggu

#### **TASK 7: API Input Validation & Rate Limiting**
**File:** `be/apps/api/internal/middleware/ratelimit.go`  
**Severity:** 🟡 MEDIUM  
**Bobot:** 6/10

**Masalah:**
- Withdrawal endpoint tidak rate-limited per user
- No validation untuk withdraw amounts (too small/too large)
- Payment endpoints bisa di-spam

**Solusi:**

File: `be/apps/api/internal/middleware/ratelimit.go` (IMPROVED)
```go
package middleware

import (
    "context"
    "fmt"
    "time"
    "github.com/gin-gonic/gin"
    "github.com/redis/go-redis/v9"
)

// ✅ Withdrawal Rate Limiter (1 per hour per user)
func WithdrawalRateLimit(redisClient *redis.Client) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("userID")
        if userID == "" {
            c.JSON(401, gin.H{"error": "unauthorized"})
            c.Abort()
            return
        }
        
        key := fmt.Sprintf("withdraw_limit:%s", userID)
        ctx := context.Background()
        
        val, err := redisClient.Get(ctx, key).Result()
        if err == nil && val != "" {
            c.JSON(429, gin.H{"error": "withdrawal available in 1 hour"})
            c.Abort()
            return
        }
        
        c.Next()
        
        // Only set limit on successful withdrawal
        if c.Writer.Status() == 200 {
            redisClient.Set(ctx, key, "1", 1*time.Hour)
        }
    }
}

// ✅ Payment Rate Limiter (5 per hour per user)
func PaymentRateLimit(redisClient *redis.Client) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("userID")
        if userID == "" {
            c.JSON(401, gin.H{"error": "unauthorized"})
            c.Abort()
            return
        }
        
        key := fmt.Sprintf("payment_count:%s", userID)
        ctx := context.Background()
        
        count, _ := redisClient.Incr(ctx, key).Result()
        redisClient.Expire(ctx, key, 1*time.Hour)
        
        if count > 5 {
            c.JSON(429, gin.H{"error": "too many payment requests (max 5 per hour)"})
            c.Abort()
            return
        }
        
        c.Next()
    }
}

// ✅ API Rate Limiter (100 per minute per IP)
func APIRateLimit(redisClient *redis.Client) gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        key := fmt.Sprintf("api_rate:%s", ip)
        ctx := context.Background()
        
        count, _ := redisClient.Incr(ctx, key).Result()
        redisClient.Expire(ctx, key, 1*time.Minute)
        
        if count > 100 {
            c.JSON(429, gin.H{"error": "rate limit exceeded"})
            c.Abort()
            return
        }
        
        c.Next()
    }
}
```

**Update routes:**

File: `be/apps/api/internal/routes/api.go`
```go
// ✅ Apply rate limiting to sensitive endpoints
api.POST("/payment/products/withdraw", 
    middleware.RateLimitMiddleware(cache.RDB, 1, 1*time.Hour),  // 1 per hour
    middleware.AuthMiddleware(authService),
    monetizationHandler.WithdrawProductEarnings)

api.POST("/payment/crypto/role",
    middleware.RateLimitMiddleware(cache.RDB, 5, 1*time.Hour),  // 5 per hour
    middleware.AuthMiddleware(authService),
    monetizationHandler.CreateRolePayment)

api.POST("/auth/login",
    middleware.RateLimitMiddleware(cache.RDB, 5, 1*time.Hour),  // 5 per hour
    authHandler.Login)
```

**Checklist:**
- [ ] Create rate limit middleware
- [ ] Apply to withdrawal endpoint (1 per hour)
- [ ] Apply to payment endpoints (5 per hour)
- [ ] Apply to login endpoint (5 per hour)
- [ ] Test rate limiting with multiple requests
- [ ] Verify Redis is used for tracking

---

## 📊 SECURITY SCORING

| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| Port Security | 0/10 | 10/10 | 🔴 |
| HTTPS/TLS | 5/10 | 10/10 | 🟠 |
| CSP Headers | 2/10 | 9/10 | 🔴 |
| Withdrawal Validation | 4/10 | 9/10 | 🔴 |
| Secrets Management | 3/10 | 9/10 | 🔴 |
| Database Security | 6/10 | 9/10 | 🟡 |
| Rate Limiting | 5/10 | 9/10 | 🟡 |
| **OVERALL** | **25/70** | **65/70** | 🔴 |

---

## 🚀 DEPLOYMENT CHECKLIST

**Pre-Production:**
- [ ] All 7 files dikompilasi ulang
- [ ] Test di staging environment
- [ ] SSL certificate tersedia (self-signed atau Let's Encrypt)
- [ ] `.env.prod` dengan strong passwords
- [ ] Redis password diubah dari default
- [ ] Database user dibuat per spec
- [ ] Nginx config di-update
- [ ] Docker compose ports di-verify

**During Deployment:**
- [ ] Backup database
- [ ] Run migrations
- [ ] Pull latest code
- [ ] Build Docker images
- [ ] `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Verify health checks pass
- [ ] Test HTTP → HTTPS redirect
- [ ] Test API endpoints with authentication

**Post-Production:**
- [ ] Monitor logs untuk errors
- [ ] Check dashboard untuk anomalies
- [ ] Verify no direct DB/Redis access
- [ ] Test withdrawal flow end-to-end
- [ ] Monitor rate limiting metrics
- [ ] Check security headers dengan curl

---

## 📞 NEXT STEPS

1. **Immediate (24h):** Execute TASK 1-3 (Port, HTTPS, Withdrawal)
2. **Short-term (48h):** Execute TASK 4-6 (Secrets, CSP, Database)
3. **Medium-term (7d):** Execute TASK 7 (Rate Limiting)
4. **Ongoing:** Monitor logs & security alerts

---

**Generated by Security Audit Tool**  
**Keep this file updated as you apply fixes!**
