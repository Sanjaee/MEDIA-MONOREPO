package post

import (
	"time"
	"gorm.io/gorm"
)

type Repository interface {
	FindAll() ([]Post, error)
	FindByID(id string) (*Post, error)
	Create(post *Post) error
	Update(post *Post) error
	Delete(id string) error

	// Feed methods
	GetLatestFeed(cursor string, limit int) ([]Post, error)
	GetTrendingFeed(cursorScore float64, cursorID string, limit int) ([]Post, error)
	GetHotFeed(cursorScore float64, cursorID string, limit int) ([]Post, error)
	GetMediaFeed(cursor string, limit int) ([]Post, error)
	GetSearchFeed(keyword string, cursor string, limit int) ([]Post, error)
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

func (r *repository) FindByID(id string) (*Post, error) {
	var post Post
	err := r.db.Preload("Author").Preload("Media").Where("id = ?", id).First(&post).Error
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

func (r *repository) GetLatestFeed(cursor string, limit int) ([]Post, error) {
	var posts []Post
	query := r.db.Preload("Author").Preload("Media").Order("created_at DESC, id DESC").Limit(limit + 1)
	
	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("created_at < ?", cursorTime)
		}
	}
	
	err := query.Find(&posts).Error
	return posts, err
}

func (r *repository) GetTrendingFeed(cursorScore float64, cursorID string, limit int) ([]Post, error) {
	var posts []Post
	
	// Simplified formula for Trending: likeCount*1 + commentCount*3 + repostCount*4 + bookmarkCount*5
	scoreExpr := "(like_count * 1 + comment_count * 3 + repost_count * 4 + bookmark_count * 5 + view_count * 0.05)"
	
	query := r.db.Preload("Author").Preload("Media").
		Select("*, " + scoreExpr + " as score").
		Where("(like_count > 0 OR comment_count > 0 OR repost_count > 0 OR bookmark_count > 0)").
		Order("score DESC, id DESC").
		Limit(limit + 1)

	if cursorID != "" {
		query = query.Where("("+scoreExpr+" < ?) OR ("+scoreExpr+" = ? AND id < ?)", cursorScore, cursorScore, cursorID)
	}

	err := query.Find(&posts).Error
	return posts, err
}

func (r *repository) GetHotFeed(cursorScore float64, cursorID string, limit int) ([]Post, error) {
	// Simplified Hot Feed: similar to Trending but decays with time.
	// For simplicity in GORM, we reuse the pattern.
	var posts []Post
	err := r.db.Preload("Author").Preload("Media").Order("created_at DESC").Limit(limit + 1).Find(&posts).Error
	return posts, err
}

func (r *repository) GetMediaFeed(cursor string, limit int) ([]Post, error) {
	var posts []Post
	query := r.db.Preload("Author").Preload("Media").
		Joins("JOIN media on media.post_id = posts.id").
		Group("posts.id").
		Order("posts.created_at DESC, posts.id DESC").
		Limit(limit + 1)

	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("posts.created_at < ?", cursorTime)
		}
	}

	err := query.Find(&posts).Error
	return posts, err
}

func (r *repository) GetSearchFeed(keyword string, cursor string, limit int) ([]Post, error) {
	var posts []Post
	query := r.db.Preload("Author").Preload("Media").
		Joins("LEFT JOIN users on users.id = posts.author_id").
		Where("posts.content ILIKE ? OR users.name ILIKE ? OR users.username ILIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%").
		Order("posts.created_at DESC, posts.id DESC").
		Limit(limit + 1)

	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("posts.created_at < ?", cursorTime)
		}
	}

	err := query.Find(&posts).Error
	return posts, err
}
