# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JPY SDK is a TypeScript monorepo for a cross-platform middleware SDK that enables device management, WebSocket communication, and automation control. It communicates with a device middleware server (iOS/Android devices) via both HTTP REST API and WebSocket protocols.

**Package manager:** pnpm workspace
**Build system:** tsup
**Platforms:** Node.js, Browser, Electron, Bun, Deno

## Commands

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` / `pnpm dev:app` | Start Vue demo app on port 3000 |
| `pnpm build` | Build SDK only |
| `pnpm build:all` | Build all packages |
| `pnpm lint` | Run linter on all packages |
| `pnpm clean` | Clean all node_modules, dist, .vite directories |
| `pnpm push:sdk` | Git subtree push `packages/jpy-sdk` to `sdk` branch |

### SDK Package (in `packages/jpy-sdk/`)

| Command | Description |
|---------|-------------|
| `pnpm build` | Build using tsup (outputs ESM, CJS, and .d.ts) |
| `pnpm dev` | Watch mode for development |
| `pnpm type-check` | TypeScript type checking without emit |

**Note:** No test framework is currently configured. Running `pnpm test` will return an error.

## Architecture

### Module Structure

The SDK is organized into four main communication modules plus shared utilities:

**Middleware (`jpy/middleware`)** - Core module providing `MiddlewareClient` with four sub-modules:
- **ClusterModule** (HTTP REST API) - Authentication, license info, network config, system package upload/flash, ROM operations
- **SubscribeModule** (WebSocket `/box/subscribe`) - Device list fetching, online status, device image requests
- **GuardModule** (WebSocket `/box/guard`) - USB/OTG toggle, power control, ADB enable, ROM flash operations, terminal, custom commands
- **MirrorModule** (WebSocket `/box/mirror`) - Single device operations with iOS/Android-specific APIs:
  - iOS: device info, app management, input (touch/key/text/clipboard), file ops, screenshot/screen recording/OCR, HTTP request/JS execution
  - Android: device info (including camera/root), app management (install/uninstall), input, screen (with video stream), audio stream, file ops

**Admin Device (`jpy/admin-device`)** - Admin operations: login, generate auth code, decrypt password, search auth code

**Admin DHCP (`jpy/admin-dhcp`)** - DHCP service management

**Device Modify (`jpy/device-modify`)** - Device modification/testing via WebSocket

**Shared (`jpy/shared`)** - Binary protocol encoding/decoding, time formatting, video decoder worker (browser-only)

### Binary Protocol

The communication protocol uses MessagePack + JSON encoding with the following structure:

```
+----------+-------------+-----------------+----------------+
| Type (1) | HeaderLen (1)| Header Content | Body Data     |
| byte     | byte         | (N bytes)       | (Remaining)    |
+----------+-------------+-----------------+----------------+
```

- **Type:** 1=PING, 2=PONG, 5=BYTES, 6=MSGPACK, 7=JSON, 9=VIDEO, 13=TERM
- **HeaderLen:** N = deviceIds count * 8
- **Header Content:** Device IDs as uint64 (little-endian each)
- **Body Data:** MsgPack or JSON encoded payload

Source: `packages/jpy-sdk/src/shared/protocol.ts`

### WebSocket Endpoints

| Endpoint | URL Pattern |
|----------|-------------|
| Subscribe | `wss://{host}/box/subscribe?Authorization={token}` |
| Guard | `wss://{host}/box/guard?id={deviceId}&Authorization={token}` |
| Mirror | `wss://{host}/box/mirror?id={deviceId}&Authorization={token}` |

### Business Function Codes

All server commands use numeric function codes from `BusinessFunction` enum in `packages/jpy-sdk/src/middleware/constants/index.ts`:

- Device: `DEVICE_DETAIL = 4`, `DEVICE_LIST = 5`, `ONLINE_STATUS = 6`
- Screen: `SCREENSHOT = 299`, `VIDEO_STREAM_START = 251`
- Input: `TOUCH_ABSOLUTE = 257`, `PRESS_KEY = 281`
- System: `EXECUTE_SHELL = 289`, `GET_APP_LIST = 290`, `START_APP = 291`, `KILL_APP = 292`
- Automation: `FIND_IMAGE = 410`, `OCR = 411`

## Key Patterns & Conventions

1. **Unified Client Pattern:** `MiddlewareClient` combines all modules under a single entry point
2. **Module Per Functionality:** Each WebSocket endpoint has its own module
3. **Platform Separation:** iOS and Android operations are strictly separated under `mirror/ios/` and `mirror/android/`
4. **Protocol Layer:** Binary protocol encoding/decoding is centralized in `shared/protocol.ts`
5. **Callback-based Communication:** WebSocket responses use promise-based callbacks with timeout handling
6. **BigInt Handling:** Server responses may include BigInt values; utilities are provided for conversion (`stringifyBigInt`, `toSafeNumber`, `bigIntToString`)
7. **Type-first Approach:** All interfaces and types are defined in `middleware/types/index.ts`

### Naming Conventions

- **Classes:** PascalCase (`MiddlewareClient`, `MirrorConnection`)
- **Methods:** camelCase (`connect()`, `fetchDeviceList()`)
- **Constants:** PascalCase enum (`BusinessFunction`, `MessageType`)
- **Files:** kebab-case for utilities, `index.ts` for module exports
- **Types:** PascalCase interfaces (`DeviceListItem`, `OnlineStatus`)

## Important File Locations

| Purpose | File Path |
|---------|-----------|
| Main SDK entry | `packages/jpy-sdk/src/index.ts` |
| Middleware client | `packages/jpy-sdk/src/middleware/client.ts` |
| Protocol handling | `packages/jpy-sdk/src/shared/protocol.ts` |
| Type definitions | `packages/jpy-sdk/src/middleware/types/index.ts` |
| Function constants | `packages/jpy-sdk/src/middleware/constants/index.ts` |
| Utility functions | `packages/jpy-sdk/src/middleware/utils/index.ts` |
| Build config | `packages/jpy-sdk/tsup.config.ts` |
| Demo app | `apps/` |

## Build Configuration (tsup)

- Entry points: `index.ts`, `middleware/index.ts`, `admin-device/index.ts`, `admin-dhcp/index.ts`, `device-modify/index.ts`, `shared/index.ts`
- Output formats: ESM (`.js`) and CJS (`.cjs`)
- Generates TypeScript declaration files (`.d.ts`)
- Source maps enabled
- External dependency: `msgpackr`
- Output directory: `dist/`

## Package Exports

```typescript
// Main entry
import { MiddlewareClient, MiddlewareError } from 'jpy';

// Sub-exports
import { MiddlewareClient } from 'jpy/middleware';
import { AdminDeviceClient } from 'jpy/admin-device';
import { DHCPClient } from 'jpy/admin-dhcp';
import { DeviceModifyClient } from 'jpy/device-modify';
import { encodeProtocolMessage } from 'jpy/shared';
```

## Demo Application

Located in `apps/`, this Vue 3 application provides a tabbed interface for testing each SDK module with a log panel for debugging. Runs on `localhost:3000` via Vite.
