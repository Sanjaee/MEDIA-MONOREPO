package post

import (
	"gorm.io/gorm"
)

type Repository interface {
	FindAll() ([]Post, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *repository {
	return &repository{db}
}

func (r *repository) FindAll() ([]Post, error) {
	var posts []Post
	err := r.db.Find(&posts).Error
	if err != nil {
		return posts, err
	}
	return posts, nil
}
