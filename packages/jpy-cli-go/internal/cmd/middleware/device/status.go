package device

import (
	"fmt"
	httpclient "jpy-cli/pkg/client/http"
	wsclient "jpy-cli/pkg/client/ws"
	"jpy-cli/pkg/config"
	"jpy-cli/pkg/logger"
	"jpy-cli/pkg/middleware/device/api"
	"jpy-cli/pkg/middleware/device/selector"
	"jpy-cli/pkg/middleware/model"
	"jpy-cli/pkg/tui"
	"sort"
	"strings"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/spf13/cobra"
)

type ServerStatusStats struct {
	ServerURL      string
	Status         string
	LicenseStatus  string
	DeviceCount    int
	BizOnlineCount int
	IPCount        int
	UUIDCount      int
	ADBCount       int
	USBCount       int
	OTGCount       int
	Error          error
	OrderIndex     int
}

func NewStatusCmd() *cobra.Command {
	opts := CommonFlags{}

	cmd := &cobra.Command{
		Use:   "status",
		Short: "查看设备状态和服务器健康状况",
		Long: `查看中间件服务器的在线状态和聚合设备统计信息。

支持使用统一的筛选参数来快速定位问题服务器或特定状态的设备：
- 筛选在线/离线设备
- 筛选缺失IP的设备
- 筛选特定UUID或机位的设备
- 筛选ADB开启/关闭的设备
- 筛选已授权/未授权服务器

筛选条件可以组合使用（AND逻辑）。`,
		Run: func(cmd *cobra.Command, args []string) {
			cfg, err := config.Load()
			if err != nil {
				fmt.Printf("无法加载配置: %v\n", err)
				return
			}

			// Determine group
			targetGroup := opts.Group
			if targetGroup == "" {
				targetGroup = cfg.ActiveGroup
			}
			if targetGroup == "" {
				targetGroup = "default"
			}

			fmt.Printf("当前分组: %s\n", targetGroup)
			logger.Infof("开始检查分组设备状态: %s", targetGroup)

			// Get servers for the target group
			servers := config.GetGroupServers(cfg, targetGroup)

			// Map server URL to its index for sorting
			serverOrder := make(map[string]int)
			for i, s := range servers {
				serverOrder[s.URL] = i
			}

			// Filter servers by search term if provided
			var targets []config.LocalServerConfig
			for _, s := range servers {
				// Skip soft-deleted servers
				if s.Disabled {
					continue
				}
				if selector.MatchServerPattern(s.URL, opts.ServerPattern) {
					targets = append(targets, s)
				}
			}

			if len(targets) == 0 {
				fmt.Printf("分组 '%s' 中未找到匹配的服务器。\n", targetGroup)
				return
			}

			concurrency := config.GlobalSettings.MaxConcurrency
			if concurrency < 1 {
				concurrency = 5
			}

			// Results channel for TUI
			resultsChan := make(chan interface{}, len(targets))
			var wg sync.WaitGroup
			sem := make(chan struct{}, concurrency)

			// Start workers
			for _, s := range targets {
				wg.Add(1)
				go func(server config.LocalServerConfig) {
					defer wg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()

					stats := ServerStatusStats{
						ServerURL:     server.URL,
						Status:        "Offline",
						LicenseStatus: "Unknown",
						OrderIndex:    serverOrder[server.URL],
					}

					// 1. Check License (HTTP)
					apiClient := httpclient.NewClient(server.URL, server.Token)
					lic, err := apiClient.GetLicense()
					if err == nil {
						if lic.StatusTxt != nil {
							stats.LicenseStatus = *lic.StatusTxt
						} else {
							stats.LicenseStatus = "Unknown"
						}
						stats.Status = "Online"
					} else {
						// Attempt re-login
						logger.Infof("[%s] License check failed, attempting re-login...", server.URL)
						newToken, loginErr := apiClient.Login(server.Username, server.Password)
						if loginErr == nil {
							// Update server config
							server.Token = newToken
							server.LastLoginTime = time.Now().Format(time.RFC3339)
							server.LastLoginError = ""
							config.UpdateServer(cfg, server)

							// Retry License Check
							apiClient.Token = newToken
							lic, err = apiClient.GetLicense()
							if err == nil {
								if lic.StatusTxt != nil {
									stats.LicenseStatus = *lic.StatusTxt
								} else {
									stats.LicenseStatus = "Unknown"
								}
								stats.Status = "Online"
								logger.Infof("[%s] Re-login successful", server.URL)
							} else {
								stats.Status = "AuthFail"
								logger.Warnf("[%s] Re-login successful but license check failed: %v", server.URL, err)
							}
						} else {
							stats.Status = "AuthFail"
							server.LastLoginError = loginErr.Error()
							config.UpdateServer(cfg, server)
							logger.Errorf("[%s] Re-login failed: %v", server.URL, loginErr)
						}
					}

					// 2. Fetch Devices (WS)
					if stats.Status == "Online" {
						wsClient := wsclient.NewClient(server.URL, server.Token)
						wsClient.Timeout = time.Duration(config.GlobalSettings.ConnectTimeout) * time.Second
						if err := wsClient.Connect(); err == nil {
							deviceAPI := api.NewDeviceAPI(wsClient)

							// Fetch list and status
							devices, err := deviceAPI.FetchDeviceList()
							if err == nil {
								// We count later after filtering
							}

							onlineStatuses, err := deviceAPI.FetchOnlineStatus()
							if err == nil {
								// Build map for easier lookup
								statusMap := make(map[int]model.OnlineStatus)
								for _, s := range onlineStatuses {
									s.Parse()
									statusMap[s.Seat] = s
								}

								// Iterate devices to calculate stats (with filtering)
								for _, d := range devices {
									// --- Device Filtering ---
									// UUID Filter
									if opts.UUID != "" && !strings.Contains(d.UUID, opts.UUID) {
										continue
									}
									// Seat Filter
									if opts.Seat > -1 && d.Seat != opts.Seat {
										continue
									}

									// Prepare status flags for filtering
									var isOnline bool // In status map = online? Usually yes for FetchOnlineStatus
									var isBizOnline bool
									var isADB bool
									var isUSB bool // true=USB, false=OTG
									var hasIP bool

									if s, ok := statusMap[d.Seat]; ok {
										isOnline = true
										if s.IsManagementOnline {
											isBizOnline = true
										}
										if s.IsADBEnabled {
											isADB = true
										}
										if s.IsUSBMode {
											isUSB = true
										}
										if s.IP != "" {
											hasIP = true
										}
									}

									// Filter Online
									if opts.FilterOnline != "" {
										want := opts.FilterOnline == "true"
										// If filter is for "online", we need status map entry?
										// FetchOnlineStatus returns only online devices?
										// Actually it usually returns all seats status?
										// Let's assume statusMap contains entry if device is "online" (connected to server).
										if isOnline != want {
											continue
										}
									}
									// Filter ADB
									if opts.FilterADB != "" {
										want := opts.FilterADB == "true"
										if isADB != want {
											continue
										}
									}
									// Filter USB
									if opts.FilterUSB != "" {
										want := opts.FilterUSB == "true"
										if isUSB != want {
											continue
										}
									}
									// Filter HasIP
									if opts.FilterHasIP != "" {
										want := opts.FilterHasIP == "true"
										if hasIP != want {
											continue
										}
									}

									// --- Accumulate Stats ---
									stats.DeviceCount++
									if d.UUID != "" {
										stats.UUIDCount++
									}

									if isOnline {
										if isBizOnline && hasIP {
											stats.BizOnlineCount++
										}
										if hasIP {
											stats.IPCount++
										}
										if isADB {
											stats.ADBCount++
										}
										if isUSB {
											stats.USBCount++
										} else {
											stats.OTGCount++
										}
									}
								}
							}

							wsClient.Close()
						}
					}

					resultsChan <- stats
				}(s)
			}

			// Closer goroutine
			go func() {
				wg.Wait()
				close(resultsChan)
			}()

			// Start TUI
			totalDevicesStatus := 0
			prog := tea.NewProgram(tui.NewProgressModel(len(targets), resultsChan, func(v interface{}) string {
				stats := v.(ServerStatusStats)
				cleanURL := strings.TrimPrefix(stats.ServerURL, "https://")
				cleanURL = strings.TrimPrefix(cleanURL, "http://")

				if stats.Status == "Online" {
					totalDevicesStatus += stats.DeviceCount
					return fmt.Sprintf("✅ %s: %d 台设备 (总计: %d)", cleanURL, stats.DeviceCount, totalDevicesStatus)
				}
				return fmt.Sprintf("❌ %s: %s", cleanURL, stats.Status)
			}))

			finalModel, err := prog.Run()
			if err != nil {
				fmt.Printf("TUI运行错误: %v\n", err)
				return
			}

			// Get results from model
			var results []ServerStatusStats
			rawResults := finalModel.(tui.ProgressModel).GetResults()
			for _, raw := range rawResults {
				results = append(results, raw.(ServerStatusStats))
			}

			// Apply Server Filters (Post-Processing)
			var filteredResults []ServerStatusStats
			for _, r := range results {
				keep := true

				// AuthorizedOnly
				if opts.AuthorizedOnly && r.LicenseStatus != "成功" {
					keep = false
				}

				// If any device filter was active, we probably want to hide servers with 0 results
				// Device filters: UUID, Seat, Online, ADB, USB, HasIP
				hasDeviceFilter := opts.UUID != "" || opts.Seat > -1 || opts.FilterOnline != "" ||
					opts.FilterADB != "" || opts.FilterUSB != "" || opts.FilterHasIP != ""

				if hasDeviceFilter && r.DeviceCount == 0 {
					keep = false
				}

				if keep {
					filteredResults = append(filteredResults, r)
				}
			}
			results = filteredResults

			sort.Slice(results, func(i, j int) bool {
				return results[i].OrderIndex < results[j].OrderIndex
			})

			if len(results) == 0 {
				fmt.Println("没有找到匹配的服务器或设备。")
				return
			}

			// Print Table with Lipgloss
			var (
				headerStyle = lipgloss.NewStyle().
						Bold(true).
						Foreground(lipgloss.Color("205")).
						Align(lipgloss.Center)

				cellStyle = lipgloss.NewStyle().
						Align(lipgloss.Center)

				statusOnlineStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))  // Green
				statusErrorStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("196")) // Red

				numGoodStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))
				numBadStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
				numNeutralStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("240")) // Grey

				headers = []string{"服务器地址", "状态", "设备数", "业务在线", "IP", "序列号", "ADB", "模式(OTG/USB)", "授权"}
				widths  = []int{24, 10, 8, 12, 12, 14, 14, 14, 10}
			)

			// Helper to render stats "Good/Bad"
			renderStats := func(good, bad int, isMode bool) string {
				sGood := fmt.Sprintf("%d", good)
				sBad := fmt.Sprintf("%d", bad)

				stGood := numGoodStyle
				stBad := numNeutralStyle

				if bad > 0 && !isMode {
					stBad = numBadStyle
				}

				// For Mode: OTG (Left) / USB (Right). Both are valid states.
				if isMode {
					stBad = numGoodStyle
				}

				return fmt.Sprintf("%s/%s", stGood.Render(sGood), stBad.Render(sBad))
			}

			// Render Header
			var headerRow string
			for i, h := range headers {
				headerRow = lipgloss.JoinHorizontal(lipgloss.Top, headerRow, headerStyle.Width(widths[i]).Render(h))
			}
			fmt.Println(headerRow)
			fmt.Println(lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render(strings.Repeat("-", lipgloss.Width(headerRow))))

			var (
				totalDevice    int
				totalBizOnline int
				totalIP        int
				totalUUID      int
				totalADB       int
				totalUSB       int
				totalOTG       int
			)

			for _, r := range results {
				// Accumulate totals
				totalDevice += r.DeviceCount
				totalBizOnline += r.BizOnlineCount
				totalIP += r.IPCount
				totalUUID += r.UUIDCount
				totalADB += r.ADBCount
				totalUSB += r.USBCount
				totalOTG += r.OTGCount

				// Clean URL
				displayURL := r.ServerURL
				displayURL = strings.TrimPrefix(displayURL, "https://")
				displayURL = strings.TrimPrefix(displayURL, "http://")

				stStatus := statusOnlineStyle
				if r.Status != "Online" {
					stStatus = statusErrorStyle
				}

				stLic := statusOnlineStyle
				if r.LicenseStatus != "成功" {
					stLic = statusErrorStyle
				}

				row := []string{
					cellStyle.Width(widths[0]).Render(displayURL),
					stStatus.Width(widths[1]).Render(r.Status),
					cellStyle.Width(widths[2]).Render(fmt.Sprintf("%d", r.DeviceCount)),
					cellStyle.Width(widths[3]).Render(renderStats(r.BizOnlineCount, r.DeviceCount-r.BizOnlineCount, false)),
					cellStyle.Width(widths[4]).Render(renderStats(r.IPCount, r.DeviceCount-r.IPCount, false)),
					cellStyle.Width(widths[5]).Render(renderStats(r.UUIDCount, r.DeviceCount-r.UUIDCount, false)),
					cellStyle.Width(widths[6]).Render(renderStats(r.ADBCount, r.DeviceCount-r.ADBCount, false)),
					cellStyle.Width(widths[7]).Render(renderStats(r.OTGCount, r.USBCount, true)),
					stLic.Width(widths[8]).Render(r.LicenseStatus),
				}

				var rowStr string
				for _, cell := range row {
					rowStr = lipgloss.JoinHorizontal(lipgloss.Top, rowStr, cell)
				}
				fmt.Println(rowStr)
			}
			// Separator for totals
			fmt.Println(lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render(strings.Repeat("-", lipgloss.Width(headerRow))))

			totalRow := []string{
				cellStyle.Width(widths[0]).Render("总计"),
				cellStyle.Width(widths[1]).Render("-"),
				cellStyle.Width(widths[2]).Render(fmt.Sprintf("%d", totalDevice)),
				cellStyle.Width(widths[3]).Render(renderStats(totalBizOnline, totalDevice-totalBizOnline, false)),
				cellStyle.Width(widths[4]).Render(renderStats(totalIP, totalDevice-totalIP, false)),
				cellStyle.Width(widths[5]).Render(renderStats(totalUUID, totalDevice-totalUUID, false)),
				cellStyle.Width(widths[6]).Render(renderStats(totalADB, totalDevice-totalADB, false)),
				cellStyle.Width(widths[7]).Render(renderStats(totalOTG, totalUSB, true)),
				cellStyle.Width(widths[8]).Render("-"),
			}
			var totalStr string
			for _, cell := range totalRow {
				totalStr = lipgloss.JoinHorizontal(lipgloss.Top, totalStr, cell)
			}
			fmt.Println(totalStr)
		},
	}

	AddCommonFlags(cmd, &opts)

	return cmd
}
