package post

import (
	"context"
	"errors"
	"fmt"
	"time"

	"media-api/internal/cache"
	"media-api/internal/queue"
	"github.com/hibiken/asynq"
	"encoding/json"
)

type Service interface {
	CreatePost(ctx context.Context, post *Post) error
	GetPostById(ctx context.Context, userID, id string) (*Post, error)
	UpdatePost(ctx context.Context, postID, userID string, content *string) error
	DeletePost(ctx context.Context, postID, userID string) error
	GetLatestFeed(ctx context.Context, userID string, cursor string, limit int) ([]Post, error)
	GetTrendingFeed(ctx context.Context, userID string, cursorScore float64, cursorID string, limit int) ([]Post, error)
}

type service struct {
	repository Repository
}

func NewService(repository Repository) *service {
	return &service{repository}
}

func (s *service) CreatePost(ctx context.Context, post *Post) error {
	err := s.repository.Create(post)
	if err != nil {
		return err
	}

	// Trigger background task using asynq (General Queue pattern)
	if queue.Client != nil {
		payload, _ := json.Marshal(map[string]string{"post_id": post.ID})
		task := asynq.NewTask("post:created", payload)
		// enqueue task
		queue.Client.Enqueue(task)
	}

	// Invalidate feed cache
	cache.DeletePattern(ctx, "feed:*")
	
	return nil
}

func (s *service) GetPostById(ctx context.Context, userID, id string) (*Post, error) {
	return s.repository.FindByID(userID, id)
}

func (s *service) UpdatePost(ctx context.Context, postID, userID string, content *string) error {
	post, err := s.repository.FindByID(userID, postID)
	if err != nil {
		return err
	}
	
	// Security: check if the user is the author
	if post.AuthorID != userID {
		return errors.New("unauthorized: you are not the author of this post")
	}
	
	post.Content = content
	err = s.repository.Update(post)
	if err == nil {
		cache.Delete(ctx, fmt.Sprintf("post:%s", postID))
	}
	return err
}

func (s *service) DeletePost(ctx context.Context, postID, userID string) error {
	post, err := s.repository.FindByID(userID, postID)
	if err != nil {
		return err
	}
	
	// Security: check if the user is the author
	if post.AuthorID != userID {
		return errors.New("unauthorized: you are not the author of this post")
	}
	
	err = s.repository.Delete(postID)
	if err == nil {
		cache.Delete(ctx, fmt.Sprintf("post:%s", postID))
		cache.DeletePattern(ctx, "feed:*")
	}
	return err
}

func (s *service) GetLatestFeed(ctx context.Context, userID string, cursor string, limit int) ([]Post, error) {
	cacheKey := fmt.Sprintf("feed:latest:u%s:c%s:l%d", userID, cursor, limit)
	var posts []Post

	// Try get from Redis
	err := cache.Get(ctx, cacheKey, &posts)
	if err == nil && len(posts) > 0 {
		return posts, nil
	}

	// Cache Miss, get from Repository
	posts, err = s.repository.GetLatestFeed(userID, cursor, limit)
	if err != nil {
		return nil, err
	}

	// Save to Redis (Cache TTL 1 minute for feeds)
	cache.Set(ctx, cacheKey, posts, 1*time.Minute)

	return posts, nil
}

func (s *service) GetTrendingFeed(ctx context.Context, userID string, cursorScore float64, cursorID string, limit int) ([]Post, error) {
	cacheKey := fmt.Sprintf("feed:trending:u%s:cs%f:ci%s:l%d", userID, cursorScore, cursorID, limit)
	var posts []Post

	err := cache.Get(ctx, cacheKey, &posts)
	if err == nil && len(posts) > 0 {
		return posts, nil
	}

	posts, err = s.repository.GetTrendingFeed(userID, cursorScore, cursorID, limit)
	if err != nil {
		return nil, err
	}

	cache.Set(ctx, cacheKey, posts, 3*time.Minute)

	return posts, nil
}
