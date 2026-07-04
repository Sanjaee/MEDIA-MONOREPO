package interaction

import (
	"time"
)

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
