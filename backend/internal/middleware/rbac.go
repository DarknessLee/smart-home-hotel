package middleware

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// 权限码（与 frontend/packages/shared-utils/src/permission.js 的 PERMISSION 保持一致）。
const (
	PermissionCRoomBook      = "c:room:book"
	PermissionCOrderOwn      = "c:order:own"
	PermissionCDeviceOwnRoom = "c:device:own_room"
	PermissionCSceneOwnRoom  = "c:scene:own_room"
	PermissionCCheckin       = "c:checkin"

	PermissionBDashboardView = "b:dashboard:view"
	PermissionBRoomView      = "b:room:view"
	PermissionBRoomOperate   = "b:room:operate"
	PermissionBOrderView     = "b:order:view"
	PermissionBOrderOperate  = "b:order:operate"
	PermissionBDeviceView    = "b:device:view"
	PermissionBDeviceOperate = "b:device:operate"
	PermissionBAlarmView     = "b:alarm:view"
	PermissionBAlarmHandle   = "b:alarm:handle"
	PermissionBEnergyView    = "b:energy:view"
	PermissionBPlanView      = "b:plan:view"
	PermissionBPlanCreate    = "b:plan:create"
	PermissionBPlanApprove   = "b:plan:approve"
	PermissionBFinanceView   = "b:finance:view"
	PermissionBFinanceOp     = "b:finance:operate"
	PermissionBStaffManage   = "b:staff:manage"
)

// rolePermissions 角色 -> 权限码（'*' 表示全部权限），与前端 permission.js 同构。
var rolePermissions = map[string][]string{
	"customer": {
		PermissionCRoomBook,
		PermissionCOrderOwn,
		PermissionCDeviceOwnRoom,
		PermissionCSceneOwnRoom,
		PermissionCCheckin,
	},
	"store_manager": {"*"},
	"frontdesk": {
		PermissionBDashboardView,
		PermissionBRoomView,
		PermissionBRoomOperate,
		PermissionBOrderView,
		PermissionBOrderOperate,
		PermissionBDeviceView,
		PermissionBAlarmView,
		PermissionBAlarmHandle,
	},
	"finance": {
		PermissionBDashboardView,
		PermissionBOrderView,
		PermissionBFinanceView,
		PermissionBFinanceOp,
	},
	"engineer": {
		PermissionBRoomView,
		PermissionBDeviceView,
		PermissionBDeviceOperate,
		PermissionBAlarmView,
		PermissionBAlarmHandle,
		PermissionBEnergyView,
		PermissionBPlanView,
	},
}

// HasPermission 判断角色是否拥有指定权限。
func HasPermission(role, permission string) bool {
	permissions, ok := rolePermissions[role]
	if !ok {
		return false
	}
	for _, item := range permissions {
		if item == "*" || item == permission {
			return true
		}
	}
	return false
}

// Require RBAC 中间件：需要满足任意一个权限码。
// 未登录返回 401；无权限返回 403（HTTP 状态保持 200，与前端 Mock 一致）。
func Require(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := CurrentUser(c)
		if !ok {
			response.Fail(c, 401, "登录已失效，请重新登录")
			c.Abort()
			return
		}
		for _, permission := range permissions {
			if HasPermission(user.Role, permission) {
				c.Next()
				return
			}
		}
		response.Fail(c, 403, "无权限执行该操作")
		c.Abort()
	}
}
