package comment

import (
	"time"

	"gorm.io/gorm"
)

type Repository interface {
	Create(comment *Comment) error
	Delete(id string, userID string) error
	FindByID(id string) (*Comment, error)
	GetCommentsByPostID(userID string, postID string, cursor string, limit int) ([]Comment, error)
	GetRepliesByCommentID(userID string, parentID string, cursor string, limit int) ([]Comment, error)
	IncrementReplyCount(parentID string, step int) error
	GetPostAuthorID(postID string) (string, error)
	GetCommentAuthorID(commentID string) (string, error)
	GetPostCommentCount(postID string) (int64, error)
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

func (r *repository) Delete(id string, userID string) error {
	// Ensure we set the custom fields. gorm.DeletedAt will be populated automatically by Delete,
	// but we need to supply DeletedBy and DeleteReason first.
	return r.db.Model(&Comment{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"deleted_by": userID,
			"delete_reason": "user_deleted",
		}).Delete(&Comment{}).Error
}

func (r *repository) FindByID(id string) (*Comment, error) {
	var comment Comment
	err := r.db.Preload("Author").Where("id = ?", id).First(&comment).Error
	if err != nil {
		return nil, err
	}
	return &comment, nil
}

func (r *repository) GetCommentsByPostID(userID string, postID string, cursor string, limit int) ([]Comment, error) {
	var comments []Comment

	query := r.db.Preload("Author").
		Where("post_id = ? AND parent_comment_id IS NULL", postID).
		Order("created_at DESC, id DESC").
		Limit(limit + 1)

	if userID != "" {
		query = query.Select("comments.*, EXISTS(SELECT 1 FROM comment_likes WHERE comment_likes.comment_id = comments.id AND comment_likes.user_id = ?) as has_liked", userID)
	} else {
		query = query.Select("comments.*")
	}

	if cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
		if err == nil {
			query = query.Where("created_at < ?", cursorTime)
		}
	}

	err := query.Find(&comments).Error
	return comments, err
}

func (r *repository) GetRepliesByCommentID(userID string, parentID string, cursor string, limit int) ([]Comment, error) {
	var comments []Comment

	query := r.db.Preload("Author").
		Where("parent_comment_id = ?", parentID).
		Order("created_at DESC, id DESC").
		Limit(limit + 1)

	if userID != "" {
		query = query.Select("comments.*, EXISTS(SELECT 1 FROM comment_likes WHERE comment_likes.comment_id = comments.id AND comment_likes.user_id = ?) as has_liked", userID)
	} else {
		query = query.Select("comments.*")
	}

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

func (r *repository) GetPostAuthorID(postID string) (string, error) {
	var authorID string
	err := r.db.Table("posts").Select("author_id").Where("id = ?", postID).Scan(&authorID).Error
	return authorID, err
}

func (r *repository) GetCommentAuthorID(commentID string) (string, error) {
	var authorID string
	err := r.db.Table("comments").Select("author_id").Where("id = ?", commentID).Scan(&authorID).Error
	return authorID, err
}

func (r *repository) GetPostCommentCount(postID string) (int64, error) {
	var count int64
	err := r.db.Model(&Comment{}).Where("post_id = ? AND parent_comment_id IS NULL AND deleted_at IS NULL", postID).Count(&count).Error
	return count, err
}
