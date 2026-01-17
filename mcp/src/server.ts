#!/usr/bin/env node

// Allow self-signed certificates for development/intranet environments
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Redirect console.log to stderr to prevent polluting stdout (which is used for MCP protocol)
const originalConsoleLog = console.log;
console.log = (...args) => {
  console.error(...args);
};

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { sdkTools } from './tools/index';

// Combine definitions and handlers
const allTools = [
  ...sdkTools.definitions
];

const allHandlers: Record<string, Function> = {
  ...sdkTools.handlers
};

const server = new Server(
  {
    name: 'jpy-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const handler = allHandlers[toolName];

  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    return await handler(request.params.arguments);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${toolName}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('JPY MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
