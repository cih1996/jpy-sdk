
import { loginTool } from './login';
import { deviceInfoTool } from './device-info';
import { errorSummaryTool } from './error-summary';
import { serverDetailTool } from './server-detail';
import { deviceQueryTool } from './device-query';

const tools = [loginTool, deviceInfoTool, errorSummaryTool, serverDetailTool, deviceQueryTool];

export const sdkTools = {
  definitions: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  })),
  handlers: tools.reduce((acc, t) => {
    acc[t.name] = t.handler;
    return acc;
  }, {} as Record<string, Function>)
};
