package comment

import (
	"time"

	"gorm.io/gorm"
)

type Repository interface {
	Create(comment *Comment) error
	Delete(id string) error
	FindByID(id string) (*Comment, error)
	GetCommentsByPostID(postID string, cursor string, limit int) ([]Comment, error)
	GetRepliesByCommentID(parentID string, cursor string, limit int) ([]Comment, error)
	IncrementReplyCount(parentID string, step int) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *repository {
	return &repository{db}
}

func (r *repository) Create(comment *Comment) error {
	return r.db.Create(comment).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Delete(&Comment{}, "id = ?", id).Error
}

func (r *repository) FindByID(id string) (*Comment, error) {
	var comment Comment
	err := r.db.Preload("Author").Where("id = ?", id).First(&comment).Error
	if err != nil {
		return nil, err
	}
	return &comment, nil
}

func (r *repository) GetCommentsByPostID(postID string, cursor string, limit int) ([]Comment, error) {
	var comments []Comment

	query := r.db.Preload("Author").
		Where("post_id = ? AND parent_comment_id IS NULL", postID).
		Order("created_at DESC, id DESC").
		Limit(limit + 1)

	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("created_at < ?", cursorTime)
		}
	}

	err := query.Find(&comments).Error
	return comments, err
}

func (r *repository) GetRepliesByCommentID(parentID string, cursor string, limit int) ([]Comment, error) {
	var comments []Comment

	query := r.db.Preload("Author").
		Where("parent_comment_id = ?", parentID).
		Order("created_at DESC, id DESC").
		Limit(limit + 1)

	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("created_at < ?", cursorTime)
		}
	}

	err := query.Find(&comments).Error
	return comments, err
}

func (r *repository) IncrementReplyCount(parentID string, step int) error {
	return r.db.Model(&Comment{}).Where("id = ?", parentID).Update("reply_count", gorm.Expr("reply_count + ?", step)).Error
}
