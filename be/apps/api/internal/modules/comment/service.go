package comment

import (
	"context"
	"encoding/json"
	"errors"
	"log"

	"media-api/internal/queue"
	"media-api/internal/modules/notification"
	"media-api/internal/websocket"
	"media-api/internal/worker"

	"github.com/hibiken/asynq"
)

type Service interface {
	CreateComment(ctx context.Context, comment *Comment) error
	DeleteComment(ctx context.Context, id string, userID string) error
	GetCommentsByPostID(ctx context.Context, userID string, postID string, cursor string, limit int) ([]Comment, error)
	GetRepliesByCommentID(ctx context.Context, userID string, parentID string, cursor string, limit int) ([]Comment, error)
	PinComment(ctx context.Context, commentID string, userID string, pin bool) error
}

type service struct {
	repository Repository
	notifSv    notification.Service
	hub        *websocket.Hub
}

func NewService(repository Repository, notifSv notification.Service, hub *websocket.Hub) Service {
	return &service{repository, notifSv, hub}
}

func (s *service) CreateComment(ctx context.Context, comment *Comment) error {
	err := s.repository.Create(comment)
	if err != nil {
		return err
	}

	if comment.ParentCommentID != nil && *comment.ParentCommentID != "" {
		_ = s.repository.IncrementReplyCount(*comment.ParentCommentID, 1)
		
		// Send reply notification
		if s.notifSv != nil {
			if parentAuthorID, err := s.repository.GetCommentAuthorID(*comment.ParentCommentID); err == nil && parentAuthorID != "" {
				_ = s.notifSv.CreateCommentNotification(parentAuthorID, comment.AuthorID, comment.PostID, comment.Content)
			}
		}
	} else {
		// Send comment notification to post author
		if s.notifSv != nil {
			if postAuthorID, err := s.repository.GetPostAuthorID(comment.PostID); err == nil && postAuthorID != "" {
				_ = s.notifSv.CreateCommentNotification(postAuthorID, comment.AuthorID, comment.PostID, comment.Content)
			}
		}
	}

	if queue.Client != nil {
		payload, _ := json.Marshal(map[string]string{"post_id": comment.PostID})
		task := asynq.NewTask("post:update_comment_count", payload)
		_, err := queue.Client.Enqueue(task)
		if err != nil {
			log.Printf("Failed to enqueue task post:update_comment_count: %v", err)
		}
		
		task2 := asynq.NewTask("post:update_trending_score", payload)
		_, err2 := queue.Client.Enqueue(task2)
		if err2 != nil {
			log.Printf("Failed to enqueue task post:update_trending_score: %v", err2)
		}

		// Also initialize the comment score
		if workerTask, err := worker.NewUpdateCommentScoreTask(comment.ID); err == nil {
			queue.Client.Enqueue(workerTask)
		}
		
		// If it's a reply, update parent comment score
		if comment.ParentCommentID != nil && *comment.ParentCommentID != "" {
			if parentTask, err := worker.NewUpdateCommentScoreTask(*comment.ParentCommentID); err == nil {
				queue.Client.Enqueue(parentTask)
			}
		}
	}

	if s.hub != nil {
		count, err := s.repository.GetPostCommentCount(comment.PostID)
		if err == nil {
			broadcastPayload, _ := json.Marshal(map[string]interface{}{
				"postId":       comment.PostID,
				"commentCount": count,
			})
			s.hub.SendToUser <- &websocket.MessagePayload{
				UserID:  "*",
				Type:    "COMMENT_UPDATE",
				Payload: broadcastPayload,
			}
		}
	}

	return nil
}

func (s *service) DeleteComment(ctx context.Context, id string, userID string) error {
	comment, err := s.repository.FindByID(id)
	if err != nil {
		return err
	}
	
	if comment.AuthorID != userID {
		return errors.New("unauthorized: you can only delete your own comments")
	}

	err = s.repository.Delete(id, userID)
	if err != nil {
		return err
	}

	if comment.ParentCommentID != nil && *comment.ParentCommentID != "" {
		_ = s.repository.IncrementReplyCount(*comment.ParentCommentID, -1)
	}

	if queue.Client != nil {
		payload, _ := json.Marshal(map[string]string{"post_id": comment.PostID})
		task := asynq.NewTask("post:update_comment_count", payload)
		_, _ = queue.Client.Enqueue(task)
		
		task2 := asynq.NewTask("post:update_trending_score", payload)
		_, _ = queue.Client.Enqueue(task2)
	}

	if s.hub != nil {
		count, err := s.repository.GetPostCommentCount(comment.PostID)
		if err == nil {
			broadcastPayload, _ := json.Marshal(map[string]interface{}{
				"postId":       comment.PostID,
				"commentCount": count,
			})
			s.hub.SendToUser <- &websocket.MessagePayload{
				UserID:  "*",
				Type:    "COMMENT_UPDATE",
				Payload: broadcastPayload,
			}
		}
	}

	return nil
}

func (s *service) GetCommentsByPostID(ctx context.Context, userID string, postID string, cursor string, limit int) ([]Comment, error) {
	return s.repository.GetCommentsByPostID(userID, postID, cursor, limit)
}

func (s *service) GetRepliesByCommentID(ctx context.Context, userID string, parentID string, cursor string, limit int) ([]Comment, error) {
	return s.repository.GetRepliesByCommentID(userID, parentID, cursor, limit)
}

func (s *service) PinComment(ctx context.Context, commentID string, userID string, pin bool) error {
	comment, err := s.repository.FindByID(commentID)
	if err != nil {
		return err
	}

	postAuthorID, err := s.repository.GetPostAuthorID(comment.PostID)
	if err != nil {
		return err
	}

	if postAuthorID != userID {
		return errors.New("unauthorized: only the post owner can pin comments")
	}

	if err := s.repository.PinComment(commentID, comment.PostID, pin); err != nil {
		return err
	}

	if queue.Client != nil {
		if workerTask, err := worker.NewUpdateCommentScoreTask(commentID); err == nil {
			queue.Client.Enqueue(workerTask)
		}
	}

	return nil
}
