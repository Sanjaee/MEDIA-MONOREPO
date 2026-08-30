package social

import (
	"time"

	"media-api/internal/modules/post"
	"media-api/internal/modules/user"
)

type Friend struct {
	ID        string    `gorm:"primaryKey;type:varchar" json:"id"`
	UserID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_friend_pair" json:"userId"`
	FriendID  string    `gorm:"type:varchar;not null;uniqueIndex:idx_friend_pair" json:"friendId"`
	Status    string    `gorm:"type:varchar;default:'pending'" json:"status"` // pending | accepted
	CreatedAt time.Time `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;type:timestamp" json:"updatedAt"`
}

type Block struct {
	ID        string    `gorm:"primaryKey;type:varchar" json:"id"`
	BlockerID string    `gorm:"type:varchar;not null;uniqueIndex:idx_blocker_blocked" json:"blockerId"`
	BlockedID string    `gorm:"type:varchar;not null;uniqueIndex:idx_blocker_blocked" json:"blockedId"`
	CreatedAt time.Time `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
}

type Report struct {
	ID          string     `gorm:"primaryKey;type:varchar" json:"id"`
	ReporterID  string     `gorm:"type:varchar;not null;uniqueIndex:idx_reporter_post" json:"reporterId"`
	PostID      string     `gorm:"type:varchar;not null;uniqueIndex:idx_reporter_post" json:"postId"`
	Reason      string     `gorm:"type:varchar;not null" json:"reason"`
	Description *string    `gorm:"type:text" json:"description,omitempty"`
	Status      string     `gorm:"type:varchar;default:'open'" json:"status"` // open | resolved | dismissed
	AdminNote   *string    `gorm:"type:text" json:"adminNote,omitempty"`
	ResolvedBy  *string    `gorm:"type:varchar" json:"resolvedBy,omitempty"`
	ResolvedAt  *time.Time `gorm:"type:timestamp" json:"resolvedAt,omitempty"`
	CreatedAt   time.Time  `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"autoUpdateTime;type:timestamp" json:"updatedAt"`

	Reporter user.User `gorm:"foreignKey:ReporterID" json:"reporter"`
	Post     post.Post `gorm:"foreignKey:PostID" json:"post"`
}