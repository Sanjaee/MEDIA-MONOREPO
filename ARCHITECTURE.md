                                      INTERNET
                                          │
                                          │
                                  Cloudflare DNS
                                          │
                                          │
                                 Cloudflare CDN/WAF
                                          │
                                          ▼
                                   NGINX (443)
                           SSL • Rate Limit • Cache
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    ▼                                           ▼
             Next.js Frontend                          Gin Monolith API
          SSR • CSR • RSC • API Route           REST API • WebSocket
                    │                                           │
                    │                                           │
                    │              ┌────────────────────────────┴────────────────────────────┐
                    │              │                                                         │
                    │              ▼                                                         ▼
                    │        Business Layer                                         Infrastructure Layer
                    │              │                                                         │
                    │              ├── Auth                                                Redis
                    │              ├── User                                                PostgreSQL
                    │              ├── Profile                                             Cloudflare R2
                    │              ├── Post                                                Logger
                    │              ├── Comment                                             Config
                    │              ├── Like                                                Storage
                    │              ├── Follow                                              Queue
                    │              ├── Feed
                    │              ├── Notification
                    │              ├── Search
                    │              ├── Chat
                    │              └── Admin
                    │
                    │
                    ▼
              TanStack Query
                    │
                    ▼
                 HTTP API
                    │
                    ▼
           ┌──────────────────────────────────────────────────────────────┐
           │                     Asynq (Redis Queue)                      │
           └───────────────┬───────────────┬───────────────┬──────────────┘
                           │               │               │
                           ▼               ▼               ▼
                  Image Queue      Notification Queue    Email Queue
                           │               │               │
                           ▼               ▼               ▼
                    Image Worker     Notification Worker  Email Worker
                           │               │               │
                           │               │               │
          ┌────────────────┘               │               └──────────────┐
          ▼                                ▼                              ▼
 Compress Image                     Push Notification              SMTP Provider
 Generate Thumbnail                 WebSocket                     OTP
 Convert WebP/AVIF                  FCM                           Newsletter
 Upload R2
          │
          ▼
 Cloudflare R2 Storage
          │
          ▼
 Cloudflare CDN
          │
          ▼
       Browser