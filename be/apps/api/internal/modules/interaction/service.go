package interaction

import (
	"context"

	"media-api/internal/modules/notification"
)

type Service interface {
	ToggleLike(ctx context.Context, userID, postID string) (bool, int, error)
	ToggleBookmark(ctx context.Context, userID, postID string) (bool, int, error)
}

type service struct {
	repo    Repository
	notifSv notification.Service
}

func NewService(repo Repository, notifSv notification.Service) Service {
	return &service{repo: repo, notifSv: notifSv}
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

	return liked, count, nil
}

func (s *service) ToggleBookmark(ctx context.Context, userID, postID string) (bool, int, error) {
	return s.repo.ToggleBookmark(ctx, userID, postID)
}
