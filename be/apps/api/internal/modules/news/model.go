package news

import (
	"time"
)

type News struct {
	ID             string    `gorm:"primaryKey;type:varchar"`
	CustomUsername string    `gorm:"type:varchar;not null"`
	CustomRole     *string   `gorm:"type:varchar"`
	Content        *string   `gorm:"type:text"`
	CreatedAt      time.Time `gorm:"autoCreateTime;type:timestamp"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime;type:timestamp"`
}

type NewsMedia struct {
	ID           string    `gorm:"primaryKey;type:varchar"`
	NewsID       string    `gorm:"type:varchar;not null"`
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
