package social

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository interface {
	ToggleFriend(ctx context.Context, userID, otherID string) (string, bool, error)
	GetSocialStatus(ctx context.Context, userID, otherID string) (string, bool, bool, error)
	BlockUser(blockerID, blockedID string) error
	UnblockUser(blockerID, blockedID string) error
	CreateReport(report *Report) error
	ListReports(status string, limit, offset int) ([]Report, error)
	UpdateReportStatus(reportID, status, adminNote, resolverID string) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// ToggleFriend cycles through: none -> pending (request sent) -> accepted (request from them accepted) -> none (unfriend).
func (r *repository) ToggleFriend(ctx context.Context, userID, otherID string) (string, bool, error) {
	var newStatus string
	var isFriend bool

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Accepted pair exists in either direction -> unfriend
		var acceptedCount int64
		if err := tx.Model(&Friend{}).
			Where("status = ? AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))", "accepted", userID, otherID, otherID, userID).
			Count(&acceptedCount).Error; err != nil {
			return err
		}
		if acceptedCount > 0 {
			if err := tx.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", userID, otherID, otherID, userID).Delete(&Friend{}).Error; err != nil {
				return err
			}
			newStatus = "none"
			isFriend = false
			return nil
		}

		// I already sent a request -> cancel it
		var myRequest Friend
		if err := tx.Where("user_id = ? AND friend_id = ?", userID, otherID).First(&myRequest).Error; err == nil {
			if err := tx.Delete(&myRequest).Error; err != nil {
				return err
			}
			newStatus = "none"
			isFriend = false
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		// They sent me a request -> accept it
		var theirRequest Friend
		if err := tx.Where("user_id = ? AND friend_id = ?", otherID, userID).First(&theirRequest).Error; err == nil {
			if err := tx.Model(&theirRequest).Update("status", "accepted").Error; err != nil {
				return err
			}
			if err := tx.Create(&Friend{
				ID:       uuid.New().String(),
				UserID:   userID,
				FriendID: otherID,
				Status:   "accepted",
			}).Error; err != nil {
				return err
			}
			newStatus = "accepted"
			isFriend = true
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		// Otherwise send a new friend request
		if err := tx.Create(&Friend{
			ID:       uuid.New().String(),
			UserID:   userID,
			FriendID: otherID,
			Status:   "pending",
		}).Error; err != nil {
			return err
		}
		newStatus = "pending"
		isFriend = false
		return nil
	})

	return newStatus, isFriend, err
}

func (r *repository) GetSocialStatus(ctx context.Context, userID, otherID string) (string, bool, bool, error) {
	var status string
	var isFriend, isBlocked bool

	var acceptedCount int64
	if err := r.db.WithContext(ctx).Model(&Friend{}).
		Where("status = ? AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))", "accepted", userID, otherID, otherID, userID).
		Count(&acceptedCount).Error; err != nil {
		return status, isFriend, isBlocked, err
	}
	if acceptedCount > 0 {
		status = "accepted"
		isFriend = true
	} else {
		var pendingCount int64
		if err := r.db.WithContext(ctx).Model(&Friend{}).Where("user_id = ? AND friend_id = ?", userID, otherID).Count(&pendingCount).Error; err != nil {
			return status, isFriend, isBlocked, err
		}
		if pendingCount > 0 {
			status = "pending"
		}
	}

	var blockCount int64
	if err := r.db.WithContext(ctx).Model(&Block{}).
		Where("(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", userID, otherID, otherID, userID).
		Count(&blockCount).Error; err != nil {
		return status, isFriend, isBlocked, err
	}
	isBlocked = blockCount > 0

	return status, isFriend, isBlocked, nil
}

func (r *repository) BlockUser(blockerID, blockedID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Block{
			ID:        uuid.New().String(),
			BlockerID: blockerID,
			BlockedID: blockedID,
		}).Error; err != nil {
			return err
		}
		// Remove any friendship relationship in both directions
		return tx.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", blockerID, blockedID, blockedID, blockerID).Delete(&Friend{}).Error
	})
}

func (r *repository) UnblockUser(blockerID, blockedID string) error {
	return r.db.Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).Delete(&Block{}).Error
}

func (r *repository) CreateReport(report *Report) error {
	return r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(report).Error
}

func (r *repository) ListReports(status string, limit, offset int) ([]Report, error) {
	var reports []Report
	query := r.db.Preload("Reporter").Preload("Post.Author").Order("created_at DESC")
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if limit > 0 {
		query = query.Limit(limit).Offset(offset)
	}
	err := query.Find(&reports).Error
	return reports, err
}

func (r *repository) UpdateReportStatus(reportID, status, adminNote, resolverID string) error {
	updates := map[string]interface{}{
		"status":     status,
		"admin_note": adminNote,
		"resolved_by": resolverID,
	}
	if status == "open" {
		updates["resolved_by"] = nil
		updates["resolved_at"] = nil
	} else {
		updates["resolved_at"] = time.Now()
	}
	return r.db.Model(&Report{}).Where("id = ?", reportID).Updates(updates).Error
}