package api

import (
	"bytes"
	"errors"
	"fmt"
	"jpy-cli/pkg/middleware/model"
	"jpy-cli/pkg/middleware/protocol"

	"github.com/vmihailenco/msgpack/v5"
)

// DeviceAPI provides methods for interacting with device-related functionality.
type DeviceAPI struct {
	transport protocol.Transport
}

func NewDeviceAPI(t protocol.Transport) *DeviceAPI {
	return &DeviceAPI{transport: t}
}

// FetchDeviceList retrieves the list of devices from the server.
func (api *DeviceAPI) FetchDeviceList() ([]model.DeviceListItem, error) {
	resp, err := api.transport.SendRequest(model.FuncDeviceList, nil)
	if err != nil {
		return nil, err
	}

	// Extract data from response
	b, _ := msgpack.Marshal(resp.Data)

	// Try unwrapped array from Data
	var devicesFromData []model.DeviceListItem
	decData := msgpack.NewDecoder(bytes.NewReader(b))
	decData.SetCustomStructTag("json")
	if err := decData.Decode(&devicesFromData); err == nil {
		return devicesFromData, nil
	}

	// Try wrapped {data: [...]}
	var wrapper struct {
		Data []model.DeviceListItem `json:"data"`
	}
	decWrapper := msgpack.NewDecoder(bytes.NewReader(b))
	decWrapper.SetCustomStructTag("json")
	if err := decWrapper.Decode(&wrapper); err == nil {
		return wrapper.Data, nil
	}

	return nil, errors.New("解析设备列表失败")
}

// FetchOnlineStatus retrieves the online status of devices.
func (api *DeviceAPI) FetchOnlineStatus() ([]model.OnlineStatus, error) {
	resp, err := api.transport.SendRequest(model.FuncOnlineStatus, nil)
	if err != nil {
		return nil, err
	}

	b, _ := msgpack.Marshal(resp.Data)

	// Try unwrapped array from Data
	var statusesFromData []model.OnlineStatus
	decData := msgpack.NewDecoder(bytes.NewReader(b))
	decData.SetCustomStructTag("json")
	if err := decData.Decode(&statusesFromData); err == nil {
		return statusesFromData, nil
	}

	// Try wrapped {data: [...]}
	var wrapper struct {
		Data []model.OnlineStatus `json:"data"`
	}
	decWrapper := msgpack.NewDecoder(bytes.NewReader(b))
	decWrapper.SetCustomStructTag("json")
	if err := decWrapper.Decode(&wrapper); err == nil {
		return wrapper.Data, nil
	}

	return nil, errors.New("解析在线状态失败")
}

// RebootDevice reboots the device.
func (api *DeviceAPI) RebootDevice(seat int) error {
	return api.sendControlRequest(model.FuncPowerControl, map[string]interface{}{
		"seat": seat,
		"mode": 2, // 2=Reboot
	})
}

// SwitchUSBMode switches the USB mode (true for Host/OTG, false for Device/USB).
func (api *DeviceAPI) SwitchUSBMode(seat int, otg bool) error {
	mode := 1 // USB
	if otg {
		mode = 0 // OTG
	}
	return api.sendControlRequest(model.FuncSwitchUSBGuard, map[string]interface{}{
		"seat": seat,
		"mode": mode,
	})
}

// ControlADB enables or disables ADB.
func (api *DeviceAPI) ControlADB(seat int, enable bool) error {
	mode := 0
	if enable {
		mode = 2
	}
	return api.sendControlRequest(model.FuncEnableADB, map[string]interface{}{
		"seat": seat,
		"mode": mode,
	})
}

// sendControlRequest sends a control request and checks for server errors.
func (api *DeviceAPI) sendControlRequest(code int, data interface{}) error {
	resp, err := api.transport.SendRequest(code, data)
	if err != nil {
		return err
	}
	if resp.Code != nil && *resp.Code != 0 {
		msg := "unknown error"
		if resp.Msg != nil {
			msg = *resp.Msg
		}
		return fmt.Errorf("operation failed (code %d): %s", *resp.Code, msg)
	}
	return nil
}
