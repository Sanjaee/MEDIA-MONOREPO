package post

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"net/http"
	"path/filepath"
	"bytes"
	"image"
	"image/jpeg"
	_ "image/png"
	_ "image/gif"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/nfnt/resize"
	"gorm.io/gorm"

	"media-api/internal/storage"
	"media-api/internal/websocket"
	"media-api/internal/pkg/trending"
)

func HandleMediaProcess(db *gorm.DB, hub *websocket.Hub, store storage.Storage) func(context.Context, *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		var payload struct {
			PostID    string   `json:"post_id"`
			TempFiles []string `json:"temp_files"`
		}

		if err := json.Unmarshal(t.Payload(), &payload); err != nil {
			return fmt.Errorf("json.Unmarshal failed: %v", err)
		}

		if store == nil {
			return fmt.Errorf("storage is not initialized")
		}

		var uploadedMedia []Media

		// Upload each file
		for i, tempFile := range payload.TempFiles {
			file, err := os.Open(tempFile)
			if err != nil {
				log.Printf("Failed to open %s: %v", tempFile, err)
				continue
			}

			// Detect content type
			buffer := make([]byte, 512)
			_, _ = file.Read(buffer)
			file.Seek(0, 0)
			contentType := http.DetectContentType(buffer)

			mediaType := "image"
			if strings.HasPrefix(contentType, "video") {
				mediaType = "video"
			}

			// Try to detect dimensions
			var width, height *int
			if mediaType == "image" {
				if cfg, _, err := image.DecodeConfig(file); err == nil {
					w := cfg.Width
					h := cfg.Height
					width = &w
					height = &h
				}
				file.Seek(0, 0)
			}

			// Generate a unique key for R2
			fileExt := filepath.Ext(tempFile)
			if fileExt == "" && mediaType == "image" {
				if strings.Contains(contentType, "jpeg") {
					fileExt = ".jpg"
				} else if strings.Contains(contentType, "png") {
					fileExt = ".png"
				} else if strings.Contains(contentType, "gif") {
					fileExt = ".gif"
				}
			} else if fileExt == "" && mediaType == "video" {
				fileExt = ".mp4"
			}
			
			mediaID := uuid.New().String()
			key := fmt.Sprintf("posts/%s%s", mediaID, fileExt)

			var fileBytes int
			isCompressed := false

			if mediaType == "image" {
				file.Seek(0, 0)
				if img, _, err := image.Decode(file); err == nil {
					img = resize.Thumbnail(1080, 1080, img, resize.Lanczos3)
					b := img.Bounds()
					w := b.Dx()
					h := b.Dy()
					width = &w
					height = &h

					var buf bytes.Buffer
					if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 82}); err == nil {
						contentType = "image/jpeg"
						fileExt = ".jpg"
						key = fmt.Sprintf("posts/%s%s", mediaID, fileExt)
						
						if err := store.Upload(key, bytes.NewReader(buf.Bytes()), contentType); err == nil {
							fileBytes = buf.Len()
							isCompressed = true
						}
					}
				}
			}

			if !isCompressed {
				file.Seek(0, 0)
				if err := store.Upload(key, file, contentType); err != nil {
					log.Printf("Failed to upload %s to R2: %v", tempFile, err)
					file.Close()
					continue
				}
				if stat, err := file.Stat(); err == nil {
					fileBytes = int(stat.Size())
				}
			}

			file.Close()
			os.Remove(tempFile)

			media := Media{
				ID:        mediaID,
				PostID:    payload.PostID,
				Type:      mediaType,
				URL:       store.GetURL(key),
				PublicID:  &key,
				SortOrder: func(i int) *int { return &i }(i),
				Width:     width,
				Height:    height,
				Bytes:     &fileBytes,
			}

			uploadedMedia = append(uploadedMedia, media)
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

		if len(uploadedMedia) > 0 {
			// Fetch post author to send notification
			var p Post
			if err := db.Preload("Author").First(&p, "id = ?", payload.PostID).Error; err == nil {
				if hub != nil {
					notificationPayload, _ := json.Marshal(map[string]interface{}{
						"actorUsername": "System",
						"actorImage":    nil,
						"actionText":    "Media Uploaded",
						"message":       "Your post is ready.",
						"postId":        p.ID,
						"type":          "SYSTEM",
					})
					hub.SendToUser <- &websocket.MessagePayload{
						UserID:  p.AuthorID,
						Type:    "NOTIFICATION",
						Payload: notificationPayload,
					}
					
					var actorImage *string
					if p.Author != nil {
						actorImage = p.Author.Image
					}
					var actorUsername string
					if p.Author != nil && p.Author.Username != nil {
						actorUsername = *p.Author.Username
					}
					
					broadcastPayload, _ := json.Marshal(map[string]interface{}{
						"actorUsername": actorUsername,
						"actorImage":    actorImage,
						"postId":        p.ID,
						"authorId":      p.AuthorID,
					})
					hub.SendToUser <- &websocket.MessagePayload{
						UserID:  "*",
						Type:    "NEW_POST",
						Payload: broadcastPayload,
					}
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

func HandleUpdateTrendingScore(db *gorm.DB) func(context.Context, *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		var payload struct {
			PostID string `json:"post_id"`
		}
		if err := json.Unmarshal(t.Payload(), &payload); err != nil {
			return fmt.Errorf("json.Unmarshal failed: %v", err)
		}

		var post Post
		if err := db.First(&post, "id = ?", payload.PostID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return fmt.Errorf("failed to get post: %v", err)
		}

		// Prepare data for algorithm
		tp := trending.Post{
			Likes:     getSafeInt(post.LikeCount),
			Comments:  getSafeInt(post.CommentCount),
			Reposts:   getSafeInt(post.RepostCount),
			Bookmarks: getSafeInt(post.BookmarkCount),
			Views:     getSafeInt(post.ViewCount),
			CreatedAt: post.CreatedAt,
		}

		score := trending.CalculateScore(tp)

		if err := db.Model(&Post{}).Where("id = ?", payload.PostID).Update("trending_score", score).Error; err != nil {
			return fmt.Errorf("failed to update trending_score: %v", err)
		}

		return nil
	}
}

func getSafeInt(val *int) int {
	if val == nil {
		return 0
	}
	return *val
}

