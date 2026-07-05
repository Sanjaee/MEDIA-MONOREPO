package post

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"gorm.io/gorm"

	"media-api/internal/websocket"
)

func HandleMediaProcess(db *gorm.DB, hub *websocket.Hub, cld *cloudinary.Cloudinary) func(context.Context, *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		var payload struct {
			PostID    string   `json:"post_id"`
			TempFiles []string `json:"temp_files"`
		}

		if err := json.Unmarshal(t.Payload(), &payload); err != nil {
			return fmt.Errorf("json.Unmarshal failed: %v", err)
		}

		if cld == nil {
			return fmt.Errorf("cloudinary is not initialized")
		}

		var uploadedMedia []Media

		// Upload each file
		for i, tempFile := range payload.TempFiles {
			resp, err := cld.Upload.Upload(ctx, tempFile, uploader.UploadParams{
				Folder:       "media_app_posts",
				ResourceType: "auto",
			})

			if err != nil {
				log.Printf("Failed to upload %s: %v", tempFile, err)
				continue
			}

			mediaType := "image"
			if strings.HasPrefix(resp.ResourceType, "video") {
				mediaType = "video"
			}

			media := Media{
				ID:        uuid.New().String(),
				PostID:    payload.PostID,
				Type:      mediaType,
				URL:       resp.SecureURL,
				PublicID:  &resp.PublicID,
				Format:    &resp.Format,
				Bytes:     &resp.Bytes,
				SortOrder: func(i int) *int { return &i }(i),
			}

			if resp.Width > 0 {
				media.Width = &resp.Width
			}
			if resp.Height > 0 {
				media.Height = &resp.Height
			}

			uploadedMedia = append(uploadedMedia, media)

			// Clean up temp file
			os.Remove(tempFile)
		}

		if len(uploadedMedia) > 0 {
			// Save media to database
			if err := db.Create(&uploadedMedia).Error; err != nil {
				log.Printf("Failed to save media records for post %s: %v", payload.PostID, err)
				return err
			}
		}

		// Update post visibility to public
		if err := db.Model(&Post{}).Where("id = ?", payload.PostID).Update("visibility", "public").Error; err != nil {
			log.Printf("Failed to update post visibility for post %s: %v", payload.PostID, err)
		}

		// Fetch post author to send notification
		var p Post
		if err := db.First(&p, "id = ?", payload.PostID).Error; err == nil {
			if hub != nil {
				notificationPayload, _ := json.Marshal(map[string]interface{}{
					"title":   "Post Uploaded",
					"message": "Your post media has finished uploading!",
					"postId":  p.ID,
				})
				hub.SendToUser <- &websocket.MessagePayload{
					UserID:  p.AuthorID,
					Type:    "NOTIFICATION",
					Payload: notificationPayload,
				}
			}
		}

		return nil
	}
}

func HandleUpdateCommentCount(db *gorm.DB) func(context.Context, *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		var payload struct {
			PostID string `json:"post_id"`
		}
		if err := json.Unmarshal(t.Payload(), &payload); err != nil {
			return fmt.Errorf("json.Unmarshal failed: %v", err)
		}

		// Count all comments for this post
		var count int64
		if err := db.Table("comments").Where("post_id = ?", payload.PostID).Count(&count).Error; err != nil {
			return fmt.Errorf("failed to count comments: %v", err)
		}

		// Update the post's comment_count
		if err := db.Model(&Post{}).Where("id = ?", payload.PostID).Update("comment_count", count).Error; err != nil {
			return fmt.Errorf("failed to update comment_count: %v", err)
		}

		return nil
	}
}
