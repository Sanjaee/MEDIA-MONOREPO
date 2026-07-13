package worker

import (
	"context"
	"log"
	"time"

	"gorm.io/gorm"
	"media-api/internal/modules/monetization"
)

func CleanupExpiredTransactions(ctx context.Context, db *gorm.DB) {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for {
			select {
			case <-ticker.C:
				now := time.Now()
				status := "failed"
				result := db.Model(&monetization.Transaction{}).
					Where("status = ? AND expires_at < ?", "pending", now).
					Updates(map[string]interface{}{
						"status":       status,
						"completed_at": now,
					})
				if result.Error != nil {
					log.Printf("Error cleaning up expired transactions: %v", result.Error)
				} else if result.RowsAffected > 0 {
					log.Printf("Cleaned up %d expired transactions", result.RowsAffected)
				}
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}
