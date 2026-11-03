package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// ListInvoices 发票 / 对账列表（GET /invoices）。
func (h *Handler) ListInvoices(c *gin.Context) {
	result := h.svc.ListInvoices(
		c.Query("status"),
		c.Query("keyword"),
		c.Query("page"),
		c.Query("page_size"),
	)
	response.Success(c, result)
}

// IssueInvoice 开具发票（POST /invoices/:id/issue）。
func (h *Handler) IssueInvoice(c *gin.Context) {
	result, err := h.svc.IssueInvoice(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}
