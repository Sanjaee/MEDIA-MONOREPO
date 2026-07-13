package comment

import (
	"time"
	"gorm.io/gorm"
	"media-api/internal/modules/user"
)

type Comment struct {
	ID              string     `gorm:"primaryKey;type:varchar" json:"id"`
	PostID          string     `gorm:"type:varchar;not null;index" json:"postId"`
	ParentCommentID *string    `gorm:"type:varchar;index" json:"parentCommentId"`
	AuthorID        string     `gorm:"type:varchar;not null" json:"authorId"`
	Author          *user.User `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Content         string     `gorm:"type:text;not null" json:"content"`
	LikeCount       *int       `gorm:"type:integer;default:0" json:"likeCount"`
	ReplyCount      *int       `gorm:"type:integer;default:0" json:"replyCount"`
	CreatedAt       time.Time      `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
	UpdatedAt       time.Time      `gorm:"autoUpdateTime;type:timestamp" json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`
	DeletedBy       *string        `gorm:"type:varchar" json:"deletedBy,omitempty"`
	DeleteReason    *string        `gorm:"type:varchar" json:"deleteReason,omitempty"`
}
