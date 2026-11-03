// 智慧住家（Smart Home Hotel）Go 后端入口。
//
// 启动方式（在 backend 目录下）：
//
//	go mod tidy
//	cp .env.example .env
//	go run ./cmd/server
//
// 默认监听 :8080，接口前缀 /api，路径与 docs/api-contract.md 完全一致。
package main

import (
	"log"

	"github.com/smart-home/hotel/backend/internal/config"
	"github.com/smart-home/hotel/backend/internal/router"
	"github.com/smart-home/hotel/backend/internal/store"
)

func main() {
	cfg := config.Load()

	// 内存仓库 + 程序化种子数据（后期替换为 MySQL / Redis 实现）
	memoryStore := store.NewMemoryStore()

	engine := router.New(cfg, memoryStore)
	address := cfg.Address()

	log.Printf("[server] 智慧住家后端启动中 env=%s addr=%s", cfg.AppEnv, address)
	log.Printf("[server] 健康检查: http://127.0.0.1%s/health", address)
	log.Printf("[server] 接口前缀: http://127.0.0.1%s/api（契约见 docs/api-contract.md）", address)
	if cfg.MySQLDSN != "" {
		log.Printf("[server] 检测到 MYSQL_DSN 配置，当前仍使用内存仓库（后续替换点见 README）")
	}
	if cfg.MQTTBroker != "" {
		log.Printf("[server] 检测到 MQTT_BROKER=%s，当前仅预留 EMQX 扩展点（internal/iot/mqtt.go）", cfg.MQTTBroker)
	}

	if err := engine.Run(address); err != nil {
		log.Fatalf("[server] 启动失败: %v", err)
	}
}
