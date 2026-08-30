package social

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"media-api/internal/modules/post"
	"media-api/internal/modules/user"
)

type Service interface {
	ToggleFriend(ctx context.Context, userID, otherID string) (string, bool, error)
	GetSocialStatus(ctx context.Context, userID, otherID string) (string, bool, bool, error)
	BlockUser(ctx context.Context, blockerID, blockedID string) error
	UnblockUser(ctx context.Context, blockerID, blockedID string) error
	ReportPost(ctx context.Context, reporterID, postID, reason, description string) error
	ListReports(ctx context.Context, adminID, status string, limit, offset int) ([]Report, error)
	UpdateReportStatus(ctx context.Context, adminID, reportID, status, adminNote string) error
}

type service struct {
	repo Repository
	db   *gorm.DB
}

func NewService(repo Repository, db *gorm.DB) Service {
	return &service{repo: repo, db: db}
}

func (s *service) ToggleFriend(ctx context.Context, userID, otherID string) (string, bool, error) {
	if userID == otherID {
		return "", false, errors.New("cannot friend yourself")
	}
	_, _, isBlocked, err := s.repo.GetSocialStatus(ctx, userID, otherID)
	if err != nil {
		return "", false, err
	}
	if isBlocked {
		return "", false, errors.New("cannot interact with this user")
	}
	return s.repo.ToggleFriend(ctx, userID, otherID)
}

func (s *service) GetSocialStatus(ctx context.Context, userID, otherID string) (string, bool, bool, error) {
	if userID == "" || userID == otherID {
		return "none", false, false, nil
	}
	return s.repo.GetSocialStatus(ctx, userID, otherID)
}

func (s *service) BlockUser(ctx context.Context, blockerID, blockedID string) error {
	if blockerID == blockedID {
		return errors.New("cannot block yourself")
	}
	return s.repo.BlockUser(blockerID, blockedID)
}

func (s *service) UnblockUser(ctx context.Context, blockerID, blockedID string) error {
	return s.repo.UnblockUser(blockerID, blockedID)
}

func (s *service) ReportPost(ctx context.Context, reporterID, postID, reason, description string) error {
	if reporterID == "" {
		return errors.New("unauthorized")
	}

	var target post.Post
	if err := s.db.WithContext(ctx).Where("id = ?", postID).First(&target).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("post not found")
		}
		return err
	}
	if target.AuthorID == reporterID {
		return errors.New("cannot report your own post")
	}

	return s.repo.CreateReport(&Report{
		ID:          uuid.New().String(),
		ReporterID:  reporterID,
		PostID:      postID,
		Reason:      reason,
		Description: &description,
		Status:      "open",
	})
}

func (s *service) ListReports(ctx context.Context, adminID, status string, limit, offset int) ([]Report, error) {
	if _, err := s.checkAdmin(ctx, adminID); err != nil {
		return nil, err
	}
	return s.repo.ListReports(status, limit, offset)
}

func (s *service) UpdateReportStatus(ctx context.Context, adminID, reportID, status, adminNote string) error {
	if _, err := s.checkAdmin(ctx, adminID); err != nil {
		return err
	}
	if status != "open" && status != "resolved" && status != "dismissed" {
		return errors.New("invalid status")
	}
	return s.repo.UpdateReportStatus(reportID, status, adminNote, adminID)
}

func (s *service) checkAdmin(ctx context.Context, adminID string) (*user.User, error) {
	if adminID == "" {
		return nil, errors.New("unauthorized")
	}
	var admin user.User
	if err := s.db.WithContext(ctx).Where("id = ?", adminID).First(&admin).Error; err != nil {
		return nil, errors.New("admin user not found")
	}
	if admin.Role == nil || *admin.Role != "owner" {
		return nil, errors.New("forbidden: owner access required")
	}
	return &admin, nil
}