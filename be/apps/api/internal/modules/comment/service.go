package comment

import (
	"context"
	"encoding/json"
	"errors"

	"media-api/internal/queue"
	"media-api/internal/modules/notification"

	"github.com/hibiken/asynq"
)

type Service interface {
	CreateComment(ctx context.Context, comment *Comment) error
	DeleteComment(ctx context.Context, id string, userID string) error
	GetCommentsByPostID(ctx context.Context, postID string, cursor string, limit int) ([]Comment, error)
	GetRepliesByCommentID(ctx context.Context, parentID string, cursor string, limit int) ([]Comment, error)
}

type service struct {
	repository Repository
	notifSv    notification.Service
}

func NewService(repository Repository, notifSv notification.Service) *service {
	return &service{repository, notifSv}
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
		_, _ = queue.Client.Enqueue(task)
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
	}

	return nil
}

func (s *service) GetCommentsByPostID(ctx context.Context, postID string, cursor string, limit int) ([]Comment, error) {
	return s.repository.GetCommentsByPostID(postID, cursor, limit)
}

func (s *service) GetRepliesByCommentID(ctx context.Context, parentID string, cursor string, limit int) ([]Comment, error) {
	return s.repository.GetRepliesByCommentID(parentID, cursor, limit)
}
