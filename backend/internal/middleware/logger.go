package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger 请求日志：打印方法、路径、HTTP 状态、耗时、客户端 IP。
// 后续可替换为 zap / logrus 等结构化日志，或接入 OpenTelemetry。
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		if rawQuery := c.Request.URL.RawQuery; rawQuery != "" {
			path = path + "?" + rawQuery
		}

		c.Next()

		log.Printf(
			"[HTTP] %s %s status=%d latency=%s ip=%s",
			c.Request.Method,
			path,
			c.Writer.Status(),
			time.Since(start).Round(time.Microsecond),
			c.ClientIP(),
		)
	}
}
