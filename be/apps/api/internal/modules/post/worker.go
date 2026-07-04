package post

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/hibiken/asynq"
	"gorm.io/gorm"
)

// HandleUpdateCommentCount is a worker task that recalcuates the comment count for a post
func HandleUpdateCommentCount(db *gorm.DB) func(context.Context, *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		var p map[string]string
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
		}

		postID, ok := p["post_id"]
		if !ok || postID == "" {
			return fmt.Errorf("post_id is missing or empty: %w", asynq.SkipRetry)
		}

		// Recalculate comment count
		var count int64
		err := db.Table("comments").Where("post_id = ? AND parent_comment_id IS NULL", postID).Count(&count).Error
		if err != nil {
			return fmt.Errorf("failed to count comments: %v", err)
		}

		// Update post
		err = db.Model(&Post{}).Where("id = ?", postID).Update("comment_count", count).Error
		if err != nil {
			return fmt.Errorf("failed to update post comment_count: %v", err)
		}

		log.Printf("Successfully updated comment count for post %s to %d", postID, count)
		return nil
	}
}
