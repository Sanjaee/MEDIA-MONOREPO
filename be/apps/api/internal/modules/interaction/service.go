package interaction

import (
	"context"
)

type Service interface {
	ToggleLike(ctx context.Context, userID, postID string) (bool, int, error)
	ToggleBookmark(ctx context.Context, userID, postID string) (bool, int, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) ToggleLike(ctx context.Context, userID, postID string) (bool, int, error) {
	return s.repo.ToggleLike(ctx, userID, postID)
}

func (s *service) ToggleBookmark(ctx context.Context, userID, postID string) (bool, int, error) {
	return s.repo.ToggleBookmark(ctx, userID, postID)
}
