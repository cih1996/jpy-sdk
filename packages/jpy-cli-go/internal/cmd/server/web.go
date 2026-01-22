package server

import (
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/gorilla/websocket"
	"github.com/spf13/cobra"
)

//go:embed static/*
var content embed.FS

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity in this context
	},
}

func NewWebServerCmd() *cobra.Command {
	var port int

	cmd := &cobra.Command{
		Use:   "web",
		Short: "启动 Web 终端服务 (推荐)",
		Long: `启动一个基于 Web 的终端服务，提供比 SSH 更优秀的 TUI 兼容性和跨平台体验。
无需安装任何客户端，直接通过浏览器访问即可。

特性:
- 完美支持 Windows/macOS/Linux
- 自动适应窗口大小
- 支持鼠标操作和所有快捷键
- 解决 Windows 下 SSH 终端渲染错位问题
- 支持自定义快捷命令侧边栏`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Serve static files
			// Embed path is "static", so we need to strip prefix if we want /static/x.js
			// But for root index.html:

			http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/" || r.URL.Path == "/index.html" {
					data, _ := content.ReadFile("static/index.html")
					w.Write(data)
					return
				}
				// Serve other static assets if any (not needed for now as we use CDN for xterm)
			})

			http.HandleFunc("/ws", handleWebsocket)

			http.HandleFunc("/config/commands", func(w http.ResponseWriter, r *http.Request) {
				data, err := content.ReadFile("static/quick_commands.json")
				if err != nil {
					w.Header().Set("Content-Type", "application/json")
					w.Write([]byte("[]"))
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.Write(data)
			})

			addr := fmt.Sprintf(":%d", port)
			fmt.Printf("Web Terminal started at http://localhost%s\n", addr)
			fmt.Printf("Press Ctrl+C to stop.\n")

			return http.ListenAndServe(addr, nil)
		},
	}

	cmd.Flags().IntVarP(&port, "port", "p", 8080, "Web 服务监听端口")
	return cmd
}

type wsMessage struct {
	Type string `json:"type"`
	Data string `json:"data"`
	Cols int    `json:"cols"`
	Rows int    `json:"rows"`
}

func handleWebsocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// 1. Prepare Command
	cmd := exec.Command(getUserShell())
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	// Ensure jpy executable is in PATH (same logic as SSH)
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		currentPath := os.Getenv("PATH")
		newPath := fmt.Sprintf("PATH=%s%c%s", exeDir, os.PathListSeparator, currentPath)
		cmd.Env = append(cmd.Env, newPath)
	}

	// 2. Start PTY
	ptyIO, err := StartPTY(cmd)
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Failed to start PTY: %v", err)))
		return
	}
	defer func() {
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		ptyIO.Close()
	}()

	// 3. Output Loop (PTY -> WebSocket)
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := ptyIO.Read(buf)
			if err != nil {
				break
			}
			// Send as Binary to avoid UTF-8 validation issues in some browsers/libs
			// although TextMessage usually works fine for VT100
			err = conn.WriteMessage(websocket.BinaryMessage, buf[:n])
			if err != nil {
				break
			}
		}
		conn.Close()
	}()

	// 4. Input Loop (WebSocket -> PTY)
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg wsMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "input":
			ptyIO.Write([]byte(msg.Data))
		case "resize":
			ResizePTY(ptyIO, msg.Cols, msg.Rows)
		}
	}
}
