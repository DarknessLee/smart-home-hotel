package service

import (
	"sort"
	"strings"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
)

// ListInvoices 发票 / 对账列表（GET /invoices，分页）。
func (s *Service) ListInvoices(status, keyword, pageText, pageSizeText string) model.InvoiceListResult {
	status = strings.TrimSpace(status)
	keyword = strings.ToLower(strings.TrimSpace(keyword))

	filtered := make([]model.Invoice, 0, len(s.store.Invoices()))
	for _, invoice := range s.store.Invoices() {
		if status != "" && invoice.Status != status {
			continue
		}
		if keyword != "" {
			text := strings.ToLower(invoice.OrderNo + " " + invoice.GuestName + " " + invoice.RoomNo)
			if !strings.Contains(text, keyword) {
				continue
			}
		}
		filtered = append(filtered, invoice)
	}
	sort.SliceStable(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt > filtered[j].CreatedAt
	})

	page := parsePositiveInt(pageText, 1)
	pageSize := parsePositiveInt(pageSizeText, 10)
	start := (page - 1) * pageSize
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + pageSize
	if end > len(filtered) {
		end = len(filtered)
	}
	return model.InvoiceListResult{
		List:     filtered[start:end],
		Total:    len(filtered),
		Page:     page,
		PageSize: pageSize,
	}
}

// IssueInvoice 开具发票：pending → issued；重复开具返回 9001。
func (s *Service) IssueInvoice(id string) (*model.Invoice, error) {
	invoice, found := s.store.InvoiceByID(id)
	if !found {
		return nil, apperr.New(404, "发票不存在")
	}
	if invoice.Status == model.InvoiceIssued {
		return nil, apperr.New(9001, "该发票已开具")
	}
	invoice.Status = model.InvoiceIssued
	invoice.IssuedAt = nowDateTime()
	s.store.SaveInvoice(invoice)
	return &invoice, nil
}
