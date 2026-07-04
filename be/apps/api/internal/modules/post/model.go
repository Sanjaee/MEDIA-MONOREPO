package post

import (
	"time"
)

type Post struct {
	ID             string    `gorm:"primaryKey;type:varchar"`
	AuthorID       string    `gorm:"type:varchar;not null"`
	Content        *string   `gorm:"type:text"`
	Visibility     *string   `gorm:"type:varchar;default:'public'"`
	ReplyToPostID  *string   `gorm:"type:varchar"`
	RepostOfPostID *string   `gorm:"type:varchar"`
	LikeCount      *int      `gorm:"type:integer;default:0"`
	CommentCount   *int      `gorm:"type:integer;default:0"`
	RepostCount    *int      `gorm:"type:integer;default:0"`
	BookmarkCount  *int      `gorm:"type:integer;default:0"`
	ViewCount      *int      `gorm:"type:integer;default:0"`
	CreatedAt      time.Time `gorm:"autoCreateTime;type:timestamp"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime;type:timestamp"`
}

type Media struct {
	ID           string    `gorm:"primaryKey;type:varchar"`
	PostID       string    `gorm:"type:varchar;not null"`
	Type         string    `gorm:"type:varchar;not null"`
	URL          string    `gorm:"type:text;not null"`
	PublicID     *string   `gorm:"type:varchar"`
	ThumbnailURL *string   `gorm:"type:text"`
	AltText      *string   `gorm:"type:text"`
	Width        *int      `gorm:"type:integer"`
	Height       *int      `gorm:"type:integer"`
	Duration     *int      `gorm:"type:integer"`
	Bytes        *int      `gorm:"type:integer"`
	Format       *string   `gorm:"type:varchar"`
	SortOrder    *int      `gorm:"type:integer;default:0"`
	CreatedAt    time.Time `gorm:"autoCreateTime;type:timestamp"`
}

type PostView struct {
	ID        string    `gorm:"primaryKey;type:varchar"`
	PostID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_post_user_view"`
	UserID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_post_user_view"`
	CreatedAt time.Time `gorm:"autoCreateTime;type:timestamp"`
}
