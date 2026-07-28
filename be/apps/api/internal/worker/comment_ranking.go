package worker

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/hibiken/asynq"
	"gorm.io/gorm"
	
	"media-api/internal/pkg/ranking"
)

const (
	TypeUpdateCommentScore = "comment:update_score"
)

type UpdateCommentScorePayload struct {
	CommentID string `json:"comment_id"`
}

func NewUpdateCommentScoreTask(commentID string) (*asynq.Task, error) {
	payload, err := json.Marshal(UpdateCommentScorePayload{CommentID: commentID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeUpdateCommentScore, payload), nil
}

type UpdateCommentScoreTaskHandler struct {
	db *gorm.DB
}

func NewUpdateCommentScoreTaskHandler(db *gorm.DB) *UpdateCommentScoreTaskHandler {
	return &UpdateCommentScoreTaskHandler{db: db}
}

func (h *UpdateCommentScoreTaskHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload UpdateCommentScorePayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return err
	}

	var c struct {
		ID         string
		LikeCount  *int
		ReplyCount *int
		Content    string
		Pinned     bool
		CreatedAt  time.Time
	}
	if err := h.db.Table("comments").Where("id = ?", payload.CommentID).First(&c).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil // Comment might have been deleted
		}
		return err
	}

	likeCount := 0
	if c.LikeCount != nil {
		likeCount = *c.LikeCount
	}

	replyCount := 0
	if c.ReplyCount != nil {
		replyCount = *c.ReplyCount
	}

	hasImage := strings.Contains(c.Content, "<img") || strings.Contains(c.Content, "![]")
	hasMention := strings.Contains(c.Content, "@")

	rankingComment := ranking.Comment{
		LikeCount:     likeCount,
		ReplyCount:    replyCount,
		ReactionCount: 0, // Not implemented yet
		CreatedAt:     c.CreatedAt,
		Pinned:        c.Pinned,
		HasImage:      hasImage,
		HasMention:    hasMention,
		Content:       c.Content,
		AuthorKarma:   0, // Not implemented yet
	}

	newScore := ranking.Score(rankingComment)

	// Update score
	if err := h.db.Table("comments").Where("id = ?", c.ID).Update("score", newScore).Error; err != nil {
		log.Printf("Failed to update comment score for %s: %v", c.ID, err)
		return err
	}

	return nil
}
