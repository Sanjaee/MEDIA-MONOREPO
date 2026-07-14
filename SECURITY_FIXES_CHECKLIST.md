# 🔐 SECURITY FIXES CHECKLIST - MEDIA-MONOREPO

> **Status:** 🚨 CRITICAL VULNERABILITIES FOUND
> **Last Updated:** 2026-07-13
> **Priority:** URGENT - Deploy within 72 hours

---

## 📋 TABLE OF CONTENTS

1. [Payment & Currency Module](#1-payment--currency-module)
2. [Authentication & Session](#2-authentication--session)
3. [Post Management](#3-post-management)
4. [Like & Interaction](#4-like--interaction)
5. [Comment System](#5-comment-system)
6. [Notification System](#6-notification-system)
7. [Product Digital Module](#7-product-digital-module)
8. [Follow & User Relationships](#8-follow--user-relationships)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Testing & Verification](#10-testing--verification)

---

# 1. PAYMENT & CURRENCY MODULE

## 🔴 P1: PLISIO API KEY LEAKAGE

- [x] **Extract API key from code**
  - [x] Remove `PLISIO_API_KEY` from `fe/src/lib/plisio.ts`
  - [x] Move to backend-only environment variables
  - [x] Update `be/apps/api/internal/modules/monetization/service.go`
  
  ```bash
  # Verify in .env files
  grep -r "PLISIO_API_KEY" fe/src/
  # Should return: NOTHING
  ```

- [x] **Create backend proxy endpoint**
  - [x] File: `be/apps/api/internal/modules/monetization/handler.go`
  - [x] Add endpoint: `POST /api/payment/plisio/verify-key`
  - [x] Only verify signature, never expose key
  
  ```go
  func (h *Handler) VerifySignature(c *gin.Context) {
      // ✅ Do verification SERVER-SIDE
      // ❌ Never send key to client
  }
  ```

- [x] **Update frontend to use proxy**
  - [x] File: `fe/src/lib/plisio.ts`
  - [x] Remove all direct API key usage
  - [x] Call backend endpoint instead

- [x] **Rotate compromised API key**
  - [x] Generate new key in Plisio dashboard
  - [x] Update only backend environment
  - [x] Test payment flow end-to-end

- [x] **Add rate limiting on payment endpoints**
  - [x] Max 5 payment requests per user per hour
  - [x] Use Redis for tracking

---

## 🟠 P1: PAYMENT WEBHOOK SIGNATURE NOT VERIFIED PROPERLY

- [x] **Implement strict webhook signature validation**
  - [x] File: `be/apps/api/internal/modules/monetization/service.go` (Lines 477-505)
  - [x] Lines: 477-505
  
  ```go
  // ✅ Current: verifyPlisioCallback()
  // ✅ Already implemented but needs:
  // 1. Timing attack protection
  // 2. Nonce validation
  // 3. Webhook replay protection
  ```

- [x] **Add nonce/timestamp validation**
  - [x] Reject webhooks older than 5 minutes
  - [x] Store used nonces in Redis with expiry
  - [x] Prevent replay attacks

  ```go
  func verifyWebhookNonce(nonce string, redisClient *redis.Client) error {
      // Check if nonce already processed
      exists, _ := redisClient.Exists(ctx, fmt.Sprintf("webhook_nonce:%s", nonce)).Result()
      if exists > 0 {
          return errors.New("duplicate webhook")
      }
      // Store nonce
      redisClient.Set(ctx, fmt.Sprintf("webhook_nonce:%s", nonce), true, 5*time.Minute)
      return nil
  }
  ```

- [x] **Log all webhook events**
  - [x] Store in database for audit trail
  - [x] Include: timestamp, signature, status, amount
  - [x] Table: `payment_webhooks`

- [x] **Test webhook signature validation**
  - [x] [ ] Valid signature → Accept
  - [x] [ ] Invalid signature → Reject
  - [x] [ ] Replay attack → Reject
  - [x] [ ] Tampered amount → Reject

---

## 🟠 P2: WEBHOOK HANDLER DOESN'T VERIFY PAYMENT STATUS

- [x] **Add payment status validation**
  - [x] File: `be/apps/api/internal/modules/monetization/service.go`
  - [x] Verify payment actually went through before updating DB

  ```go
  func (s *service) HandlePlisioWebhook(payload []byte) error {
      // ... existing code ...
      
      // ✅ Before marking as success:
      // 1. Verify status is 'completed'
      if paymentStatus != "success" {
          return fmt.Errorf("payment not completed: %s", cb.Status)
      }
      
      // 2. Verify amount matches
      if cb.Amount != expectedAmount {
          return fmt.Errorf("amount mismatch: expected %d, got %d", expectedAmount, cb.Amount)
      }
      
      // 3. Verify user still exists
      user, err := s.userRepo.GetByID(tx.UserID)
      if err != nil || user == nil {
          return fmt.Errorf("user not found")
      }
  }
  ```

- [x] **Add idempotency check**
  - [x] Check if transaction already processed by orderNumber
  - [x] Skip if already processed successfully
  - [x] Prevent double-crediting

- [x] **Test various payment statuses**
  - [x] [ ] pending → NOT credited
  - [x] [ ] success → credited
  - [x] [ ] failed → NOT credited
  - [x] [ ] cancelled → NOT credited

---

## 🔴 P1: HIDDEN JAVASCRIPT SENDING PAYMENT DATA TO EXTERNAL SERVER

- [x] **Audit all external requests in frontend**
  - [x] Search for all `fetch()` calls
  - [x] Search for all `axios()` calls
  - [x] File: `fe/src/components/feed/PostCard.tsx` (Lines 234-250)

  ```bash
  grep -r "fetch\|axios" fe/src --include="*.tsx" --include="*.ts"
  ```

- [x] **Verify payment requests go to backend only**
  - [x] `/api/payment/plisio/create` ✅ (backend proxy)
  - [x] `/api/payment/plisio/product` ✅ (backend proxy)
  - [x] Should NOT go to: Plisio API directly ❌

- [x] **Implement Content Security Policy (CSP)**
  - [x] File: `fe/next.config.js` or middleware
  
  ```javascript
  // ✅ Restrict to backend only
  const csp = "connect-src 'self' https://api.example.com";
  ```

- [x] **Remove any direct Plisio API calls**
  - [x] Grep for `api.plisio.net`
  - [x] Should be ZERO results
  - [x] All calls through backend proxy

- [x] **Test in browser DevTools**
  - [x] Network tab
  - [x] No requests to `api.plisio.net`
  - [x] No API key in localStorage
  - [x] No API key in sessionStorage

---

## 🟠 P2: PAYMENT REDIRECT URL VALIDATION MISSING

- [x] **Validate callback URLs**
  - [x] File: `be/apps/api/internal/modules/monetization/service.go`
  - [x] Whitelist only frontend domain

  ```go
  func ValidateCallbackURL(url string) error {
      allowedHosts := []string{
          "https://example.com",
          "https://app.example.com",
      }
      
      for _, host := range allowedHosts {
          if strings.HasPrefix(url, host) {
              return nil
          }
      }
      
      return errors.New("invalid callback URL")
  }
  ```

- [x] **Test URL injection**
  - [x] [ ] Valid URL → Accept
  - [x] [ ] Different domain → Reject
  - [x] [ ] Protocol injection → Reject
  - [x] [ ] Redirect chain → Reject

---

## 🟡 P2: NO TRANSACTION TIMEOUT/EXPIRY

- [x] **Add transaction expiry**
  - [x] File: `be/apps/api/internal/modules/monetization/model.go`
  - [x] Add `ExpiresAt` field to Transaction

  ```go
  type Transaction struct {
      ID            string
      UserID        string
      Amount        int
      Status        string
      CreatedAt     time.Time
      
      // ✅ NEW
      ExpiresAt     time.Time // Payment must complete within 24 hours
      CompletedAt   *time.Time
  }
  ```

- [x] **Implement cleanup job**
  - [x] File: `be/apps/api/internal/worker/cleanup.go`
  - [x] Mark expired payments as failed every hour
  
  ```go
  func CleanupExpiredTransactions(ctx context.Context) {
      // Find transactions older than 24 hours
      // Mark as "expired"
      // Notify user
  }
  ```

- [x] **Test transaction expiry**
  - [x] [ ] Active transaction → Can complete
  - [x] [ ] Expired transaction → Cannot complete
  - [x] [ ] Completed transaction → No expiry

---

# 2. AUTHENTICATION & SESSION

## 🟠 P1: AUTHENTICATION USING USER ID AS BEARER TOKEN

- [ ] **Replace user ID token with proper JWT**
  - [ ] File: `fe/src/auth.ts`
  - [ ] File: `be/apps/api/internal/modules/auth/handler.go`

  ```go
  // ❌ Current
  userID := authHeader[7:] // Just user ID!

  // ✅ Should be
  token := authHeader[7:]
  claims, err := jwt.ParseWithClaims(token, &jwt.StandardClaims{}, func(token *jwt.Token) (interface{}, error) {
      return jwtSecret, nil
  })
  if err != nil {
      return nil, err
  }
  userID := claims.Subject
  ```

- [ ] **Generate JWT with proper claims**
  - [ ] File: `be/apps/api/internal/modules/auth/service.go`
  - [ ] Create `GenerateToken()` function

  ```go
  func (s *service) GenerateToken(userID string) (string, error) {
      claims := &jwt.StandardClaims{
          Subject: userID,
          ExpiresAt: time.Now().Add(24 * time.Hour).Unix(),
          IssuedAt: time.Now().Unix(),
          Issuer: "media-api",
      }
      
      token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
      return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
  }
  ```

- [ ] **Add JWT validation middleware**
  - [ ] File: `be/apps/api/internal/middleware/auth.go`
  
  ```go
  func JWTMiddleware() gin.HandlerFunc {
      return func(c *gin.Context) {
          authHeader := c.GetHeader("Authorization")
          if authHeader == "" {
              c.JSON(401, gin.H{"error": "missing token"})
              c.Abort()
              return
          }
          
          if len(authHeader) <= 7 || authHeader[:7] != "Bearer " {
              c.JSON(401, gin.H{"error": "invalid token format"})
              c.Abort()
              return
          }
          
          token := authHeader[7:]
          claims, err := ValidateToken(token)
          if err != nil {
              c.JSON(401, gin.H{"error": "invalid token"})
              c.Abort()
              return
          }
          
          c.Set("userID", claims.Subject)
          c.Next()
      }
  }
  ```

- [ ] **Update session endpoints to use JWT**
  - [ ] `POST /api/auth/login` → Return JWT
  - [ ] `POST /api/auth/refresh` → Refresh JWT
  - [ ] `GET /api/auth/me` → Validate JWT

- [ ] **Test authentication**
  - [ ] [ ] No token → 401 Unauthorized
  - [ ] [ ] Expired token → 401 Unauthorized
  - [ ] [ ] Invalid token → 401 Unauthorized
  - [ ] [ ] Valid token → 200 OK

---

## 🟡 P2: SESSION TOKEN NOT VALIDATED IN GO ADAPTER

- [ ] **Validate session in adapter endpoints**
  - [ ] File: `fe/src/lib/go-adapter.ts`
  - [ ] File: `be/apps/api/internal/modules/auth/handler.go`

  ```go
  func (h *Handler) GetSessionAndUser(c *gin.Context) {
      sessionToken := c.Param("sessionToken")
      
      // ✅ Validate format
      if !isValidSessionToken(sessionToken) {
          c.JSON(400, gin.H{"error": "invalid session token format"})
          return
      }
      
      // ✅ Query database
      s, u, err := h.service.GetSessionAndUser(sessionToken)
      if err != nil || s == nil || u == nil {
          c.JSON(404, gin.H{"error": "session not found"})
          return
      }
      
      // ✅ Verify session not expired
      if time.Now().After(s.Expires) {
          c.JSON(401, gin.H{"error": "session expired"})
          return
      }
      
      c.JSON(200, gin.H{"session": s, "user": u})
  }
  ```

- [ ] **Add session expiry check**
  - [ ] File: `be/apps/api/internal/modules/user/model.go`
  - [ ] Add `ExpiresAt` validation

- [ ] **Test session validation**
  - [ ] [ ] Valid session → OK
  - [ ] [ ] Expired session → 401
  - [ ] [ ] Non-existent session → 404
  - [ ] [ ] Malformed session → 400

---

## 🟠 P1: NO CSRF PROTECTION ON NEXTAUTH ROUTES

- [ ] **Add CSRF tokens to auth endpoints**
  - [ ] File: `fe/src/middleware.ts`
  
  ```typescript
  // ✅ Add CSRF middleware
  export const middleware = (request: NextRequest) => {
      const response = NextResponse.next();
      
      if (request.method !== "GET") {
          const csrfToken = request.headers.get("x-csrf-token");
          if (!csrfToken) {
              return NextResponse.json(
                  { error: "CSRF token missing" },
                  { status: 403 }
              );
          }
      }
      
      return response;
  };
  ```

- [ ] **Generate CSRF tokens**
  - [ ] File: `fe/src/lib/csrf.ts`
  - [ ] Generate unique token per session
  - [ ] Store in secure HTTP-only cookie

- [ ] **Validate CSRF on backend**
  - [ ] File: `be/apps/api/internal/middleware/csrf.go`
  - [ ] Compare token from header vs cookie

- [ ] **Test CSRF protection**
  - [ ] [ ] No CSRF token → 403 Forbidden
  - [ ] [ ] Invalid CSRF token → 403 Forbidden
  - [ ] [ ] Valid CSRF token → 200 OK

---

# 3. POST MANAGEMENT

## 🔴 P1: PRODUCT URL VISIBLE BEFORE PURCHASE

- [ ] **Tokenize product URLs**
  - [ ] File: `be/apps/api/internal/modules/monetization/handler.go`
  - [ ] Create `GenerateProductAccessToken()` function

  ```go
  func (h *Handler) GenerateProductAccessURL(c *gin.Context) {
      userID := c.GetString("userID")
      postID := c.Param("postId")
      
      // ✅ Verify purchase
      hasBought, err := h.service.VerifyProductPurchase(userID, postID)
      if err != nil || !hasBought {
          c.JSON(403, gin.H{"error": "not purchased"})
          return
      }
      
      // ✅ Generate token
      token := &ProductAccessToken{
          TokenID: uuid.New().String(),
          PostID: postID,
          UserID: userID,
          ExpiresAt: time.Now().Add(30 * time.Minute),
      }
      
      // ✅ Store in Redis (NOT visible to client)
      h.redisClient.Set(ctx, 
          fmt.Sprintf("product_token:%s", token.TokenID),
          token.R2URL,
          30*time.Minute,
      )
      
      // ✅ Return ONLY token
      c.JSON(200, gin.H{
          "accessToken": token.TokenID,
          "expiresIn": 30 * 60,
      })
  }
  ```

- [ ] **Create protected download endpoint**
  - [ ] File: `be/apps/api/internal/modules/monetization/handler.go`
  - [ ] Endpoint: `GET /api/products/download?token=...`

  ```go
  func (h *Handler) DownloadProductByToken(c *gin.Context) {
      token := c.Query("token")
      
      // ✅ Verify token exists & not expired
      r2URL, err := h.redisClient.Get(ctx, fmt.Sprintf("product_token:%s", token)).Result()
      if err != nil {
          c.JSON(401, gin.H{"error": "invalid or expired token"})
          return
      }
      
      // ✅ ONE-TIME USE - delete immediately
      h.redisClient.Del(ctx, fmt.Sprintf("product_token:%s", token))
      
      // ✅ Generate temporary signed URL from R2
      signedURL, _ := h.r2Client.GeneratePresignedURL(r2URL, 5*time.Minute)
      c.Redirect(http.StatusTemporaryRedirect, signedURL)
  }
  ```

- [ ] **Update frontend to use tokens**
  - [ ] File: `fe/src/components/feed/PostCard.tsx`
  - [ ] Remove direct URL access
  - [ ] Use token endpoint

  ```typescript
  const handleAccessProduct = async () => {
      try {
          const response = await fetch(`/api/products/${post.id}/access-token`, {
              method: "POST"
          });
          const { accessToken } = await response.json();
          
          // ✅ Open with token, NOT direct URL
          window.open(`/api/products/download?token=${accessToken}`, '_blank');
      } catch (e) {
          toast.error("Access denied");
      }
  };
  ```

- [ ] **Secure R2 buckets**
  - [ ] Block public access
  - [ ] Allow only signed URLs
  - [ ] Set 5-minute expiry on all signed URLs

- [ ] **Test product URL protection**
  - [ ] [ ] Non-buyer tries direct URL → 403
  - [ ] [ ] Buyer gets token → Can access
  - [ ] [ ] Token used twice → Second request fails
  - [ ] [ ] Expired token → 401

---

## 🟡 P2: PRODUCT URL VISIBLE IN POST DETAILS PAGE

- [ ] **Scrub product URLs on detail page**
  - [ ] File: `be/apps/api/internal/modules/post/service.go` (Lines 172-181)
  - [ ] Already implemented but verify

  ```go
  func scrubPost(p *Post, userID string) *Post {
      if p.IsProduct != nil && *p.IsProduct {
          if !p.HasBought && p.AuthorID != userID {
              p.ProductURL = nil  // ✅ Set to nil
          }
      }
      return p
  }
  ```

- [ ] **Apply on ALL post endpoints**
  - [ ] [ ] `GET /api/posts/:id`
  - [ ] [ ] `GET /api/feed/latest`
  - [ ] [ ] `GET /api/feed/trending`
  - [ ] [ ] `GET /api/feed/hot`
  - [ ] [ ] `GET /api/posts/search`

- [ ] **Test scrubbing**
  - [ ] [ ] Author sees URL
  - [ ] [ ] Buyer sees URL
  - [ ] [ ] Non-buyer does NOT see URL

---

## 🔴 P1: POST VISIBILITY NOT ENFORCED

- [ ] **Add visibility check to FindByID**
  - [ ] File: `be/apps/api/internal/modules/post/repository.go` (Lines 37-58)

  ```go
  func (r *repository) FindByID(userID, id string) (*Post, error) {
      var post Post
      query := r.db.Preload("Author").Preload("Media")
      
      // ✅ BUILD VISIBILITY FILTER
      visibilityCondition := `
          (visibility = 'public') OR
          (visibility = 'private' AND author_id = ?) OR
          (visibility = 'followers' AND author_id IN (
              SELECT following_id FROM follows WHERE follower_id = ?
          ))
      `
      
      query = query.Where("id = ?", id).
              Where(visibilityCondition, userID, userID)
      
      err := query.First(&post).Error
      if err != nil {
          if errors.Is(err, gorm.ErrRecordNotFound) {
              return nil, fmt.Errorf("post not found or access denied")
          }
          return nil, err
      }
      
      return &post, nil
  }
  ```

- [ ] **Apply to ALL feed queries**
  - [ ] [ ] `GetLatestFeed()`
  - [ ] [ ] `GetTrendingFeed()`
  - [ ] [ ] `GetHotFeed()`
  - [ ] [ ] `GetSearchFeed()`

- [ ] **Test visibility enforcement**
  - [ ] [ ] Non-follower cannot see private post
  - [ ] [ ] Follower CAN see followers-only post
  - [ ] [ ] Author can always see own post
  - [ ] [ ] Public posts visible to all

---

## 🟡 P2: NO SOFT DELETE FOR POSTS

- [ ] **Add soft delete to Post model**
  - [ ] File: `be/apps/api/internal/modules/post/model.go`

  ```go
  type Post struct {
      ID              string
      AuthorID        string
      Content         *string
      // ... existing fields ...
      
      // ✅ NEW - Soft Delete
      DeletedAt       *time.Time `gorm:"index"`
      DeletedBy       *string
      DeleteReason    *string // "user_deleted", "spam", "violation"
  }
  ```

- [ ] **Update delete function**
  - [ ] File: `be/apps/api/internal/modules/post/service.go`

  ```go
  func (s *service) DeletePost(ctx context.Context, postID, userID string) error {
      post, err := s.repository.FindByID(userID, postID)
      if err != nil {
          return err
      }
      
      if post.AuthorID != userID {
          return errors.New("unauthorized")
      }
      
      // ✅ SOFT DELETE
      now := time.Now()
      post.DeletedAt = &now
      post.DeletedBy = &userID
      reason := "user_deleted"
      post.DeleteReason = &reason
      
      return s.repository.Update(post)
  }
  ```

- [ ] **Filter soft-deleted posts**
  - [ ] All queries should add: `WHERE deleted_at IS NULL`

- [ ] **Test soft delete**
  - [ ] [ ] Deleted post not visible
  - [ ] [ ] Can still recover if needed
  - [ ] [ ] Audit trail preserved

---

# 4. LIKE & INTERACTION

## 🔴 P1: LIKE COUNTING CAN BE MANIPULATED WITH BOT SPAM

- [x] **Add rate limiting for likes**
  - [x] File: `be/apps/api/internal/middleware/ratelimit.go`

  ```go
  func RateLimitMiddleware(redisClient *redis.Client, maxRequests int, window time.Duration) gin.HandlerFunc {
      return func(c *gin.Context) {
          userID := c.GetString("userID")
          postID := c.Param("id")
          
          key := fmt.Sprintf("rate_limit:like:%s:%s", userID, postID)
          count, _ := redisClient.Incr(c.Request.Context(), key).Result()
          
          if count == 1 {
              redisClient.Expire(c.Request.Context(), key, window)
          }
          
          if count > int64(maxRequests) {
              c.JSON(http.StatusTooManyRequests, gin.H{
                  "error": "rate limit exceeded",
                  "retryAfter": window.Seconds(),
              })
              c.Abort()
              return
          }
          
          c.Next()
      }
  }
  ```

- [x] **Apply rate limiting to like endpoint**
  - [x] File: `be/apps/api/internal/routes/api.go`

  ```go
  router.POST("/posts/:id/like", 
      middleware.RateLimitMiddleware(redisClient, 1, 5*time.Second),
      controller.ToggleLike,
  )
  ```

- [ ] **Add global user rate limit**
  - [ ] Max 100 likes per hour per user
  - [ ] Detect bot behavior patterns

- [x] **Strengthen frontend debounce**
  - [x] File: `fe/src/components/feed/PostCard.tsx` (Lines 65-132)
  - [x] Increase debounce from 500ms to 1s
  - [x] Add minimum 5-second cooldown between posts

- [x] **Test rate limiting**
  - [x] [x] First like → Success
  - [x] [x] Immediate second like → Rate limited
  - [x] [x] After 5 seconds → Can like again
  - [x] [x] Spam attack → Blocked

---

## 🟡 P2: LIKE COUNTS NOT USING TRANSACTIONS

- [x] **Use database transactions**
  - [x] File: `be/apps/api/internal/modules/interaction/repository.go` (Lines 26-50)
  - [x] Already implemented ✅
  - [x] Verify transaction rollback on error

- [x] **Test transaction safety**
  - [x] [x] Network error mid-transaction → Rollback
  - [x] [x] Database error → Rollback
  - [x] [x] Like count accurate after rollback

---

# 5. COMMENT SYSTEM

## 🔴 P1: COMMENT DELETE WITHOUT AUTHOR VERIFICATION

- [x] **Fix authorization check**
  - [x] File: `be/apps/api/internal/modules/comment/service.go` (Lines 61-92)

  ```go
  func (s *service) DeleteComment(ctx context.Context, id string, userID string) error {
      comment, err := s.repository.FindByID(id)
      if err != nil {
          return err
      }
      
      // ✅ PROPER CHECK - MUST RETURN ERROR
      if comment.AuthorID != userID {
          return errors.New("unauthorized: you can only delete your own comments")
      }
      
      err = s.repository.Delete(id)
      if err != nil {
          return err
      }
      
      return nil
  }
  ```

- [x] **Add check in controller**
  - [x] File: `be/apps/api/internal/modules/comment/controller.go`

  ```go
  func (c *Controller) DeleteComment(ctx *gin.Context) {
      commentID := ctx.Param("id")
      
      userID, exists := ctx.Get("userID")
      if !exists {
          ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
          return
      }
      
      // ✅ Handle authorization error
      err := c.service.DeleteComment(ctx.Request.Context(), commentID, userID.(string))
      if err != nil {
          if strings.Contains(err.Error(), "unauthorized") {
              ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
              return
          }
          ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
          return
      }
      
      ctx.JSON(http.StatusOK, gin.H{"status": "deleted"})
  }
  ```

- [x] **Test authorization**
  - [x] [x] Own comment → Can delete
  - [x] [x] Other's comment → 403 Forbidden
  - [x] [x] Non-existent comment → 404

---

## 🟡 P2: NO SOFT DELETE FOR COMMENTS

- [x] **Add soft delete to Comment model**
  - [x] File: `be/apps/api/internal/modules/comment/model.go`

  ```go
  type Comment struct {
      ID              string
      PostID          string
      ParentCommentID *string
      AuthorID        string
      Author          *user.User
      Content         string
      LikeCount       *int
      ReplyCount      *int
      
      // ✅ NEW - Soft Delete
      DeletedAt       *time.Time `gorm:"index"`
      DeletedBy       *string
      DeleteReason    *string
      
      CreatedAt       time.Time
      UpdatedAt       time.Time
  }
  ```

- [x] **Update delete function**
  - [x] File: `be/apps/api/internal/modules/comment/repository.go`

  ```go
  func (r *repository) Delete(id string, userID string) error {
      now := time.Now()
      
      return r.db.Model(&Comment{}).
          Where("id = ?", id).
          Updates(map[string]interface{}{
              "deleted_at": now,
              "deleted_by": userID,
              "delete_reason": "user_deleted",
          }).Error
  }
  ```

- [x] **Filter soft-deleted comments**
  - [x] All query: `WHERE deleted_at IS NULL`

- [x] **Test soft delete**
  - [x] [x] Deleted comment not visible
  - [x] [x] Deleted comment present in DBupdated
  - [ ] [ ] Replies preserved

---

## 🔴 P1: NO VALIDATION ON COMMENT CONTENT

- [x] **Add content validation**
  - [x] File: `be/apps/api/internal/modules/comment/controller.go`

  ```go
  func (c *Controller) CreateComment(ctx *gin.Context) {
      var req struct {
          PostID          string  `json:"postId" binding:"required"`
          Content         string  `json:"content" binding:"required,min=1,max=5000"`
          ParentCommentID *string `json:"parentCommentId"`
      }
      
      if err := ctx.ShouldBindJSON(&req); err != nil {
          ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
          return
      }
      
      // ✅ Additional validation
      content := strings.TrimSpace(req.Content)
      if len(content) == 0 {
          ctx.JSON(http.StatusBadRequest, gin.H{"error": "comment cannot be empty"})
          return
      }
      
      if len(content) > 5000 {
          ctx.JSON(http.StatusBadRequest, gin.H{"error": "comment too long"})
          return
      }
      
      // Continue...
  }
  ```

- [x] **Add spam detection**
  - [x] Check for repeated characters
  - [x] Check for excessive links
  - [x] Check for common spam patterns

- [x] **Test content validation**
  - [x] [x] Empty comment → Rejected
  - [x] [x] Too long → Rejected
  - [x] [x] Valid comment → Accepted

---

# 6. NOTIFICATION SYSTEM

## 🟠 P1: NOTIFICATION SPAM ATTACK POSSIBLE

- [x] **Add rate limiting to notifications**
  - [x] File: `be/apps/api/internal/modules/notification/service.go`

  ```go
  func (s *service) CreateCommentNotification(userID, actorID, postID, commentText string) error {
      // ✅ 1. Skip self-notifications
      if userID == actorID {
          return nil
      }
      
      // ✅ 2. Validate userID exists
      _, err := s.repo.GetUserByID(userID)
      if err != nil {
          return err
      }
      
      // ✅ 3. Rate limit - max 5 notifications per actor per hour
      ctx := context.Background()
      key := fmt.Sprintf("notif_count:%s:%s", userID, actorID)
      count, _ := s.redisClient.Incr(ctx, key).Result()
      
      if count == 1 {
          s.redisClient.Expire(ctx, key, 1*time.Hour)
      }
      
      if count > 5 {
          return errors.New("notification rate limit exceeded")
      }
      
      // ✅ 4. Avoid duplicate notifications
      recentKey := fmt.Sprintf("recent_notif:%s:%s:%s", userID, actorID, "COMMENT")
      exists, _ := s.redisClient.Exists(ctx, recentKey).Result()
      if exists > 0 {
          return nil // Already notified recently
      }
      
      s.redisClient.Set(ctx, recentKey, true, 5*time.Minute)
      
      // ... Create notification ...
  }
  ```

- [x] **Add anti-spam rules to all notification types**
  - [x] [x] Like notifications
  - [x] [x] Comment notifications
  - [x] [x] Follow notifications
  - [x] [x] Payment notifications

- [x] **Test notification rate limiting**
  - [x] [x] First notification → Sent
  - [x] [x] 5 more notifications → Sent
  - [x] [x] 6th notification → Blocked
  - [x] [x] After 1 hour → Can send again

---

## 🟠 P2: WEBSOCKET NOTIFICATIONS NOT ENCRYPTED

- [ ] **Implement WebSocket encryption**
  - [ ] File: `be/apps/api/internal/websocket/encryption.go`

  ```go
  package websocket

  import (
      "crypto/aes"
      "crypto/cipher"
      "crypto/rand"
      "encoding/base64"
      "encoding/json"
      "io"
  )

  type EncryptedPayload struct {
      IV         string `json:"iv"`
      CipherText string `json:"ct"`
  }

  func EncryptMessage(plaintext []byte, key []byte) (*EncryptedPayload, error) {
      block, _ := aes.NewCipher(key)
      gcm, _ := cipher.NewGCM(block)
      
      nonce := make([]byte, gcm.NonceSize())
      io.ReadFull(rand.Reader, nonce)
      
      ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
      
      return &EncryptedPayload{
          IV:         base64.StdEncoding.EncodeToString(nonce),
          CipherText: base64.StdEncoding.EncodeToString(ciphertext),
      }, nil
  }

  func DecryptMessage(encrypted *EncryptedPayload, key []byte) ([]byte, error) {
      block, _ := aes.NewCipher(key)
      gcm, _ := cipher.NewGCM(block)
      
      nonce, _ := base64.StdEncoding.DecodeString(encrypted.IV)
      ciphertext, _ := base64.StdEncoding.DecodeString(encrypted.CipherText)
      
      return gcm.Open(nil, nonce, ciphertext, nil)
  }
  ```

- [ ] **Update notification service to encrypt**
  - [ ] File: `be/apps/api/internal/modules/notification/service.go`

  ```go
  func (s *service) CreateLikeNotification(userID, actorID, postID string) error {
      // ... existing code ...
      
      payload := map[string]interface{}{
          "actorUsername": actorUsername,
          "actorImage": actorImage,
          "actionText": "liked your post",
          "postId": postID,
      }
      
      plaintext, _ := json.Marshal(payload)
      
      // ✅ ENCRYPT
      encrypted, _ := websocket.EncryptMessage(plaintext, encryptionKey)
      encryptedBytes, _ := json.Marshal(encrypted)
      
      msg := &websocket.MessagePayload{
          UserID: userID,
          Type: "NOTIFICATION",
          Payload: encryptedBytes, // ✅ Now encrypted!
      }
      _ = websocket.PublishToRedis(msg)
      
      return nil
  }
  ```

- [ ] **Update frontend to decrypt**
  - [ ] File: `fe/src/lib/websocket.ts`

  ```typescript
  function decryptMessage(encrypted: EncryptedPayload, key: Uint8Array): any {
      const iv = Buffer.from(encrypted.iv, 'base64');
      const ciphertext = Buffer.from(encrypted.ct, 'base64');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
      ]);
      
      return JSON.parse(decrypted.toString());
  }
  ```

- [ ] **Test WebSocket encryption**
  - [ ] [ ] Network traffic contains encrypted data
  - [ ] [ ] Plaintext notifications NOT visible
  - [ ] [ ] Client can decrypt properly

---

## 🟡 P2: NOTIFICATION NOT VALIDATED BEFORE CREATING

- [ ] **Add validation to all notification types**
  - [ ] Verify user exists
  - [ ] Verify post/comment exists
  - [ ] Verify relationship valid

- [ ] **Test notification validation**
  - [ ] [ ] Invalid userID → Rejected
  - [ ] [ ] Invalid postID → Rejected
  - [ ] [ ] Valid notification → Created

---

# 7. PRODUCT DIGITAL MODULE

## 🔴 P1: PRODUCT PURCHASE VERIFICATION MISSING

- [x] **Add purchase verification endpoint**
  - [x] File: `be/apps/api/internal/modules/monetization/repository.go`

  ```go
  type Repository interface {
      // ... existing methods ...
      VerifyProductPurchase(userID, postID string) (bool, error)
  }

  func (r *repository) VerifyProductPurchase(userID, postID string) (bool, error) {
      var count int64
      
      err := r.db.
          Table("product_purchases").
          Where("user_id = ? AND post_id = ?", userID, postID).
          Count(&count).Error
      
      return count > 0, err
  }
  ```

- [x] **Use in access control**
  - [x] File: `be/apps/api/internal/modules/monetization/handler.go`

  ```go
  func (h *Handler) GenerateProductAccessURL(c *gin.Context) {
      userID := c.GetString("userID")
      postID := c.Param("postId")
      
      // ✅ Verify purchase
      hasBought, err := h.service.VerifyProductPurchase(userID, postID)
      if err != nil || !hasBought {
          c.JSON(403, gin.H{"error": "not purchased"})
          return
      }
      
      // ... continue ...
  }
  ```

- [x] **Test purchase verification**
  - [x] [x] Non-buyer → 403
  - [x] [x] Buyer → 200
  - [x] [x] Author → 200

---

## 🔴 P1: NO PRODUCT WITHDRAWAL VALIDATION

- [x] **Add withdrawal validation**
  - [x] File: `be/apps/api/internal/modules/monetization/service.go`

  ```go
  func (s *service) WithdrawEarnings(userID string, req WithdrawalRequest) error {
      // ✅ 1. Verify address format
      if !isValidCryptoAddress(req.ToAddress, req.Currency) {
          return errors.New("invalid crypto address format")
      }
      
      // ✅ 2. Verify minimum withdrawal
      if req.AmountCents < 50000 { // $500 minimum
          return errors.New("minimum withdrawal is $500")
      }
      
      // ✅ 3. Verify user balance
      balance, err := s.repo.GetUserBalance(userID)
      if err != nil || balance < req.AmountCents {
          return errors.New("insufficient balance")
      }
      
      // ✅ 4. Check withdrawal history (prevent spam)
      lastWithdraw, _ := s.repo.GetLastWithdrawal(userID)
      if lastWithdraw != nil && time.Since(*lastWithdraw) < 24*time.Hour {
          return errors.New("can only withdraw once per 24 hours")
      }
      
      // ... continue ...
  }
  ```

- [x] **Add withdrawal limits**
  - [x] Min: $500
  - [x] Max: $100,000
  - [x] Once per 24 hours per user

- [x] **Test withdrawal validation**
  - [x] [x] Invalid address → Error
  - [x] [x] Below minimum ($1) → Error
  - [x] [x] Insufficient funds → Error
  - [x] [x] Valid withdrawal ($600) → Success
  - [x] [x] Plisio API down → Handled properly

---

## 🟡 P2: NO PRODUCT SALES AUDIT TRAIL

- [x] **Create audit table**
  - [x] File: `be/apps/api/internal/modules/monetization/model.go`

  ```go
  type ProductPurchaseAudit struct {
      ID            string `gorm:"type:uuid;primary_key"`
      PostID        string
      SellerID      string
      BuyerID       string
      Amount        int
      TransactionID string
      Status        string // "initiated", "completed", "refunded"
      CreatedAt     time.Time
      CompletedAt   *time.Time
  }
  ```

  - [ ] [ ] Audit entry created for each sale
  - [ ] [ ] Seller/buyer correctly recorded
  - [ ] [ ] Amount correct

---

# 8. FOLLOW & USER RELATIONSHIPS

## 🟡 P2: NO RATE LIMITING ON FOLLOW

- [x] **Add follow rate limiting**
  - [x] File: `be/apps/api/internal/middleware/ratelimit.go`

  ```go
  // Max 50 follows per hour per user
  router.POST("/users/:id/follow",
      middleware.RateLimitMiddleware(redisClient, 50, 1*time.Hour),
      controller.FollowUser,
  )
  ```

- [x] **Test follow rate limiting**
  - [x] [x] Normal follows → Allowed
  - [x] [x] Mass follow attempt → Limited

---

## 🔴 P1: NO UNFOLLOW PROTECTION

- [x] **Add unfollow authorization**
  - [x] Only user can unfollow themselves
  - [x] Verify relationship exists before deleting

- [x] **Test unfollow**
  - [x] [x] Can unfollow own follow
  - [x] [x] Cannot force-unfollow others

---

# 9. INFRASTRUCTURE & DEPLOYMENT

## 🔴 P1: ENVIRONMENT VARIABLES EXPOSED

- [ ] **Audit all .env files**
  - [ ] [ ] No secrets in `.env.example`
## 🟠 P2: NO HTTPS ENFORCEMENT

- [ ] **Add HSTS header**
  - [ ] File: `be/apps/api/cmd/server/main.go`

  ```go
  router.Use(func(c *gin.Context) {
      c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
      c.Next()
  })
  ```

- [ ] **Enforce HTTPS in frontend**
  - [ ] File: `fe/next.config.js`

  ```javascript
  module.exports = {
      async redirects() {
          return [
              {
                  source: '/:path*',
                  destination: 'https://example.com/:path*',
                  permanent: true,
              },
          ]
      },
  }
  ```

- [ ] **Test HTTPS**
  - [ ] [ ] HTTP redirects to HTTPS
  - [ ] [ ] HSTS header present
  - [ ] [ ] Certificate valid

---

## 🟡 P2: NO API RATE LIMITING GLOBALLY

- [ ] **Add global rate limiting**
  - [ ] File: `be/apps/api/cmd/server/main.go`

  ```go
  // Max 100 requests per minute per IP
  router.Use(middleware.GlobalRateLimitMiddleware(redisClient, 100, 1*time.Minute))
  ```

- [ ] **Different limits per endpoint**
  - [ ] [ ] Public endpoints: 100/min
  - [ ] [ ] Auth endpoints: 5/min
  - [ ] [ ] Payment endpoints: 10/min

- [ ] **Test rate limiting**
  - [ ] [ ] Normal traffic → Allowed
  - [ ] [ ] DDoS attempt → Blocked

---

## 🟡 P2: NO CORS CONFIGURATION

- [ ] **Configure CORS properly**
  - [ ] File: `be/apps/api/cmd/server/main.go`

  ```go
  router.Use(cors.New(cors.Config{
      AllowOrigins: []string{"https://example.com", "https://app.example.com"},
      AllowMethods: []string{"GET", "POST", "PUT", "DELETE"},
      AllowHeaders: []string{"Content-Type", "Authorization"},
      ExposeHeaders: []string{"Content-Length"},
      AllowCredentials: true,
      MaxAge: 12 * time.Hour,
  }))
  ```

- [ ] **Test CORS**
  - [ ] [ ] Allowed origin → OK
  - [ ] [ ] Disallowed origin → Rejected
  - [ ] [ ] Credentials handled

---

# 10. TESTING & VERIFICATION

## 🔴 P0: Security Testing Checklist

- [ ] **Authentication Tests**
  - [ ] [ ] No token → 401
  - [ ] [ ] Invalid token → 401
  - [ ] [ ] Expired token → 401
  - [ ] [ ] Valid token → 200

- [ ] **Authorization Tests**
  - [ ] [ ] Delete own post → 200
  - [ ] [ ] Delete other's post → 403
  - [ ] [ ] Delete own comment → 200
  - [ ] [ ] Delete other's comment → 403

- [ ] **Data Validation Tests**
  - [ ] [ ] Empty input → Rejected
  - [ ] [ ] XSS payload → Sanitized
  - [ ] [ ] SQL injection → Rejected
  - [ ] [ ] Type mismatch → Rejected

- [ ] **Rate Limiting Tests**
  - [ ] [ ] Normal rate → Allowed
  - [ ] [ ] Exceed rate → 429
  - [ ] [ ] After timeout → Allowed again

- [ ] **Payment Security Tests**
  - [ ] [ ] Invalid signature → Rejected
  - [ ] [ ] Replay attack → Rejected
  - [ ] [ ] Amount tampering → Rejected
  - [ ] [ ] Valid webhook → Accepted

---

## 🔴 P0: Vulnerability Scanning

- [ ] **Run security tools**
  ```bash
  # Go
  go fmt ./...
  go vet ./...
  golangci-lint run

  # TypeScript
  npm audit
  npm audit fix

  # Dependencies
  trivy scan --scanners vuln .
  ```

- [ ] **Manual security review**
  - [ ] [ ] Code review by senior dev
  - [ ] [ ] Peer review by 2+ people
  - [ ] [ ] Security audit checklist

- [ ] **Penetration testing**
  - [ ] [ ] OWASP Top 10 tested
  - [ ] [ ] API security tested
  - [ ] [ ] Authorization tested

---

## 🔴 P0: Deployment Checklist

- [ ] **Pre-deployment**
  - [ ] [ ] All tests passing
  - [ ] [ ] Code reviewed
  - [ ] [ ] Security scan clean
  - [ ] [ ] Database backed up

- [ ] **Deployment**
  - [ ] [ ] Blue-green deployment
  - [ ] [ ] Health checks passing
  - [ ] [ ] No errors in logs
  - [ ] [ ] Metrics normal

- [ ] **Post-deployment**
  - [ ] [ ] Monitor error rates
  - [ ] [ ] Monitor performance
  - [ ] [ ] Test all critical paths
  - [ ] [ ] Confirm fixes working

---

## 📊 PRIORITY LEVELS LEGEND

| Level | Timeframe | Description |
|-------|-----------|-------------|
| 🔴 P0/P1 | 24 hours | **CRITICAL** - Blocks production |
| 🟠 P2 | 48 hours | **HIGH** - Security/data risk |
| 🟡 P3 | 72 hours | **MEDIUM** - Quality improvement |
| 🟢 P4 | 1 week | **LOW** - Nice to have |

---

## 🎯 COMPLETION TRACKING

### Week 1 - Critical Fixes (24 hours)
- [ ] Product URL tokenization
- [ ] Like rate limiting
- [ ] Comment delete authorization
- [ ] Post visibility enforcement
- [ ] Payment webhook validation

**Status:** ⏳ NOT STARTED  
**Owner:** @security-team  
**ETA:** 2026-07-14

---

### Week 2 - High Priority (48-72 hours)
- [ ] JWT implementation
- [ ] CSRF protection
- [ ] Notification rate limiting
- [ ] WebSocket encryption
- [ ] Soft delete implementation

**Status:** ⏳ NOT STARTED  
**Owner:** @security-team  
**ETA:** 2026-07-15 to 2026-07-16

---

### Week 3 - Medium Priority (1 week)
- [ ] Global rate limiting
- [ ] HSTS headers
- [ ] CORS configuration
- [ ] Audit logging
- [ ] Security scanning tools

**Status:** ⏳ NOT STARTED  
**Owner:** @dev-team  
**ETA:** 2026-07-20

---

## 📞 ESCALATION

**Security Incident?** `security@example.com`  
**Need Help?** Ask in `#security-squad`  
**Report Bug?** Create issue with `security` label

---

## 📚 REFERENCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Go Security Guidelines](https://golang.org/doc/effective_go#security)
- [Next.js Security](https://nextjs.org/docs/going-to-production#security)

---

**Last Updated:** 2026-07-13  
**Next Review:** 2026-07-20  
**Maintained By:** @security-team
