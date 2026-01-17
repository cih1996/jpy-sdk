
---
name: device-management
description: 管理和控制 JPY 设备（批量切换 USB/OTG 模式、检查状态、处理掉线设备）。当用户要求“把所有 USB 模式切换为 OTG”、“检查设备状态”、“列出掉线设备”或进行批量控制时使用此技能。
---

# JPY 设备管理与批量控制技能

此技能帮助你高效地管理大量 JPY 设备，通过“快照+查询+操作”的三步流程，避免重复的全量扫描，节省时间和 Token。

## 核心工作流

### 1. 建立快照 (Snapshot)
在进行任何批量查询或操作之前，**必须**确保有最新的设备状态快照。
- **工具**: `jpy_get_device_info`
- **参数**: `id` (用户ID), `ip` (留空! 留空才会触发全量扫描并保存快照)
- **场景**: 用户刚开始会话，或者明确要求“刷新状态”、“重新扫描”时。

### 2. 精准查询 (Query)
利用快照数据，通过过滤器快速筛选出目标设备。**不要**再次调用 `jpy_get_device_info` 进行遍历。
- **工具**: `jpy_query_devices`
- **关键参数**:
    - `filter`:
        - `status`: `usb` (筛选USB模式), `otg`, `offline` (掉线), `online`
        - `exclude_ip_range`: 排除特定网段 (如 "192.168.12.201-205")
        - `include_ip_range`: 仅包含特定网段
    - `returnType`:
        - `summary`: 仅看数量 (例："有多少台掉线？") -> 返回统计数字
        - `target_map`: 准备操作 (例："把这些切成OTG") -> 返回 `{ip: [seats]}` 结构
        - `detail`: 查细节 (例："201这台服务器怎么了？") -> 返回详细JSON

### 3. 批量操作 (Action)
获得 `target_map` 后，调用相应的控制工具对设备进行操作。
*(注：控制工具如 `jpy_control_usb` 需配合使用，输入通常为 `server_ip` 和 `seat_index`)*

## 示例对话

**用户**: "把所有 USB 模式的设备切换成 OTG，除了 12 段的服务器。"

**你的思考**:
1.  用户要批量操作 -> 需要 `target_map`。
2.  条件 1: USB 模式 -> `filter.status = 'usb'`。
3.  条件 2: 排除 12 段 -> `filter.exclude_ip_range = '192.168.12.1-255'` (假设 12 段指这个)。
4.  先查快照，如果没快照先扫一遍。

**你的行动**:
```json
// 1. (如果需要) 建立快照
{
  "name": "jpy_get_device_info",
  "arguments": { "id": "default" }
}

// 2. 查询目标
{
  "name": "jpy_query_devices",
  "arguments": {
    "id": "default",
    "filter": {
      "status": "usb",
      "exclude_ip_range": "192.168.12.1-192.168.12.255"
    },
    "returnType": "target_map"
  }
}
```

**用户**: "现在有多少台设备掉线了？"

**你的行动**:
```json
{
  "name": "jpy_query_devices",
  "arguments": {
    "id": "default",
    "filter": { "status": "offline" },
    "returnType": "summary"
  }
}
```
