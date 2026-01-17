
# JPY-MCP Server

This is the Model Context Protocol (MCP) server for JPY-SDK. It exposes SDK functionalities, hierarchical memory management, and aggregated workflows to AI agents.

## Installation & Usage

### Option 1: Run from Source (Recommended for Dev)

1. **Install Dependencies**:
   ```bash
   cd mcp
   npm install
   ```

2. **Build**:
   ```bash
   npm run build
   ```

3. **Start Server**:
   ```bash
   npm start
   ```

### Option 2: Integration with Claude/Trae

Add the following to your MCP configuration file:

```json
{
  "mcpServers": {
    "jpy-sdk": {
      "command": "node",
      "args": ["/Users/cih1996/work/jpy-zyd/jpy-sdk/mcp/build/mcp/src/server.js"]
    }
  }
}
```

## Capabilities

This MCP server provides three main categories of tools:

1. **SDK Tools (`jpy_*`)**: Direct wrappers around JPY-SDK middleware (init, connect, list devices).
2. **Memory Tools (`memory_*`)**: Strict `Main -> Sub -> List -> Data` hierarchical storage.
3. **Workflow Tools (`jpy_workflow_*`)**: Aggregated functions for complex tasks (e.g., health checks).

## Skills

Refer to the `skills/` directory for AI operating manuals:
- **jpy-memory-ops**: How to store/retrieve data.
- **jpy-asset-ops**: How to register assets.
- **jpy-health-ops**: How to perform inspections.

## Testing

To list all capabilities and verify integrity:

```bash
npm test tests/capabilities.test.ts
```
