package config

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"gopkg.in/yaml.v3"
)

// GlobalSettings holds the runtime configuration from jpy-config.yaml
var GlobalSettings Settings
var mu sync.Mutex

type Settings struct {
	LogLevel       string `yaml:"log_level"`
	LogOutput      string `yaml:"log_output"`
	MaxConcurrency int    `yaml:"max_concurrency"`
	ConnectTimeout int    `yaml:"connect_timeout"`
}

func GetConfigDir() string {
	if dir := os.Getenv("JPY_DATA_DIR"); dir != "" {
		return dir
	}

	home, err := os.UserHomeDir()
	if err != nil {
		panic("Failed to get user home directory: " + err.Error())
	}

	path := filepath.Join(home, ".jpy", "data")
	if err := os.MkdirAll(path, 0755); err != nil {
		// Just print warning, return path anyway hoping it might work or fail later
		// But in CLI context fmt.Println is acceptable for critical setup errors
	}
	return path
}

func GetConfigPath() string {
	return filepath.Join(GetConfigDir(), "config.json")
}

func Load() (*Config, error) {
	path := GetConfigPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return &Config{
			Groups: make(map[string][]LocalServerConfig),
		}, nil
	}

	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	// Initialize map if nil
	if cfg.Groups == nil {
		cfg.Groups = make(map[string][]LocalServerConfig)
	}

	// Migration: Move Servers to Groups
	if len(cfg.Servers) > 0 {
		for _, s := range cfg.Servers {
			group := s.Group
			if group == "" {
				group = "default"
				s.Group = "default"
			}
			// Check for duplicates in the target group during migration
			exists := false
			for _, existing := range cfg.Groups[group] {
				if existing.URL == s.URL {
					exists = true
					break
				}
			}
			if !exists {
				cfg.Groups[group] = append(cfg.Groups[group], s)
			}
		}
		// Clear old list after migration
		cfg.Servers = nil
		// We could Save here, but side-effects in Load are sometimes risky.
		// However, it ensures the file is updated on next run.
		Save(&cfg)
	}

	return &cfg, nil
}

func Save(cfg *Config) error {
	mu.Lock()
	defer mu.Unlock()
	return saveLocked(cfg)
}

func saveLocked(cfg *Config) error {
	dir := GetConfigDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	return ioutil.WriteFile(GetConfigPath(), data, 0644)
}

func UpdateServer(cfg *Config, server LocalServerConfig) error {
	mu.Lock()
	defer mu.Unlock()
	addServerLocked(cfg, server)
	return saveLocked(cfg)
}

func AddServer(cfg *Config, server LocalServerConfig) {
	mu.Lock()
	defer mu.Unlock()
	addServerLocked(cfg, server)
}

func addServerLocked(cfg *Config, server LocalServerConfig) {
	if cfg.Groups == nil {
		cfg.Groups = make(map[string][]LocalServerConfig)
	}

	group := server.Group
	if group == "" {
		group = "default"
		server.Group = "default"
	}

	servers := cfg.Groups[group]
	updated := false
	for i, s := range servers {
		if s.URL == server.URL {
			// Update existing
			if server.Token == "" {
				server.Token = s.Token
			}
			if server.LastLoginTime == "" {
				server.LastLoginTime = s.LastLoginTime
			}
			if server.LastLoginError == "" {
				server.LastLoginError = s.LastLoginError
			}
			servers[i] = server
			updated = true
			break
		}
	}

	if !updated {
		servers = append(servers, server)
	}

	cfg.Groups[group] = servers
}

// GetServers returns all servers flattened (for backward compatibility if needed) or filtered
func GetAllServers(cfg *Config) []LocalServerConfig {
	var all []LocalServerConfig
	for _, groupServers := range cfg.Groups {
		all = append(all, groupServers...)
	}
	return all
}

// GetGroupServers returns servers for a specific group
func GetGroupServers(cfg *Config, group string) []LocalServerConfig {
	if servers, ok := cfg.Groups[group]; ok {
		return servers
	}
	return []LocalServerConfig{}
}

func LoadSettings() *Settings {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	path := filepath.Join(home, ".jpy", "config.yaml")
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil
	}
	var cfg Settings
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil
	}
	return &cfg
}

func SaveSettings(cfg *Settings) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	path := filepath.Join(home, ".jpy", "config.yaml")

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return ioutil.WriteFile(path, data, 0644)
}
