package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func RateLimitMiddleware(rdb *redis.Client, maxRequests int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userID string
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			userID = authHeader[7:]
		} else if xUserId := c.GetHeader("X-User-Id"); xUserId != "" {
			userID = xUserId
		}

		if userID == "" {
			// If not authenticated, limit by IP
			userID = c.ClientIP()
		}

		key := fmt.Sprintf("rate_limit:%s:%s", c.FullPath(), userID)

		if rdb != nil {
			count, err := rdb.Incr(context.Background(), key).Result()
			if err == nil {
				if count == 1 {
					rdb.Expire(context.Background(), key, window)
				}
				if count > int64(maxRequests) {
					c.JSON(http.StatusTooManyRequests, gin.H{
						"error":      "rate limit exceeded",
						"retryAfter": window.Seconds(),
					})
					c.Abort()
					return
				}
			}
		}
		c.Next()
	}
}
