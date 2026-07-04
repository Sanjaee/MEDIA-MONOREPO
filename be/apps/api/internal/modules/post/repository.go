package post

import (
	"time"
	"gorm.io/gorm"
)

type Repository interface {
	FindAll() ([]Post, error)
	FindByID(userID, id string) (*Post, error)
	Create(post *Post) error
	Update(post *Post) error
	Delete(id string) error

	// Feed methods
	GetLatestFeed(userID string, cursor string, limit int) ([]Post, error)
	GetTrendingFeed(userID string, cursorScore float64, cursorID string, limit int) ([]Post, error)
	GetHotFeed(userID string, cursorScore float64, cursorID string, limit int) ([]Post, error)
	GetMediaFeed(userID string, cursor string, limit int) ([]Post, error)
	GetSearchFeed(userID string, keyword string, cursor string, limit int) ([]Post, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *repository {
	return &repository{db}
}

func (r *repository) FindAll() ([]Post, error) {
	var posts []Post
	err := r.db.Preload("Author").Preload("Media").Find(&posts).Error
	return posts, err
}

func (r *repository) FindByID(userID, id string) (*Post, error) {
	var post Post
	query := r.db.Preload("Author").Preload("Media")

	if userID != "" {
		query = query.Select("posts.*, EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) as has_liked, EXISTS(SELECT 1 FROM bookmarks WHERE bookmarks.post_id = posts.id AND bookmarks.user_id = ?) as has_bookmarked", userID, userID)
	}

	err := query.Where("id = ?", id).First(&post).Error
	if err != nil {
		return nil, err
	}
	return &post, nil
}

func (r *repository) Create(post *Post) error {
	return r.db.Create(post).Error
}

func (r *repository) Update(post *Post) error {
	return r.db.Save(post).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&Post{}).Error
}

func (r *repository) GetLatestFeed(userID string, cursor string, limit int) ([]Post, error) {
	var posts []Post
	query := r.db.Preload("Author").Preload("Media").Order("created_at DESC, id DESC").Limit(limit + 1)
	
	if userID != "" {
		query = query.Select("posts.*, EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) as has_liked, EXISTS(SELECT 1 FROM bookmarks WHERE bookmarks.post_id = posts.id AND bookmarks.user_id = ?) as has_bookmarked", userID, userID)
	}

	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("created_at < ?", cursorTime)
		}
	}
	
	err := query.Find(&posts).Error
	return posts, err
}

func (r *repository) GetTrendingFeed(userID string, cursorScore float64, cursorID string, limit int) ([]Post, error) {
	var posts []Post
	
	// Simplified formula for Trending: likeCount*1 + commentCount*3 + repostCount*4 + bookmarkCount*5
	scoreExpr := "(like_count * 1 + comment_count * 3 + repost_count * 4 + bookmark_count * 5 + view_count * 0.05)"
	
	query := r.db.Preload("Author").Preload("Media").
		Where("(like_count > 0 OR comment_count > 0 OR repost_count > 0 OR bookmark_count > 0)").
		Order("score DESC, id DESC").
		Limit(limit + 1)

	if userID != "" {
		query = query.Select("posts.*, " + scoreExpr + " as score, EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) as has_liked, EXISTS(SELECT 1 FROM bookmarks WHERE bookmarks.post_id = posts.id AND bookmarks.user_id = ?) as has_bookmarked", userID, userID)
	} else {
		query = query.Select("posts.*, " + scoreExpr + " as score")
	}

	if cursorID != "" {
		query = query.Where("("+scoreExpr+" < ?) OR ("+scoreExpr+" = ? AND id < ?)", cursorScore, cursorScore, cursorID)
	}

	err := query.Find(&posts).Error
	return posts, err
}

func (r *repository) GetHotFeed(userID string, cursorScore float64, cursorID string, limit int) ([]Post, error) {
	// Simplified Hot Feed: similar to Trending but decays with time.
	// For simplicity in GORM, we reuse the pattern.
	var posts []Post
	query := r.db.Preload("Author").Preload("Media").Order("created_at DESC").Limit(limit + 1)

	if userID != "" {
		query = query.Select("posts.*, EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) as has_liked, EXISTS(SELECT 1 FROM bookmarks WHERE bookmarks.post_id = posts.id AND bookmarks.user_id = ?) as has_bookmarked", userID, userID)
	}

	err := query.Find(&posts).Error
	return posts, err
}

func (r *repository) GetMediaFeed(userID string, cursor string, limit int) ([]Post, error) {
	var posts []Post
	query := r.db.Preload("Author").Preload("Media").
		Joins("JOIN media on media.post_id = posts.id").
		Group("posts.id").
		Order("posts.created_at DESC, posts.id DESC").
		Limit(limit + 1)

	if userID != "" {
		query = query.Select("posts.*, EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) as has_liked, EXISTS(SELECT 1 FROM bookmarks WHERE bookmarks.post_id = posts.id AND bookmarks.user_id = ?) as has_bookmarked", userID, userID)
	}

	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("posts.created_at < ?", cursorTime)
		}
	}

	err := query.Find(&posts).Error
	return posts, err
}

func (r *repository) GetSearchFeed(userID string, keyword string, cursor string, limit int) ([]Post, error) {
	var posts []Post
	query := r.db.Preload("Author").Preload("Media").
		Joins("LEFT JOIN users on users.id = posts.author_id").
		Where("posts.content ILIKE ? OR users.name ILIKE ? OR users.username ILIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%").
		Order("posts.created_at DESC, posts.id DESC").
		Limit(limit + 1)

	if userID != "" {
		query = query.Select("posts.*, EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) as has_liked, EXISTS(SELECT 1 FROM bookmarks WHERE bookmarks.post_id = posts.id AND bookmarks.user_id = ?) as has_bookmarked", userID, userID)
	}

	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("posts.created_at < ?", cursorTime)
		}
	}

	err := query.Find(&posts).Error
	return posts, err
}
