# 🔐 PRODUCTION SECURITY FIXES - COMPLETE GUIDE
## MEDIA-MONOREPO Docker Setup

**Last Updated:** 2026-07-22  
**Status:** 🚨 CRITICAL - 9 Priority Tasks  
**Total Bobot:** 62/100 (62% Security Score)

---

# 📋 TABLE OF CONTENTS

1. [TASK 001 - HTTPS Redirect](#task-001---https-redirect)
2. [TASK 002 - Content Security Policy](#task-002---content-security-policy)
3. [TASK 003 - Remove Secrets from Frontend](#task-003---remove-secrets-from-frontend)
4. [TASK 004 - Database Security](#task-004---database-security)
5. [TASK 005 - Redis Hardening](#task-005---redis-hardening)
6. [TASK 006 - Rate Limiting](#task-006---rate-limiting)
7. [TASK 007 - Backend Dockerfile](#task-007---backend-dockerfile)
8. [TASK 008 - Frontend Dockerfile](#task-008---frontend-dockerfile)
9. [TASK 009 - Logging & Monitoring](#task-009---logging--monitoring)

---

---

# TASK 001 - HTTPS Redirect

**Severity:** 🔴 CRITICAL  
**Bobot:** 8/10  
**Component:** Nginx  
**File:** `nginx/nginx.conf` & `docker-compose.prod.yml`

## Problem
- Port 80 open tapi tidak redirect ke HTTPS
- HTTP plaintext = mudah di-intercept MITM
- JWT tokens dapat dicuri
- Database credentials visible di network

## Solution

### Step 1: Generate SSL Certificate

```bash
mkdir -p nginx/ssl

openssl req -x509 -newkey rsa:4096 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=localhost"

ls -la nginx/ssl/
```

### Step 2: Update docker-compose.prod.yml

Ganti nginx service:

```yaml
nginx:
  image: nginx:1.27-alpine
  container_name: media-nginx
  restart: unless-stopped
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro
  networks:
    - backend
  depends_on:
    nextjs:
      condition: service_healthy
    api:
      condition: service_healthy
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
    interval: 30s
    timeout: 3s
    retries: 3
    start_period: 10s
```

### Step 3: Replace nginx/nginx.conf

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

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main buffer=32k flush=5s;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    upstream nextjs_upstream {
        server nextjs:3000;
        keepalive 64;
    }

    upstream api_upstream {
        server api:8080;
        keepalive 64;
    }

    # HTTP -> HTTPS REDIRECT
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        
        return 301 https://$host$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2 default_server;
        listen [::]:443 ssl http2 default_server;
        server_name _;

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

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        location /api/ws {
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

        location /api/ {
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        location / {
            proxy_pass http://nextjs_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        location ~ /\. {
            deny all;
            access_log off;
        }
    }
}
```

### Testing

```bash
# Test redirect
curl -i http://localhost/

# Test HTTPS
curl -i https://localhost/ -k

# Check HSTS header
curl -i https://localhost/ -k | grep strict-transport
```

### Checklist
- [ ] Buat `nginx/ssl/` directory
- [ ] Generate certificate
- [ ] Update `docker-compose.prod.yml`
- [ ] Update `nginx/nginx.conf`
- [ ] Test HTTP redirect
- [ ] Test HTTPS connection

---

# TASK 002 - Content Security Policy

**Severity:** 🔴 CRITICAL  
**Bobot:** 9/10  
**Component:** Nginx  
**File:** `nginx/nginx.conf`

## Problem
```nginx
# ❌ SEKARANG - Terlalu permissive
add_header Content-Security-Policy "default-src 'self' http: https: ws: wss: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http: https: ws: wss:;" always;
```

- `'unsafe-inline'` & `'unsafe-eval'` = bypass CSP
- `data: blob:` = bisa inject malicious scripts
- `http:` = allow unencrypted connections
- CSP tidak memberikan proteksi apapun

## Solution

Update CSP header di nginx.conf (dalam server block HTTPS):

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https://api.example.com wss://api.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
```

### Full Updated Server Block

```nginx
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name _;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https://api.example.com wss://api.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;

    # ... rest of config
}
```

### Testing CSP

```bash
curl -i https://localhost/ -k | grep -i "content-security-policy"
```

### Checklist
- [ ] Update CSP header di nginx
- [ ] Remove `'unsafe-inline'` & `'unsafe-eval'`
- [ ] Test CSP dengan curl
- [ ] Check browser console untuk CSP violations
- [ ] Update domain dari example.com ke actual domain

---

# TASK 003 - Remove Secrets from Frontend

**Severity:** 🔴 CRITICAL  
**Bobot:** 9/10  
**Component:** Docker  
**File:** `docker-compose.prod.yml`

## Problem

```yaml
# ❌ SEKARANG - Secrets di FE
nextjs:
  environment:
    - DATABASE_URL=postgresql://...        # ❌ Database credentials
    - REDIS_URL=redis://...                # ❌ Redis password
    - PLISIO_API_KEY=...                   # ❌ Payment API key
    - R2_SECRET_ACCESS_KEY=...             # ❌ S3 secret
    - GOOGLE_CLIENT_SECRET=...             # ❌ OAuth secret
    - JWT_SECRET=...                       # ❌ JWT secret
```

Next.js membuild secrets ke JavaScript bundle = public!

## Solution

### Update docker-compose.prod.yml - nextjs section

```yaml
nextjs:
  build:
    context: ./fe
    dockerfile: Dockerfile
  image: media-nextjs:prod
  container_name: media-nextjs
  restart: unless-stopped
  environment:
    - NODE_ENV=production
    - BACKEND_API_URL=http://api:8080/api
    # ✅ ONLY PUBLIC VARIABLES
    - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    - NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
    - NEXT_PUBLIC_R2_PUBLIC_DOMAIN=${R2_PUBLIC_DOMAIN}
    # ❌ REMOVED: DATABASE_URL, REDIS_URL, PLISIO_API_KEY, etc.
  networks:
    - backend
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/"]
    interval: 30s
    timeout: 3s
    retries: 3
    start_period: 10s
```

### Create .env.example

```bash
# .env.example - COMMIT ini ke repo

# Frontend - Public
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
R2_PUBLIC_DOMAIN=your_r2_domain.com

# Database
DB_USER=media_prod_user
DB_PASSWORD=change_me_in_prod
DB_NAME=media_prod

# Redis
REDIS_PASSWORD=change_me_in_prod

# JWT & Auth
JWT_SECRET=your_jwt_secret_here
NEXTAUTH_SECRET=your_nextauth_secret_here

# Payment (Backend only!)
PLISIO_API_KEY=your_plisio_key

# R2 (Backend only!)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket_name
R2_ENDPOINT=your_endpoint

# OAuth (Backend only!)
GOOGLE_CLIENT_SECRET=your_google_secret
```

### Create .gitignore entries

```bash
# Add ke .gitignore
echo ".env" >> .gitignore
echo ".env.prod" >> .gitignore
echo ".env.prod.local" >> .gitignore
echo ".env.local" >> .gitignore
echo "nginx/ssl/" >> .gitignore
```

### Generate Production .env

```bash
#!/bin/bash
# save as: generate-env.sh
# chmod +x generate-env.sh

cat > .env.prod << 'EOF'
# Frontend - Public
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_actual_google_id
R2_PUBLIC_DOMAIN=your_actual_domain

# Database - STRONG PASSWORD!
DB_USER=media_prod_user
DB_PASSWORD=$(openssl rand -hex 32)
DB_NAME=media_prod

# Redis - STRONG PASSWORD!
REDIS_PASSWORD=$(openssl rand -hex 32)

# JWT - 64 chars
JWT_SECRET=$(openssl rand -hex 64)
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Payment
PLISIO_API_KEY=your_actual_plisio_key

# R2
R2_ACCOUNT_ID=your_actual_account
R2_ACCESS_KEY_ID=your_actual_key
R2_SECRET_ACCESS_KEY=your_actual_secret
R2_BUCKET=your_bucket
R2_ENDPOINT=your_endpoint

# OAuth
GOOGLE_CLIENT_SECRET=your_actual_secret
EOF

echo "✅ .env.prod created"
echo "⚠️  Fill in actual values before deploying!"
```

### Checklist
- [ ] Remove all secrets dari FE environment di docker-compose
- [ ] Create .env.example dengan template
- [ ] Add .env ke .gitignore
- [ ] Generate strong passwords
- [ ] Keep .env.prod di local machine (jangan commit!)
- [ ] Test build: `docker-compose -f docker-compose.prod.yml build nextjs`
- [ ] Verify FE tidak memiliki DATABASE_URL di bundle

---

# TASK 004 - Database Security

**Severity:** 🔴 CRITICAL  
**Bobot:** 7/10  
**Component:** PostgreSQL  
**Files:** `docker-compose.prod.yml`, `postgres/init.sql`

## Problem

```yaml
# ❌ SEKARANG - Weak defaults
postgres:
  environment:
    POSTGRES_PASSWORD: ${DB_PASSWORD}  # Harus STRONG!
    POSTGRES_DB: ${DB_NAME}
```

- Jika password lemah = trivial brute force
- Database tidak punya init script
- Credentials di plaintext environment

## Solution

### Step 1: Create postgres/init.sql

```sql
-- postgres/init.sql
-- Create dedicated user dengan strongest auth method

-- Create role
CREATE ROLE media_prod_user WITH LOGIN ENCRYPTED PASSWORD :'DB_PASSWORD';

-- Grant privileges
ALTER ROLE media_prod_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE media_prod TO media_prod_user;

-- Additional security
ALTER DATABASE media_prod OWNER TO media_prod_user;

-- Enable password authentication
-- (already set via POSTGRES_INITDB_ARGS in compose)
```

### Step 2: Update docker-compose.prod.yml - postgres service

```yaml
postgres:
  image: postgres:15-alpine
  container_name: media-postgres-prod
  restart: unless-stopped
  environment:
    POSTGRES_USER: ${DB_USER}
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: ${DB_NAME}
    # Force SCRAM-SHA-256 password encryption (most secure)
    POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
    interval: 10s
    timeout: 5s
    retries: 5
  volumes:
    - postgres_prod_data:/var/lib/postgresql/data
    - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
  networks:
    - backend
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

### Step 3: Generate Strong Password

```bash
# Generate 32-character random password
DB_PASSWORD=$(openssl rand -hex 32)
echo "DB_PASSWORD=$DB_PASSWORD" >> .env.prod

# Verify length
echo $DB_PASSWORD | wc -c  # Should be 65 (64 + newline)
```

### Step 4: Update .env.prod

```bash
# Add/Update ini di .env.prod
DB_USER=media_prod_user
DB_PASSWORD=$(openssl rand -hex 32)  # 64 chars, truly random
DB_NAME=media_prod
```

### Testing

```bash
# After containers running
docker-compose exec postgres psql -U media_prod_user -d media_prod

# Inside psql, run:
\du  -- List all users
\l   -- List all databases

# Verify SCRAM auth:
SELECT usename, usesuper FROM pg_user;
```

### Checklist
- [ ] Create `postgres/init.sql`
- [ ] Update `docker-compose.prod.yml` postgres section
- [ ] Add init.sql volume mount
- [ ] Generate strong password
- [ ] Test connection: `docker-compose exec postgres psql ...`
- [ ] Verify SCRAM-SHA-256 enabled
- [ ] NO PORTS exposed for postgres

---

# TASK 005 - Redis Hardening

**Severity:** 🟠 HIGH  
**Bobot:** 7/10  
**Component:** Redis  
**Files:** `redis/redis.conf`, `docker-compose.prod.yml`

## Problem

```conf
# ❌ SEKARANG
bind 0.0.0.0           # Listen semua interface
protected-mode yes     # Tapi dilindungi
# No maxmemory limit
# No persistence config
```

- Jika network misconfigured = Redis jadi public
- No memory limit = DoS possible
- Data tidak persistent

## Solution

### Step 1: Update redis/redis.conf

```conf
# Network
bind 0.0.0.0
protected-mode yes
port 6379

# Security
requirepass ${REDIS_PASSWORD}
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""
rename-command SHUTDOWN SHUTDOWN-PROD

# Memory management
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec
dir /data

# Slowlog
slowlog-log-slower-than 10000
slowlog-max-len 128

# Timeout
timeout 0
tcp-keepalive 300

# Save (RDB snapshots)
save 900 1
save 300 10
save 60 10000
```

### Step 2: Update docker-compose.prod.yml - redis service

```yaml
redis:
  image: redis:7-alpine
  container_name: media-redis-prod
  restart: unless-stopped
  command: redis-server /usr/local/etc/redis/redis.conf --requirepass ${REDIS_PASSWORD}
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 3s
    retries: 3
  volumes:
    - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    - redis_prod_data:/data
  networks:
    - backend
  # ✅ NO PORTS - completely internal
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

### Step 3: Generate Strong Password

```bash
REDIS_PASSWORD=$(openssl rand -hex 32)
echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> .env.prod
```

### Testing

```bash
# Test Redis connection
docker-compose exec redis redis-cli ping
# Expected: PONG (if no password set)

# Test with password
docker-compose exec redis redis-cli -a ${REDIS_PASSWORD} PING
# Expected: PONG

# Check memory limit
docker-compose exec redis redis-cli CONFIG GET maxmemory

# Check persistence
docker-compose exec redis redis-cli CONFIG GET appendonly
```

### Checklist
- [ ] Update `redis/redis.conf` lengkap
- [ ] Update `docker-compose.prod.yml` redis section
- [ ] Set requirepass via ENV
- [ ] Generate strong password
- [ ] NO PORTS exposed
- [ ] Add healthcheck
- [ ] Test persistence: restart container, data masih ada
- [ ] Verify max memory limit

---

# TASK 006 - Rate Limiting

**Severity:** 🟠 HIGH  
**Bobot:** 6/10  
**Component:** Nginx  
**File:** `nginx/nginx.conf`

## Problem

```nginx
# ❌ SEKARANG - Terlalu tinggi
limit_req_zone $binary_remote_addr zone=general:10m rate=100r/s;   # 100 req/s!
limit_req zone=general burst=50 nodelay;                            # 50 burst!
```

- 100 req/s per IP = attacker bisa spam
- 50 burst = request queue panjang
- Payment endpoint tidak ada rate limit ketat
- Login endpoint mudah di-brute force

## Solution

### Replace rate limiting section di nginx.conf

```nginx
http {
    # ... other config ...

    # Rate Limiting Zones
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=3r/m;
    limit_req_zone $binary_remote_addr zone=payment:10m rate=1r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=5r/m;

    # ... upstream config ...

    server {
        listen 443 ssl http2 default_server;
        listen [::]:443 ssl http2 default_server;
        server_name _;

        # SSL config...
        # Security headers...

        # WebSocket - moderate rate limit
        location /api/ws {
            limit_req zone=api burst=10 nodelay;
            proxy_pass http://api_upstream;
            # ... proxy config ...
        }

        # Login - VERY STRICT
        location ~ ^/api/auth/login$ {
            limit_req zone=login burst=2 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Payment - MOST STRICT
        location ~ ^/api/payment/ {
            limit_req zone=payment burst=1 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 30s;
            proxy_send_timeout 30s;
        }

        # Upload - STRICT
        location ~ ^/api/upload/ {
            limit_req zone=upload burst=2 nodelay;
            client_max_body_size 100M;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;
        }

        # API - MODERATE
        location /api/ {
            limit_req zone=api burst=10 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Frontend - GENERAL
        location / {
            limit_req zone=general burst=5 nodelay;
            proxy_pass http://nextjs_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Block sensitive files
        location ~ /\. {
            deny all;
            access_log off;
        }
    }
}
```

### Testing

```bash
# Test rate limit - should be blocked after 3 requests/min
for i in {1..5}; do
  curl -i https://localhost/api/auth/login -k
  sleep 1
done
# 4th & 5th request should return 429 Too Many Requests

# Test payment endpoint - should block after 1 request/min
curl -i https://localhost/api/payment/create -k
sleep 2
curl -i https://localhost/api/payment/create -k
# 2nd request should return 429
```

### Checklist
- [ ] Add 5 rate limit zones
- [ ] Set login to 3r/m
- [ ] Set payment to 1r/m
- [ ] Set upload to 5r/m
- [ ] Set general API to 30r/s
- [ ] Set general frontend to 10r/s
- [ ] Test each endpoint
- [ ] Check 429 responses appear correctly
- [ ] Monitor logs untuk rate limit hits

---

# TASK 007 - Backend Dockerfile

**Severity:** 🟡 MEDIUM  
**Bobot:** 5/10  
**Component:** Backend  
**File:** `be/apps/api/Dockerfile`

## Problem

```dockerfile
# ❌ SEKARANG
FROM golang:alpine AS builder
# ... build ...

FROM alpine:latest  # ❌ No version pinned
WORKDIR /app
COPY --from=builder /app/main .
# ❌ Running as root!
# ❌ No healthcheck
# ❌ No signal handling

CMD ["./main"]
```

- Running as root = full system access if compromised
- No version pinning = breaking changes possible
- No graceful shutdown handling

## Solution

Replace `be/apps/api/Dockerfile`:

```dockerfile
# Build Stage
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

# Build with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o main ./cmd/server/main.go

# Production Stage
FROM alpine:3.20

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -D -u 1001 -G appgroup appuser

# Copy binary
COPY --from=builder /app/main .

# Change ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/bin/sh", "-c", "wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1"]

CMD ["./main"]
```

### Checklist
- [ ] Pin Go version to 1.22
- [ ] Pin Alpine version to 3.20
- [ ] Create non-root user (appuser)
- [ ] Add healthcheck endpoint
- [ ] Add ca-certificates & tzdata
- [ ] Use CGO_ENABLED=0 untuk static binary
- [ ] Test build: `docker build be/apps/api`
- [ ] Verify runs as non-root: `docker run ... id`
- [ ] Verify healthcheck works

---

# TASK 008 - Frontend Dockerfile

**Severity:** 🟡 MEDIUM  
**Bobot:** 5/10  
**Component:** Frontend  
**File:** `fe/Dockerfile`

## Problem

```dockerfile
# ❌ SEKARANG
FROM node:20-alpine AS deps
FROM node:20-alpine AS builder
FROM node:20-alpine AS runner

# Heavy node:20 = 300MB+
# No signal handling
# No healthcheck
# Missing node_modules in runtime
```

- Heavy image size
- No graceful shutdown
- Missing some dependencies at runtime

## Solution

Replace `fe/Dockerfile`:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./

# Shallow clone untuk security
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./

# Install semua (termasuk devDependencies untuk build)
RUN npm ci

COPY . .

# Build dengan optimizations
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy production dependencies
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch user
USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init untuk signal handling
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
```

### Checklist
- [ ] Use dumb-init untuk signal handling
- [ ] Create non-root user (nextjs)
- [ ] Add healthcheck
- [ ] Copy node_modules dari deps stage
- [ ] Copy standalone output
- [ ] Test build: `docker build fe`
- [ ] Verify runs as non-root
- [ ] Verify image size: `docker images | grep nextjs`
- [ ] Test healthcheck works

---

# TASK 009 - Logging & Monitoring

**Severity:** 🟡 MEDIUM  
**Bobot:** 6/10  
**Component:** All Services  
**File:** `docker-compose.prod.yml`

## Problem

```yaml
# ❌ SEKARANG - No logging config
services:
  nginx: {}
  api: {}
  nextjs: {}
  # ... no logging specified
```

- Tidak bisa track siapa access apa
- Tidak bisa detect attack
- Tidak bisa audit trail
- Logs tidak di-rotate = disk penuh

## Solution

### Update docker-compose.prod.yml - Add logging ke semua services

```yaml
services:
  nginx:
    # ... existing config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nextjs:
    # ... existing config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  api:
    # ... existing config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

  postgres:
    # ... existing config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    # ... existing config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Create monitoring script

```bash
#!/bin/bash
# save as: monitoring.sh
# chmod +x monitoring.sh

echo "=== Container Status ==="
docker-compose ps

echo -e "\n=== Nginx Access Logs ==="
docker-compose logs --tail=20 nginx

echo -e "\n=== API Logs ==="
docker-compose logs --tail=20 api

echo -e "\n=== Frontend Logs ==="
docker-compose logs --tail=20 nextjs

echo -e "\n=== Database Logs ==="
docker-compose logs --tail=20 postgres

echo -e "\n=== Redis Info ==="
docker-compose exec redis redis-cli INFO stats

echo -e "\n=== Disk Usage ==="
docker system df
```

### View logs realtime

```bash
# Follow all logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f nginx
docker-compose logs -f api

# Last 50 lines of nginx
docker-compose logs --tail=50 nginx

# Search for errors
docker-compose logs | grep -i error
```

### Checklist
- [ ] Add logging driver ke semua services
- [ ] Set max-size to 10m
- [ ] Set max-file rotations (3-5)
- [ ] Create monitoring.sh script
- [ ] Test: `docker-compose logs`
- [ ] Test: `docker-compose logs -f nginx`
- [ ] Verify logs rotate when max-size reached
- [ ] Archive old logs periodically

---

---

# 🚀 QUICK START - COPY ALL CONFIGS

## Complete docker-compose.prod.yml

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:1.27-alpine
    container_name: media-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - backend
    depends_on:
      nextjs:
        condition: service_healthy
      api:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  nextjs:
    build:
      context: ./fe
      dockerfile: Dockerfile
    image: media-nextjs:prod
    container_name: media-nextjs
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - BACKEND_API_URL=http://api:8080/api
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
      - NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
      - NEXT_PUBLIC_R2_PUBLIC_DOMAIN=${R2_PUBLIC_DOMAIN}
    networks:
      - backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  api:
    build:
      context: ./be/apps/api
      dockerfile: Dockerfile
    image: media-api:prod
    container_name: media-api
    restart: unless-stopped
    environment:
      - PORT=8080
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - PLISIO_API_KEY=${PLISIO_API_KEY}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET=${R2_BUCKET}
      - R2_ENDPOINT=${R2_ENDPOINT}
      - R2_PUBLIC_DOMAIN=${R2_PUBLIC_DOMAIN}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    networks:
      - backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  postgres:
    image: postgres:15-alpine
    container_name: media-postgres-prod
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - backend
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: media-redis-prod
    restart: unless-stopped
    command: redis-server /usr/local/etc/redis/redis.conf --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    volumes:
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_prod_data:/data
    networks:
      - backend
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  backend:
    driver: bridge

volumes:
  postgres_prod_data:
  redis_prod_data:
```

---

## Complete nginx/nginx.conf

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

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main buffer=32k flush=5s;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    upstream nextjs_upstream {
        server nextjs:3000;
        keepalive 64;
    }

    upstream api_upstream {
        server api:8080;
        keepalive 64;
    }

    # Rate Limiting Zones
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=3r/m;
    limit_req_zone $binary_remote_addr zone=payment:10m rate=1r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=5r/m;

    # HTTP -> HTTPS Redirect
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        
        return 301 https://$host$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2 default_server;
        listen [::]:443 ssl http2 default_server;
        server_name _;

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

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https://api.example.com wss://api.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;

        # WebSocket
        location /api/ws {
            limit_req zone=api burst=10 nodelay;
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

        # Login - STRICT
        location ~ ^/api/auth/login$ {
            limit_req zone=login burst=2 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Payment - VERY STRICT
        location ~ ^/api/payment/ {
            limit_req zone=payment burst=1 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 30s;
            proxy_send_timeout 30s;
        }

        # Upload - STRICT
        location ~ ^/api/upload/ {
            limit_req zone=upload burst=2 nodelay;
            client_max_body_size 100M;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;
        }

        # API - MODERATE
        location /api/ {
            limit_req zone=api burst=10 nodelay;
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Frontend
        location / {
            limit_req zone=general burst=5 nodelay;
            proxy_pass http://nextjs_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Block sensitive files
        location ~ /\. {
            deny all;
            access_log off;
        }
    }
}
```

---

## Complete redis/redis.conf

```conf
# Network
bind 0.0.0.0
protected-mode yes
port 6379

# Security
requirepass ${REDIS_PASSWORD}
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""
rename-command SHUTDOWN SHUTDOWN-PROD

# Memory management
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec
dir /data

# Slowlog
slowlog-log-slower-than 10000
slowlog-max-len 128

# Timeout
timeout 0
tcp-keepalive 300

# Save (RDB snapshots)
save 900 1
save 300 10
save 60 10000
```

---

## Complete postgres/init.sql

```sql
-- Create role
CREATE ROLE media_prod_user WITH LOGIN ENCRYPTED PASSWORD :'DB_PASSWORD';

-- Grant privileges
ALTER ROLE media_prod_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE media_prod TO media_prod_user;

-- Set owner
ALTER DATABASE media_prod OWNER TO media_prod_user;
```

---

## Complete be/apps/api/Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o main ./cmd/server/main.go

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

RUN addgroup -g 1001 appgroup && \
    adduser -D -u 1001 -G appgroup appuser

COPY --from=builder /app/main .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/bin/sh", "-c", "wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1"]

CMD ["./main"]
```

---

## Complete fe/Dockerfile

```dockerfile
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV production

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
```

---

## .env.example

```bash
# Frontend - Public
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
R2_PUBLIC_DOMAIN=your_r2_domain.com

# Database
DB_USER=media_prod_user
DB_PASSWORD=change_me_in_prod
DB_NAME=media_prod

# Redis
REDIS_PASSWORD=change_me_in_prod

# JWT & Auth
JWT_SECRET=your_jwt_secret_here
NEXTAUTH_SECRET=your_nextauth_secret_here

# Payment (Backend only!)
PLISIO_API_KEY=your_plisio_key

# R2 (Backend only!)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket_name
R2_ENDPOINT=your_endpoint

# OAuth (Backend only!)
GOOGLE_CLIENT_SECRET=your_google_secret
```

---

## Deployment Script

```bash
#!/bin/bash
# save as: deploy.sh
# chmod +x deploy.sh

set -e

echo "🔐 MEDIA-MONOREPO Production Deployment"
echo "======================================="

# Step 1: Generate SSL Certificate
echo "📋 Step 1: Generating SSL Certificate..."
mkdir -p nginx/ssl
if [ ! -f nginx/ssl/cert.pem ]; then
  openssl req -x509 -newkey rsa:4096 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -days 365 \
    -nodes \
    -subj "/CN=localhost"
  echo "✅ SSL Certificate generated"
else
  echo "✅ SSL Certificate already exists"
fi

# Step 2: Create directories
echo "📋 Step 2: Creating directories..."
mkdir -p postgres
mkdir -p redis
echo "✅ Directories created"

# Step 3: Create init scripts
echo "📋 Step 3: Creating init scripts..."
cat > postgres/init.sql << 'EOF'
CREATE ROLE media_prod_user WITH LOGIN ENCRYPTED PASSWORD :'DB_PASSWORD';
ALTER ROLE media_prod_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE media_prod TO media_prod_user;
ALTER DATABASE media_prod OWNER TO media_prod_user;
EOF
echo "✅ postgres/init.sql created"

# Step 4: Generate .env.prod
echo "📋 Step 4: Generating .env.prod..."
if [ ! -f .env.prod ]; then
  DB_PASSWORD=$(openssl rand -hex 32)
  REDIS_PASSWORD=$(openssl rand -hex 32)
  JWT_SECRET=$(openssl rand -hex 64)
  NEXTAUTH_SECRET=$(openssl rand -hex 32)
  
  cat > .env.prod << EOF
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_id
R2_PUBLIC_DOMAIN=your_domain
DB_USER=media_prod_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=media_prod
REDIS_PASSWORD=$REDIS_PASSWORD
JWT_SECRET=$JWT_SECRET
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
PLISIO_API_KEY=your_plisio_key
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket
R2_ENDPOINT=your_endpoint
GOOGLE_CLIENT_SECRET=your_secret
EOF
  echo "✅ .env.prod created - EDIT WITH YOUR VALUES!"
else
  echo "✅ .env.prod already exists"
fi

# Step 5: Build images
echo "📋 Step 5: Building Docker images..."
docker-compose -f docker-compose.prod.yml build
echo "✅ Docker images built"

# Step 6: Start services
echo "📋 Step 6: Starting services..."
docker-compose -f docker-compose.prod.yml up -d
echo "✅ Services started"

# Step 7: Wait for health checks
echo "📋 Step 7: Waiting for services to be healthy..."
sleep 10
docker-compose ps
echo "✅ Services are running"

# Step 8: Verify
echo "📋 Step 8: Verifying deployment..."
curl -I https://localhost/ -k
echo "✅ HTTPS redirect working"

echo ""
echo "🎉 Deployment complete!"
echo "⚠️  Don't forget to:"
echo "  1. Update .env.prod with your actual values"
echo "  2. Update domain from example.com to your domain"
echo "  3. Replace self-signed cert with Let's Encrypt"
echo ""
```

---

# 📊 Security Score Matrix

| Task | Severity | Bobot | Status | Time |
|------|----------|-------|--------|------|
| 001 - HTTPS Redirect | 🔴 CRITICAL | 8/10 | ⚠️ | 30 min |
| 002 - CSP Fix | 🔴 CRITICAL | 9/10 | ⚠️ | 15 min |
| 003 - Remove Secrets | 🔴 CRITICAL | 9/10 | ⚠️ | 20 min |
| 004 - Database | 🔴 CRITICAL | 7/10 | ⚠️ | 25 min |
| 005 - Redis | 🟠 HIGH | 7/10 | ⚠️ | 20 min |
| 006 - Rate Limiting | 🟠 HIGH | 6/10 | ⚠️ | 30 min |
| 007 - Backend Dockerfile | 🟡 MEDIUM | 5/10 | ⚠️ | 20 min |
| 008 - Frontend Dockerfile | 🟡 MEDIUM | 5/10 | ⚠️ | 25 min |
| 009 - Logging | 🟡 MEDIUM | 6/10 | ⚠️ | 15 min |
| **TOTAL** | - | **62/100** | ⚠️ | **3 hours** |

---

# 🎯 Implementation Order

1. **TASK 001** → HTTPS Redirect (foundation)
2. **TASK 002** → CSP (immediate)
3. **TASK 003** → Remove Secrets (critical)
4. **TASK 004** → Database (data protection)
5. **TASK 005** → Redis (cache security)
6. **TASK 006** → Rate Limiting (attack prevention)
7. **TASK 007** → Backend Dockerfile (container security)
8. **TASK 008** → Frontend Dockerfile (container security)
9. **TASK 009** → Logging (monitoring)

---

# ✅ FINAL CHECKLIST

```bash
# After completing all tasks, run:

# 1. Generate cert
mkdir -p nginx/ssl
openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes -subj "/CN=localhost"

# 2. Create init scripts
mkdir -p postgres redis

# 3. Run deployment
chmod +x deploy.sh
./deploy.sh

# 4. Verify
docker-compose ps
curl -I https://localhost/ -k
docker-compose logs

# 5. Test endpoints
curl -i https://localhost/api/health -k
docker-compose exec redis redis-cli ping
docker-compose exec postgres psql -U media_prod_user -d media_prod

# 6. Security audit
curl -i https://localhost/ -k | grep -i "strict-transport"
curl -i https://localhost/ -k | grep -i "x-frame-options"
curl -i https://localhost/ -k | grep -i "content-security-policy"

# 7. Backup .env.prod
cp .env.prod .env.prod.backup
```

---

**Done! All configurations are ready to copy & deploy.**
