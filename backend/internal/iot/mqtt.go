// Package iot 定义 IoT 接入扩展点。
//
// 当前 MVP 阶段设备属性只写入内存库（internal/store），**不引入任何 MQTT 依赖**。
// 后期接入 EMQX（MQTT）时按以下步骤替换：
//
//  1. 在 backend/go.mod 增加 MQTT 客户端依赖（如 github.com/eclipse/paho.mqtt.golang）；
//  2. 新增 mqtt_client.go 实现本文件的 Client 接口；
//  3. 在 internal/service/device.go 的 UpdateDeviceProperties / ExecuteScene 中
//     通过 Publisher 下发指令；设备状态回读通过 Subscribe 回调写回 store；
//  4. 连接参数从 config.Config 的 MQTTBroker / MQTTUsername / MQTTPassword 读取。
package iot

import (
	"context"
	"fmt"
	"log"
	"strings"
)

// QoS MQTT 消息质量等级（与 MQTT 协议语义一致）。
type QoS byte

const (
	// QoSAtMostOnce 最多一次（0）。
	QoSAtMostOnce QoS = 0
	// QoSAtLeastOnce 至少一次（1）。
	QoSAtLeastOnce QoS = 1
	// QoSExactlyOnce 恰好一次（2）。
	QoSExactlyOnce QoS = 2
)

// DeviceCommand 设备属性下发指令（PATCH /devices/:id/properties 的 IoT 侧载荷）。
type DeviceCommand struct {
	StoreID    string         `json:"store_id"`
	RoomID     string         `json:"room_id"`
	DeviceID   string         `json:"device_id"`
	DeviceType string         `json:"device_type"`
	Properties map[string]any `json:"properties"`
	IssuedBy   string         `json:"issued_by"`
	RequestID  string         `json:"request_id,omitempty"`
}

// Client MQTT 客户端抽象（后续用 paho.mqtt.golang 实现）。
type Client interface {
	// Publish 向指定 topic 发布消息。
	Publish(ctx context.Context, topic string, payload []byte, qos QoS) error
	// Subscribe 订阅指定 topic，回调处理设备上报/回执。
	Subscribe(ctx context.Context, topic string, qos QoS, handler func(topic string, payload []byte)) error
	// Close 关闭连接。
	Close() error
}

// Publisher 设备指令下发抽象：业务层只依赖该接口，便于单元测试与 Mock。
type Publisher interface {
	PublishCommand(ctx context.Context, command DeviceCommand) error
}

// TopicTemplate 默认 topic 模板：hotel/{store_id}/room/{room_id}/device/{device_id}/command
const TopicTemplate = "hotel/{store_id}/room/{room_id}/device/{device_id}/command"

// BuildTopic 按模板生成 topic。
func BuildTopic(template string, command DeviceCommand) string {
	if strings.TrimSpace(template) == "" {
		template = TopicTemplate
	}
	replacer := strings.NewReplacer(
		"{store_id}", command.StoreID,
		"{room_id}", command.RoomID,
		"{device_id}", command.DeviceID,
		"{device_type}", command.DeviceType,
	)
	return replacer.Replace(template)
}

// LogPublisher 占位实现：只打印下发内容，供当前无硬件阶段联调。
// 后续替换为 MQTTClientPublisher 即可，业务层代码无需改动。
type LogPublisher struct {
	// TopicTemplate MQTT topic 模板，留空使用 iot.TopicTemplate。
	TopicTemplate string
}

// PublishCommand 实现 Publisher 接口（当前仅打日志）。
func (p *LogPublisher) PublishCommand(_ context.Context, command DeviceCommand) error {
	topic := BuildTopic(p.TopicTemplate, command)
	log.Printf("[iot][mock] publish topic=%s device=%s type=%s properties=%v", topic, command.DeviceID, command.DeviceType, command.Properties)
	return nil
}

// Reminder 编译期接口断言：确保占位实现始终满足扩展点契约。
var _ Publisher = (*LogPublisher)(nil)

// MockClient 占位 MQTT 客户端：未接入 EMQX 时保证接口可用（所有操作返回未实现错误）。
type MockClient struct{}

// Publish 实现 Client 接口。
func (c *MockClient) Publish(_ context.Context, topic string, _ []byte, _ QoS) error {
	return fmt.Errorf("iot: MQTT 未接入（topic=%s），请先在 internal/iot 中实现 Client", topic)
}

// Subscribe 实现 Client 接口。
func (c *MockClient) Subscribe(_ context.Context, topic string, _ QoS, _ func(topic string, payload []byte)) error {
	return fmt.Errorf("iot: MQTT 未接入（topic=%s），请先在 internal/iot 中实现 Client", topic)
}

// Close 实现 Client 接口。
func (c *MockClient) Close() error {
	return nil
}

// 编译期接口断言。
var _ Client = (*MockClient)(nil)
