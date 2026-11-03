package service

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
)

var (
	phonePattern    = regexp.MustCompile(`^1[3-9]\d{9}$`)
	realNamePattern = regexp.MustCompile(`^[\p{Han}·]{2,15}$`)
	idCardPattern   = regexp.MustCompile(`^\d{17}[\dX]$`)
)

// issueToken 生成 Mock token：mock-token-<userId>（与前端 Mock 完全一致）。
func issueToken(userID string) string {
	return "mock-token-" + userID
}

// LoginResult 登录 / 员工登录响应 data。
type LoginResult struct {
	Token string     `json:"token"`
	User  model.User `json:"user"`
}

// Login 顾客登录：任意 11 位手机号 + 固定验证码 1234。
// 手机号不存在时自动注册为未实名顾客（与前端 Mock 行为一致）。
func (s *Service) Login(phone, code string) (*LoginResult, error) {
	phone = strings.TrimSpace(phone)
	code = strings.TrimSpace(code)
	if !phonePattern.MatchString(phone) {
		return nil, apperr.New(1001, "请输入正确的手机号")
	}
	if code != "1234" {
		return nil, apperr.New(1002, "验证码错误，Mock 阶段请输入 1234")
	}

	user, found := s.store.UserByPhone(phone)
	if !found {
		user = model.User{
			ID:        fmt.Sprintf("U%d", time.Now().UnixMilli()),
			Phone:     phone,
			Status:    model.UserStatusUnverified,
			Role:      model.RoleCustomer,
			CreatedAt: nowDateTime(),
		}
		s.store.AddUser(user)
	}
	if model.IsStaffRole(user.Role) {
		return nil, apperr.New(1003, "该账号为员工账号，请前往 B 端管理后台登录")
	}
	return &LoginResult{Token: issueToken(user.ID), User: user}, nil
}

// StaffLogin B 端员工登录：按角色切换演示账号（免密）。
func (s *Service) StaffLogin(role string) (*LoginResult, error) {
	role = strings.TrimSpace(role)
	if !model.IsStaffRole(role) {
		return nil, apperr.New(1004, "请选择有效的员工角色")
	}
	for _, user := range s.store.Users() {
		if user.Role == role {
			return &LoginResult{Token: issueToken(user.ID), User: user}, nil
		}
	}
	return nil, apperr.New(1005, "未找到该角色对应的演示账号")
}

// Profile 当前登录用户。
func (s *Service) Profile(userID string) (*model.User, error) {
	user, found := s.store.UserByID(userID)
	if !found {
		return nil, apperr.New(401, "登录已失效，请重新登录")
	}
	return &user, nil
}

// RealName 实名认证：校验姓名与身份证格式后，状态置为 normal。
func (s *Service) RealName(userID, realName, idCard string) (*model.User, error) {
	user, found := s.store.UserByID(userID)
	if !found {
		return nil, apperr.New(401, "登录已失效，请重新登录")
	}

	realName = strings.TrimSpace(realName)
	idCard = strings.ToUpper(strings.TrimSpace(idCard))
	if !realNamePattern.MatchString(realName) {
		return nil, apperr.New(1006, "请输入 2~15 位中文姓名")
	}
	if !idCardPattern.MatchString(idCard) {
		return nil, apperr.New(1007, "请输入 18 位有效身份证号")
	}

	user.RealName = realName
	user.IDCard = idCard
	user.Status = model.UserStatusNormal
	s.store.SaveUser(user)
	return &user, nil
}

// DemoCustomer 演示顾客账号。
type DemoCustomer struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

// DemoStaff 演示员工账号。
type DemoStaff struct {
	Role  string `json:"role"`
	Phone string `json:"phone"`
	Name  string `json:"name"`
}

// DemoAccounts 演示账号列表（GET /auth/demo-accounts）。
type DemoAccounts struct {
	Customer DemoCustomer `json:"customer"`
	Staff    []DemoStaff  `json:"staff"`
}

// DemoAccounts 返回演示账号。
func (s *Service) DemoAccounts() DemoAccounts {
	result := DemoAccounts{
		Customer: DemoCustomer{Phone: "13800138000", Code: "1234"},
		Staff:    make([]DemoStaff, 0, 4),
	}
	for _, user := range s.store.Users() {
		if model.IsStaffRole(user.Role) {
			result.Staff = append(result.Staff, DemoStaff{Role: user.Role, Phone: user.Phone, Name: user.RealName})
		}
	}
	return result
}

// Me 当前用户或 nil（GET /auth/me 未登录时返回 null）。
func (s *Service) Me(userID string) *model.User {
	if strings.TrimSpace(userID) == "" {
		return nil
	}
	user, found := s.store.UserByID(userID)
	if !found {
		return nil
	}
	return &user
}
