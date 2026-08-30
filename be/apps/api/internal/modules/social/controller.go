package social

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Controller struct {
	service Service
}

func NewController(service Service) *Controller {
	return &Controller{service: service}
}

func (c *Controller) getAuthUser(ctx *gin.Context) (string, bool) {
	userID := ctx.GetString("userID")
	if userID == "" {
		userID = ctx.GetHeader("X-User-Id")
	}
	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	return userID, true
}

// ToggleFriend handles POST /api/users/:id/friend
func (c *Controller) ToggleFriend(ctx *gin.Context) {
	userID, ok := c.getAuthUser(ctx)
	if !ok {
		return
	}
	targetID := ctx.Param("id")
	if targetID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "target user id is required"})
		return
	}

	status, isFriend, err := c.service.ToggleFriend(ctx.Request.Context(), userID, targetID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": status, "isFriend": isFriend})
}

// GetSocialStatus handles GET /api/users/:id/social
func (c *Controller) GetSocialStatus(ctx *gin.Context) {
	userID := ctx.GetString("userID")
	if userID == "" {
		userID = ctx.GetHeader("X-User-Id")
	}
	targetID := ctx.Param("id")
	if targetID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "target user id is required"})
		return
	}

	status, isFriend, isBlocked, err := c.service.GetSocialStatus(ctx.Request.Context(), userID, targetID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"friendStatus": status,
		"isFriend":     isFriend,
		"isBlocked":    isBlocked,
	})
}

// BlockUser handles POST /api/users/:id/block
func (c *Controller) BlockUser(ctx *gin.Context) {
	userID, ok := c.getAuthUser(ctx)
	if !ok {
		return
	}
	targetID := ctx.Param("id")
	if targetID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "target user id is required"})
		return
	}

	if err := c.service.BlockUser(ctx.Request.Context(), userID, targetID); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true, "isBlocked": true})
}

// UnblockUser handles DELETE /api/users/:id/block
func (c *Controller) UnblockUser(ctx *gin.Context) {
	userID, ok := c.getAuthUser(ctx)
	if !ok {
		return
	}
	targetID := ctx.Param("id")
	if targetID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "target user id is required"})
		return
	}

	if err := c.service.UnblockUser(ctx.Request.Context(), userID, targetID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true, "isBlocked": false})
}

type ReportRequest struct {
	Reason      string `json:"reason" binding:"required"`
	Description string `json:"description"`
}

// ReportPost handles POST /api/posts/:id/report
func (c *Controller) ReportPost(ctx *gin.Context) {
	userID, ok := c.getAuthUser(ctx)
	if !ok {
		return
	}
	postID := ctx.Param("id")
	if postID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "post id is required"})
		return
	}

	var req ReportRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := c.service.ReportPost(ctx.Request.Context(), userID, postID, req.Reason, req.Description); err != nil {
		if err.Error() == "post not found" {
			ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true})
}

// ListReports handles GET /api/admin/reports
func (c *Controller) ListReports(ctx *gin.Context) {
	adminID, ok := c.getAuthUser(ctx)
	if !ok {
		return
	}

	status := ctx.Query("status")
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(ctx.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	reports, err := c.service.ListReports(ctx.Request.Context(), adminID, status, limit, offset)
	if err != nil {
		if err.Error() == "forbidden: owner access required" || err.Error() == "admin user not found" || err.Error() == "unauthorized" {
			ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		} else {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch reports"})
		}
		return
	}

	ctx.JSON(http.StatusOK, reports)
}

type UpdateReportStatusRequest struct {
	Status    string `json:"status" binding:"required"`
	AdminNote string `json:"admin_note"`
}

// UpdateReportStatus handles POST /api/admin/reports/:id/status
func (c *Controller) UpdateReportStatus(ctx *gin.Context) {
	adminID, ok := c.getAuthUser(ctx)
	if !ok {
		return
	}
	reportID := ctx.Param("id")
	if reportID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "report id is required"})
		return
	}

	var req UpdateReportStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := c.service.UpdateReportStatus(ctx.Request.Context(), adminID, reportID, req.Status, req.AdminNote); err != nil {
		if err.Error() == "forbidden: owner access required" || err.Error() == "admin user not found" || err.Error() == "unauthorized" {
			ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		} else {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true})
}