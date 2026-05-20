import fs from 'fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SpecPilotConfig } from '../analyzer/types.js';
import { parseOpenApi } from '../analyzer/openapi.js';
import { scanCodebase } from '../analyzer/code-scanner.js';
import { analyzeGaps } from '../analyzer/gap-analyzer.js';
import { detectFramework } from '../analyzer/framework-detector.js';

export function startMcpServer() {
  const server = new Server(
    {
      name: 'specpilot',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'analyze_openapi',
          description: 'Analyzes the codebase against the OpenAPI specification to report missing endpoints, extra routes in code, validation/auth risks, and suggested tasks.',
          inputSchema: {
            type: 'object',
            properties: {
              specPath: { type: 'string', description: 'Override path to the OpenAPI specification (e.g. openapi.yaml)' },
              srcDir: { type: 'string', description: 'Override path to the source folder (e.g. src)' },
              framework: { type: 'string', enum: ['express', 'nestjs'], description: 'Override backend framework' }
            }
          }
        },
        {
          name: 'find_missing_tests',
          description: 'Finds implemented backend API routes that lack corresponding unit or integration test files.',
          inputSchema: {
            type: 'object',
            properties: {
              specPath: { type: 'string', description: 'Override path to the OpenAPI specification (e.g. openapi.yaml)' },
              srcDir: { type: 'string', description: 'Override path to the source folder (e.g. src)' },
              framework: { type: 'string', enum: ['express', 'nestjs'], description: 'Override backend framework' }
            }
          }
        }
      ]
    };
  });

  // Handle tool execution calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Load default config
    let config: SpecPilotConfig = {
      specPath: 'openapi.yaml',
      srcDir: 'src',
      framework: 'express',
      exclude: ['**/node_modules/**', '**/dist/**']
    };

    if (fs.existsSync('.specpilot/config.json')) {
      try {
        const fileContent = fs.readFileSync('.specpilot/config.json', 'utf-8');
        config = JSON.parse(fileContent);
      } catch {
        // Fallback to defaults
      }
    } else {
      // Autodetect if no config
      config.framework = detectFramework('.');
    }

    // Override with arguments if present
    if (args) {
      if (typeof args.specPath === 'string') config.specPath = args.specPath;
      if (typeof args.srcDir === 'string') config.srcDir = args.srcDir;
      if (args.framework === 'express' || args.framework === 'nestjs') config.framework = args.framework;
    }

    try {
      if (name === 'analyze_openapi') {
        const specEndpoints = parseOpenApi(config.specPath);
        const codeRoutes = await scanCodebase(config, '.');
        const report = await analyzeGaps(specEndpoints, codeRoutes, '.', config.testDir);

        let text = `## SpecPilot API Gap Report\n\n`;

        text += `### ❌ Missing in Code:\n`;
        if (report.missingInCode.length === 0) {
          text += `* None. All spec endpoints are implemented in code.\n`;
        } else {
          report.missingInCode.forEach(e => {
            text += `- **${e.method}** \`${e.path}\` - *${e.description || 'No description'}*\n`;
          });
        }

        text += `\n### ⚠️ Missing in OpenAPI Spec:\n`;
        if (report.missingInSpec.length === 0) {
          text += `* None. No extra undocumented routes found in code.\n`;
        } else {
          report.missingInSpec.forEach(r => {
            text += `- **${r.method}** \`${r.path}\` (implemented at \`${r.filePath}:${r.line}\`)\n`;
          });
        }

        text += `\n### ⚡ Risks & Inconsistencies:\n`;
        if (report.riskyEndpoints.length === 0) {
          text += `* None. All matched endpoints conform to specifications.\n`;
        } else {
          report.riskyEndpoints.forEach(r => {
            text += `- [${r.severity.toUpperCase()}] **${r.method}** \`${r.path}\`: ${r.reason}\n`;
          });
        }

        text += `\n### 📋 Suggested Next Tasks:\n`;
        if (report.suggestedTasks.length === 0) {
          text += `* API is 100% compliant. No tasks needed!\n`;
        } else {
          report.suggestedTasks.forEach(task => {
            text += `- ${task}\n`;
          });
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      if (name === 'find_missing_tests') {
        const specEndpoints = parseOpenApi(config.specPath);
        const codeRoutes = await scanCodebase(config, '.');
        const report = await analyzeGaps(specEndpoints, codeRoutes, '.', config.testDir);

        let text = `## SpecPilot Missing Tests Report\n\n`;
        if (report.missingTests.length === 0) {
          text += `✔ All implemented routes have matching test file heuristics.\n`;
        } else {
          report.missingTests.forEach(t => {
            text += `- **${t.method}** \`${t.path}\` (Expected test file: \`${t.expectedTestPath}\`)\n`;
          });
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error during MCP execution: ${err.message}` }]
      };
    }
  });

  // Handle transport setup
  const transport = new StdioServerTransport();
  
  // Gracefully handle close/termination
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
  
  server.connect(transport).catch(async (error) => {
    console.error("Failed to connect transport:", error);
    await server.close();
    process.exit(1);
  });
}
