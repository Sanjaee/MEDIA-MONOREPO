package interaction

import (
	"context"
	"encoding/json"
	"log"

	"media-api/internal/modules/notification"
	"media-api/internal/queue"
	"media-api/internal/websocket"

	"github.com/hibiken/asynq"
)

type Service interface {
	ToggleLike(ctx context.Context, userID, postID string) (bool, int, error)
	ToggleBookmark(ctx context.Context, userID, postID string) (bool, int, error)
}

type service struct {
	repo    Repository
	notifSv notification.Service
	hub     *websocket.Hub
}

func NewService(repo Repository, notifSv notification.Service, hub *websocket.Hub) Service {
	return &service{repo: repo, notifSv: notifSv, hub: hub}
}

func (s *service) ToggleLike(ctx context.Context, userID, postID string) (bool, int, error) {
	liked, count, postOwnerID, err := s.repo.ToggleLike(ctx, userID, postID)
	if err != nil {
		return liked, count, err
	}

	// Trigger like notification if it was just liked (not unliked)
	if liked && s.notifSv != nil && postOwnerID != "" {
		_ = s.notifSv.CreateLikeNotification(postOwnerID, userID, postID)
	}

	if s.hub != nil {
		broadcastPayload, _ := json.Marshal(map[string]interface{}{
			"postId":    postID,
			"userId":    userID,
			"isLiked":   liked,
			"likeCount": count,
		})
		s.hub.SendToUser <- &websocket.MessagePayload{
			UserID:  "*",
			Type:    "LIKE_UPDATE",
			Payload: broadcastPayload,
		}
	}

	payload, _ := json.Marshal(map[string]interface{}{"post_id": postID})
	if queue.Client != nil {
		_, err = queue.Client.Enqueue(asynq.NewTask("post:update_trending_score", payload))
		if err != nil {
			log.Printf("Failed to enqueue trending score update: %v", err)
		}
	}

	return liked, count, nil
}

func (s *service) ToggleBookmark(ctx context.Context, userID, postID string) (bool, int, error) {
	bookmarked, count, err := s.repo.ToggleBookmark(ctx, userID, postID)
	if err == nil {
		payload, _ := json.Marshal(map[string]interface{}{"post_id": postID})
		if queue.Client != nil {
			_, errQueue := queue.Client.Enqueue(asynq.NewTask("post:update_trending_score", payload))
			if errQueue != nil {
				log.Printf("Failed to enqueue trending score update: %v", errQueue)
			}
		}
	}
	return bookmarked, count, err
}
