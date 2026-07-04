apps/
└── api/
    │
    ├── cmd/
    │   └── server/
    │       └── main.go
    │
    ├── internal/
    │
    │   ├── config/
    │   │     env.go
    │   │
    │   ├── database/
    │   │     postgres.go
    │   │     redis.go
    │   │
    │   ├── storage/
    │   │     r2.go
    │   │
    │   ├── queue/
    │   │     client.go
    │   │     server.go
    │   │     jobs.go
    │   │
    │   ├── websocket/
    │   │     hub.go
    │   │     client.go
    │   │
    │   ├── middleware/
    │   │     auth.go
    │   │     cors.go
    │   │     logger.go
    │   │     ratelimit.go
    │   │
    │   ├── routes/
    │   │     api.go
    │   │
    │   ├── modules/
    │   │
    │   │     auth/
    │   │     │
    │   │     ├── handler.go
    │   │     ├── service.go
    │   │     ├── repository.go
    │   │     ├── model.go
    │   │     └── dto.go
    │   │
    │   │     user/
    │   │
    │   │     post/
    │   │
    │   │     comment/
    │   │
    │   │     like/
    │   │
    │   │     follow/
    │   │
    │   │     notification/
    │   │
    │   │     feed/
    │   │
    │   │     chat/
    │   │
    │   │     upload/
    │   │
    │   │     admin/
    │   │
    │   ├── worker/
    │   │
    │   │     image.go
    │   │     email.go
    │   │     notification.go
    │   │     search.go
    │   │
    │   ├── scheduler/
    │   │
    │   │     cron.go
    │   │
    │   ├── utils/
    │   │
    │   └── logger/
    │
    ├── go.mod

## Recommended Golang Libraries & Dependencies

For building a robust social media backend as per the architecture above, here are the essential libraries you will need:

### 1. Web Framework & Routing
- **Gin**: `github.com/gin-gonic/gin`
  Fast HTTP web framework used for REST APIs.

### 2. Database & ORM (PostgreSQL)
- **GORM**: `gorm.io/gorm`
  The primary ORM for database operations.
- **Postgres Driver**: `gorm.io/driver/postgres`
  PostgreSQL driver for GORM.

### 3. Caching & Background Jobs (Redis)
- **Go-Redis**: `github.com/redis/go-redis/v9`
  Type-safe Redis client.
- **Asynq**: `github.com/hibiken/asynq`
  Simple, reliable, and efficient distributed task queue built on top of Redis (used for Image, Email, and Notification workers).

### 4. Real-time Communication (WebSocket)
- **Gorilla WebSocket**: `github.com/gorilla/websocket`
  For real-time chat, notifications, and live feed updates.

### 5. Authentication & Security
- **JWT**: `github.com/golang-jwt/jwt/v5`
  For handling JSON Web Tokens.
- **Bcrypt**: `golang.org/x/crypto/bcrypt`
  For secure password hashing.

### 6. Validation
- **Go-Playground Validator**: `github.com/go-playground/validator/v10`
  For struct and field validation (already built into Gin, but good to know).

### 7. Configuration Management
- **Godotenv**: `github.com/joho/godotenv`
  For loading `.env` files.
- *(Alternative)* **Viper**: `github.com/spf13/viper`
  For advanced configuration management.

### 10. Utilities (Optional but Recommended)
- **UUID**: `github.com/google/uuid`
  For generating UUIDs for database primary keys.
- **Cors**: `github.com/gin-contrib/cors`
  Official CORS middleware for Gin.
