		package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"media-api/internal/cache"
	"media-api/internal/websocket"
)

type Service interface {
	CreateLikeNotification(userID, actorID, postID string) error
	CreateCommentNotification(userID, actorID, postID, commentText string) error
	CreateRoleUpgradeNotification(userID, roleName string) error
	CreateAdPaymentSuccessNotification(userID string) error
	CreateProductSaleNotification(userID, actorID, postID string, amount int) error
	CreateProductPaymentSuccessNotification(userID string, postID string) error
	CreatePaymentPendingNotification(userID string) error
	GetNotificationsByUserID(userID string, limit, offset int) ([]Notification, error)
	MarkAsRead(notificationID string, userID string) error
	MarkAllAsRead(userID string) error
	DeleteNotification(notificationID string, userID string) error
	DeleteAllNotifications(userID string) error
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

	if err := checkNotificationRateLimit(userID, actorID, "LIKE"); err != nil {
		return err
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

	actorDetails, _ := s.repo.GetActorDetails(actorID)
	actorUsername := "System"
	var actorImage interface{} = nil

	if actorDetails != nil {
		if username, ok := actorDetails["username"].(string); ok && username != "" {
			actorUsername = username
		}
		actorImage = actorDetails["image"]
	}

	// Push via websocket
	payload := map[string]interface{}{
		"actorUsername": actorUsername,
		"actorImage":    actorImage,
		"actionText":    "liked your post",
		"message":       "",
		"postId":        postID,
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

	if err := checkNotificationRateLimit(userID, actorID, "COMMENT"); err != nil {
		return err
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

	actorDetails, _ := s.repo.GetActorDetails(actorID)
	actorUsername := "System"
	var actorImage interface{} = nil

	if actorDetails != nil {
		if username, ok := actorDetails["username"].(string); ok && username != "" {
			actorUsername = username
		}
		actorImage = actorDetails["image"]
	}

	// Push via websocket
	payload := map[string]interface{}{
		"actorUsername": actorUsername,
		"actorImage":    actorImage,
		"actionText":    "commented",
		"message":       commentText,
		"postId":        postID,
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

func (s *service) CreateRoleUpgradeNotification(userID, roleName string) error {
	nType := "SYSTEM"
	isRead := false
	message := "Congratulations! Your role has been upgraded to " + roleName
	n := &Notification{
		ID:       uuid.New().String(),
		UserID:   userID,
		ActorID:  userID, // System or self
		Type:     &nType,
		Message:  &message,
		IsRead:   &isRead,
	}

	err := s.repo.CreateOrUpdateNotification(n)
	if err != nil {
		return err
	}

	// Push via websocket
	payload := map[string]interface{}{
		"actorUsername": "System",
		"actorImage":    nil,
		"actionText":    "Payment Successful",
		"message":       message,
		"postId":        "",
	}
	payloadBytes, _ := json.Marshal(payload)
	
	msgWs := &websocket.MessagePayload{
		UserID:  userID,
		Type:    "NOTIFICATION",
		Payload: payloadBytes,
	}
	_ = websocket.PublishToRedis(msgWs)

	// Also push a generic Role Upgraded one just in case the UI needs it for other components
	payloadRole := map[string]interface{}{
		"actorUsername": "System",
		"actorImage":    nil,
		"actionText":    "Role Upgraded",
		"message":       message,
		"postId":        "",
	}
	payloadRoleBytes, _ := json.Marshal(payloadRole)
	msgRoleWs := &websocket.MessagePayload{
		UserID:  userID,
		Type:    "NOTIFICATION",
		Payload: payloadRoleBytes,
	}
	_ = websocket.PublishToRedis(msgRoleWs)

	return nil
}

func (s *service) CreateAdPaymentSuccessNotification(userID string) error {
	nType := "SYSTEM"
	isRead := false
	message := "Your Premium Ad Slot payment was successful! You can now set up your ad."
	n := &Notification{
		ID:       uuid.New().String(),
		UserID:   userID,
		ActorID:  userID, // System or self
		Type:     &nType,
		Message:  &message,
		IsRead:   &isRead,
	}

	err := s.repo.CreateOrUpdateNotification(n)
	if err != nil {
		return err
	}

	// Push via websocket
	payload := map[string]interface{}{
		"actorUsername": "System",
		"actorImage":    nil,
		"actionText":    "Payment Successful",
		"message":       message,
		"postId":        "",
	}
	payloadBytes, _ := json.Marshal(payload)
	
	msgWs := &websocket.MessagePayload{
		UserID:  userID,
		Type:    "NOTIFICATION",
		Payload: payloadBytes,
	}
	_ = websocket.PublishToRedis(msgWs)

	return nil
}

func (s *service) CreatePaymentPendingNotification(userID string) error {
	payload := map[string]interface{}{
		"actorUsername": "System",
		"actorImage":    nil,
		"actionText":    "Payment Pending",
		"message":       "Your payment is pending confirmation.",
		"postId":        "",
	}
	payloadBytes, _ := json.Marshal(payload)
	
	msgWs := &websocket.MessagePayload{
		UserID:  userID,
		Type:    "NOTIFICATION",
		Payload: payloadBytes,
	}
	_ = websocket.PublishToRedis(msgWs)
	return nil
}

func (s *service) CreateProductSaleNotification(userID, actorID, postID string, amount int) error {
	if userID == actorID {
		return nil
	}

	if err := checkNotificationRateLimit(userID, actorID, "PRODUCT_SALE"); err != nil {
		return err
	}

	nType := "PRODUCT_SALE"
	isRead := false
	
	actorDetails, _ := s.repo.GetActorDetails(actorID)
	actorUsername := "System"
	var actorImage interface{} = nil

	if actorDetails != nil {
		if username, ok := actorDetails["username"].(string); ok && username != "" {
			actorUsername = username
		}
		actorImage = actorDetails["image"]
	}
	
	message := actorUsername + " purchased your product!"
	n := &Notification{
		ID:       uuid.New().String(),
		UserID:   userID,
		ActorID:  actorID,
		Type:     &nType,
		EntityID: &postID,
		Message:  &message,
		IsRead:   &isRead,
	}

	err := s.repo.CreateOrUpdateNotification(n)
	if err != nil {
		return err
	}



	payload := map[string]interface{}{
		"id":            n.ID,
		"type":          nType,
		"actorId":       actorID,
		"entityId":      postID,
		"postId":        postID, // Add postId for the frontend redirect
		"message":       message,
		"actionText":    "purchased your product!", // Add actionText
		"actorUsername": actorUsername, // Add actorUsername
		"actorImage":    actorImage,
		"isRead":        false,
		"createdAt":     n.CreatedAt,
		"amount":        amount,
	}

	payloadBytes, _ := json.Marshal(payload)
	msgWs := &websocket.MessagePayload{
		UserID:  userID,
		Type:    "NOTIFICATION",
		Payload: payloadBytes,
	}
	_ = websocket.PublishToRedis(msgWs)

	return nil
}

func (s *service) CreateProductPaymentSuccessNotification(userID string, postID string) error {
	nType := "SYSTEM"
	isRead := false
	message := "Your payment for a Digital Product was successful! You can now access it."
	n := &Notification{
		ID:       uuid.New().String(),
		UserID:   userID,
		ActorID:  userID, // System or self
		EntityID: &postID,
		Type:     &nType,
		Message:  &message,
		IsRead:   &isRead,
	}

	err := s.repo.CreateOrUpdateNotification(n)
	if err != nil {
		return err
	}

	// Push via websocket
	payload := map[string]interface{}{
		"actorUsername": "System",
		"actorImage":    nil,
		"actionText":    "Payment Successful",
		"message":       message,
		"postId":        postID,
	}
	payloadBytes, _ := json.Marshal(payload)
	
	msgWs := &websocket.MessagePayload{
		UserID:  userID,
		Type:    "NOTIFICATION",
		Payload: payloadBytes,
	}
	_ = websocket.PublishToRedis(msgWs)

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

func (s *service) DeleteNotification(notificationID string, userID string) error {
	return s.repo.DeleteNotification(notificationID, userID)
}

func (s *service) DeleteAllNotifications(userID string) error {
	return s.repo.DeleteAllNotifications(userID)
}

func checkNotificationRateLimit(userID, actorID, notifType string) error {
	ctx := context.Background()
	
	// Max 5 notifications per actor per hour to the same user
	hourKey := fmt.Sprintf("notif_count:%s:%s", userID, actorID)
	
	// 5-minute deduplication for identical action types
	recentKey := fmt.Sprintf("recent_notif:%s:%s:%s", userID, actorID, notifType)

	if cache.RDB != nil {
		// Check deduplication
		exists, _ := cache.RDB.Exists(ctx, recentKey).Result()
		if exists > 0 {
			return errors.New("silently_dropped_duplicate")
		}

		// Check rate limit
		count, _ := cache.RDB.Incr(ctx, hourKey).Result()
		if count == 1 {
			cache.RDB.Expire(ctx, hourKey, 1*time.Hour)
		}

		if count > 5 {
			return errors.New("notification rate limit exceeded")
		}

		// Set deduplication lock
		cache.RDB.Set(ctx, recentKey, true, 5*time.Minute)
	}

	return nil
}
