package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/response"
	"github.com/smart-home/hotel/backend/internal/store"
)

// ContextUserKey 登录用户在 gin.Context 中的键。
const ContextUserKey = "current_user"

// TokenPrefix Mock 登录态前缀：mock-token-<userId>，与前端 Mock 完全一致。
const TokenPrefix = "mock-token-"

// Auth Bearer Token 鉴权中间件。
//
// 当前为 Mock 阶段实现：解析 `Authorization: Bearer mock-token-<userId>`，
// 从内存库中查找用户并写入 gin.Context；后续替换 JWT 时只需替换本文件实现。
func Auth(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := resolveUser(st, c)
		if !ok {
			response.Fail(c, 401, "登录已失效，请重新登录")
			c.Abort()
			return
		}
		c.Set(ContextUserKey, user)
		c.Next()
	}
}

// OptionalAuth 可选鉴权中间件：有合法 token 时解析用户，没有时也放行。
// 用于 GET /auth/me（未登录返回 null）等接口。
func OptionalAuth(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		if user, ok := resolveUser(st, c); ok {
			c.Set(ContextUserKey, user)
		}
		c.Next()
	}
}

// CurrentUser 从 gin.Context 取出当前登录用户。
func CurrentUser(c *gin.Context) (model.User, bool) {
	value, exists := c.Get(ContextUserKey)
	if !exists {
		return model.User{}, false
	}
	user, ok := value.(model.User)
	return user, ok
}

// BearerToken 读取请求头中的 Bearer Token（大小写不敏感）。
func BearerToken(c *gin.Context) string {
	authorization := c.GetHeader("Authorization")
	if authorization == "" {
		for key, values := range c.Request.Header {
			if strings.EqualFold(key, "Authorization") && len(values) > 0 {
				authorization = values[0]
				break
			}
		}
	}
	authorization = strings.TrimSpace(authorization)
	if len(authorization) < 7 || !strings.EqualFold(authorization[:7], "Bearer ") {
		if strings.HasPrefix(authorization, TokenPrefix) {
			return authorization
		}
		return ""
	}
	return strings.TrimSpace(authorization[7:])
}

// resolveUser 解析 token 并查找用户。
func resolveUser(st *store.Store, c *gin.Context) (model.User, bool) {
	token := BearerToken(c)
	if !strings.HasPrefix(token, TokenPrefix) {
		return model.User{}, false
	}
	userID := strings.TrimSpace(strings.TrimPrefix(token, TokenPrefix))
	if userID == "" {
		return model.User{}, false
	}
	return st.UserByID(userID)
}
