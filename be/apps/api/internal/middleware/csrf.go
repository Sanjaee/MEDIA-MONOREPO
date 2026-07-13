package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func CSRFMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only check non-GET requests
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodOptions && c.Request.Method != http.MethodHead {
			csrfToken := c.GetHeader("X-CSRF-Token")
			
			if csrfToken == "" {
				c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token missing"})
				c.Abort()
				return
			}
			
			cookie, err := c.Cookie("csrf_token")
			if err != nil || cookie == "" {
				c.JSON(http.StatusForbidden, gin.H{"error": "CSRF cookie missing"})
				c.Abort()
				return
			}
			
			if csrfToken != cookie {
				c.JSON(http.StatusForbidden, gin.H{"error": "Invalid CSRF token"})
				c.Abort()
				return
			}
		}
		
		c.Next()
	}
}
