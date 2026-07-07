package notification

import (
	"encoding/json"

	"media-api/internal/websocket"
	"github.com/google/uuid"
)

type Service interface {
	CreateLikeNotification(userID, actorID, postID string) error
	CreateCommentNotification(userID, actorID, postID, commentText string) error
	GetNotificationsByUserID(userID string, limit, offset int) ([]Notification, error)
	MarkAsRead(notificationID string, userID string) error
	MarkAllAsRead(userID string) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) CreateLikeNotification(userID, actorID, postID string) error {
	// Don't notify if the user likes their own post
	if userID == actorID {
		return nil
	}

	nType := "LIKE"
	isRead := false
	n := &Notification{
		ID:       uuid.New().String(),
		UserID:   userID,
		ActorID:  actorID,
		Type:     &nType,
		EntityID: &postID,
		IsRead:   &isRead,
	}

	err := s.repo.CreateOrUpdateNotification(n)
	if err != nil {
		return err
	}

	// Push via websocket
	payload := map[string]interface{}{
		"title":   "New Like",
		"message": "Someone liked your post",
		"postId":  postID,
	}
	payloadBytes, _ := json.Marshal(payload)
	
	msg := &websocket.MessagePayload{
		UserID:  userID,
		Type:    "NOTIFICATION",
		Payload: payloadBytes,
	}
	_ = websocket.PublishToRedis(msg)

	return nil
}

func (s *service) CreateCommentNotification(userID, actorID, postID, commentText string) error {
	// Don't notify if the user comments on their own post
	if userID == actorID {
		return nil
	}

	nType := "COMMENT"
	isRead := false
	n := &Notification{
		ID:       uuid.New().String(),
		UserID:   userID,
		ActorID:  actorID,
		Type:     &nType,
		EntityID: &postID,
		Message:  &commentText,
		IsRead:   &isRead,
	}

	err := s.repo.CreateOrUpdateNotification(n)
	if err != nil {
		return err
	}

	// Push via websocket
	payload := map[string]interface{}{
		"title":   "New Comment",
		"message": commentText,
		"postId":  postID,
	}
	payloadBytes, _ := json.Marshal(payload)
	
	msg := &websocket.MessagePayload{
		UserID:  userID,
		Type:    "NOTIFICATION",
		Payload: payloadBytes,
	}
	_ = websocket.PublishToRedis(msg)

	return nil
}

func (s *service) GetNotificationsByUserID(userID string, limit, offset int) ([]Notification, error) {
	return s.repo.GetNotificationsByUserID(userID, limit, offset)
}

func (s *service) MarkAsRead(notificationID string, userID string) error {
	return s.repo.MarkAsRead(notificationID, userID)
}

func (s *service) MarkAllAsRead(userID string) error {
	return s.repo.MarkAllAsRead(userID)
}
