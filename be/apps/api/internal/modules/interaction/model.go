package interaction

import (
	"time"
)

type Comment struct {
	ID              string    `gorm:"primaryKey;type:varchar"`
	PostID          string    `gorm:"type:varchar;not null"`
	AuthorID        string    `gorm:"type:varchar;not null"`
	ParentCommentID *string   `gorm:"type:varchar"`
	Content         string    `gorm:"type:text;not null"`
	LikeCount       *int      `gorm:"type:integer;default:0"`
	ReplyCount      *int      `gorm:"type:integer;default:0"`
	CreatedAt       time.Time `gorm:"autoCreateTime;type:timestamp"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime;type:timestamp"`
}

type Like struct {
	ID        string    `gorm:"primaryKey;type:varchar"`
	UserID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_user_post_like"`
	PostID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_user_post_like"`
	CreatedAt time.Time `gorm:"autoCreateTime;type:timestamp"`
}

type Bookmark struct {
	ID        string    `gorm:"primaryKey;type:varchar"`
	UserID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_user_post_bookmark"`
	PostID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_user_post_bookmark"`
	CreatedAt time.Time `gorm:"autoCreateTime;type:timestamp"`
}
