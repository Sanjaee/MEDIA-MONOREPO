package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"media-api/internal/modules/auth"
)

func RequireAuth(authService auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := ExtractUserID(c, authService)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Set("userID", userID)
		c.Next()
	}
}

func OptionalAuth(authService auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := ExtractUserID(c, authService)
		if userID != "" {
			c.Set("userID", userID)
		}
		c.Next()
	}
}

func ExtractUserID(c *gin.Context, authService auth.Service) string {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || len(authHeader) <= 7 || authHeader[:7] != "Bearer " {
		return ""
	}
	tokenString := authHeader[7:]
	claims, err := authService.ValidateToken(tokenString)
	if err != nil {
		return ""
	}
	return claims.Subject
}

func AdapterAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := c.GetHeader("X-Adapter-Secret")
		if secret == "" || secret != os.Getenv("NEXTAUTH_SECRET") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Not Next.js Adapter"})
			c.Abort()
			return
		}
		c.Next()
	}
}
