// Package config 加载运行配置。
//
// 依赖方向：cmd/server -> config；config 只依赖 Go 标准库。
// 配置来源优先级：进程环境变量 > 当前工作目录下的 .env 文件 > 代码默认值。
// 这样 `go run ./cmd/server` 在 backend 目录下可直接使用 `cp .env.example .env` 的配置。
package config

import (
	"bufio"
	"os"
	"strings"
)

// Config 应用配置。
// 说明：MySQLDSN / RedisAddr / MQTTBroker 等字段当前只做占位与日志打印，
// 后续接入真实中间件时在 internal/store、internal/iot 中读取即可。
type Config struct {
	AppEnv            string
	HTTPPort          string
	GinMode           string
	CORSAllowOrigins  []string
	MySQLDSN          string
	RedisAddr         string
	RedisPassword     string
	RedisDB           string
	MQTTBroker        string
	MQTTUsername      string
	MQTTPassword      string
	MQTTTopicTemplate string
}

// Load 读取 .env（若存在）与环境变量，返回配置对象。
func Load() *Config {
	loadDotEnv(".env")
	return &Config{
		AppEnv:            getenv("APP_ENV", "development"),
		HTTPPort:          getenv("HTTP_PORT", "8080"),
		GinMode:           getenv("GIN_MODE", "debug"),
		CORSAllowOrigins:  splitAndTrim(getenv("CORS_ALLOW_ORIGINS", "*")),
		MySQLDSN:          getenv("MYSQL_DSN", ""),
		RedisAddr:         getenv("REDIS_ADDR", ""),
		RedisPassword:     getenv("REDIS_PASSWORD", ""),
		RedisDB:           getenv("REDIS_DB", "0"),
		MQTTBroker:        getenv("MQTT_BROKER", ""),
		MQTTUsername:      getenv("MQTT_USERNAME", ""),
		MQTTPassword:      getenv("MQTT_PASSWORD", ""),
		MQTTTopicTemplate: getenv("MQTT_TOPIC_TEMPLATE", "hotel/{store_id}/room/{room_id}/device/{device_id}/command"),
	}
}

// Address 返回 gin.Run 使用的监听地址，例如 ":8080"。
func (c *Config) Address() string {
	port := strings.TrimSpace(c.HTTPPort)
	if port == "" {
		port = "8080"
	}
	if strings.HasPrefix(port, ":") {
		return port
	}
	return ":" + port
}

// loadDotEnv 极简 .env 解析器（仅标准库，避免引入第三方依赖）。
// 已存在于进程环境变量中的 key 不会被覆盖（与 dotenv 库的默认行为一致）。
func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer func() {
		_ = file.Close()
	}()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		_ = os.Setenv(key, value)
	}
}

// getenv 读取环境变量，缺省时返回 fallback。
func getenv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return fallback
}

// splitAndTrim 按英文逗号切分并去空白。
func splitAndTrim(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if item := strings.TrimSpace(part); item != "" {
			result = append(result, item)
		}
	}
	return result
}
