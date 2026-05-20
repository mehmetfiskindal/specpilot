#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import pc from 'picocolors';
import fg from 'fast-glob';
import { parseOpenApi } from '../analyzer/openapi.js';
import { detectFramework } from '../analyzer/framework-detector.js';
import { scanCodebase } from '../analyzer/code-scanner.js';
import { analyzeGaps } from '../analyzer/gap-analyzer.js';
import { SpecPilotConfig } from '../analyzer/types.js';
import { startMcpServer } from '../mcp/server.js';

const program = new Command();

program
  .name('specpilot')
  .description('AI-Powered API Gap Analysis & Developer Kit')
  .version('1.0.0');

// Command: Setup
program
  .command('setup')
  .description('Initialize SpecPilot configuration and AI developer skill')
  .option('-p, --spec <path>', 'Path to OpenAPI spec file')
  .option('-s, --src <dir>', 'Path to source code directory')
  .action(async (options) => {
    console.log(pc.cyan('🚀 Setting up SpecPilot...'));

    const configDir = path.resolve('.specpilot');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Heuristically find OpenAPI spec file
    let specPath = options.spec;
    if (!specPath) {
      const candidates = await fg(['**/openapi.{yaml,yml,json}', '**/swagger.{yaml,yml,json}', '*.{yaml,yml,json}'], {
        ignore: ['**/node_modules/**', '**/dist/**', 'package.json', 'tsconfig.json'],
        deep: 3
      });
      specPath = candidates[0] || 'openapi.yaml';
    }

    // Heuristically find source directory
    let srcDir = options.src;
    if (!srcDir) {
      if (fs.existsSync('src')) {
        srcDir = 'src';
      } else if (fs.existsSync('lib')) {
        srcDir = 'lib';
      } else {
        srcDir = '.';
      }
    }

    // Detect framework
    const framework = detectFramework('.');

    const config: SpecPilotConfig = {
      specPath: path.relative('.', specPath),
      srcDir: path.relative('.', srcDir),
      framework,
      exclude: ['**/node_modules/**', '**/dist/**']
    };

    // Write config file
    const configPath = path.join(configDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(pc.green(`✔ Created config file at ${configPath}`));

    // Write AI Skill Prompt
    const skillPath = path.join(configDir, 'specpilot-skill.md');
    const skillContent = `# SpecPilot AI Developer Skill

This skill guides AI coding assistants to enforce OpenAPI-first coding practices.

## How to use SpecPilot
1. Always analyze API compliance before starting code modifications.
2. Run \`specpilot analyze\` to view the API Gap Report.
3. Fix issues listed in the "Suggested Next Tasks" in order:
   - **Missing in code**: Build missing endpoints exactly according to the spec definitions.
   - **Risky endpoints**: Ensure auth middleware (Guards) and validation pipelines match schemas.
   - **Missing tests**: Create corresponding unit/integration tests.
4. After implementation, run \`specpilot analyze\` again to verify zero contract gaps.
`;

    fs.writeFileSync(skillPath, skillContent, 'utf-8');
    console.log(pc.green(`✔ Created AI Developer Skill prompt at ${skillPath}`));
    console.log(pc.bold(pc.magenta('\nSpecPilot is ready! Run "npx specpilot analyze" to check API gap analysis.')));
  });

// Command: Analyze
program
  .command('analyze')
  .description('Compare OpenAPI spec with source code and generate gap report')
  .option('-c, --config <path>', 'Path to config JSON', '.specpilot/config.json')
  .option('-o, --output <path>', 'Save report to Markdown file', '.specpilot/api-gap-report.md')
  .action(async (options) => {
    const configPath = path.resolve(options.config);
    let config: SpecPilotConfig;

    if (!fs.existsSync(configPath)) {
      console.log(pc.yellow(`⚠️ Config file not found at ${options.config}. Running autodetect defaults...`));
      config = {
        specPath: 'openapi.yaml',
        srcDir: 'src',
        framework: detectFramework('.'),
        exclude: []
      };
    } else {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    console.log(pc.cyan(`🔍 Analyzing API gaps...`));
    console.log(`Spec file: ${pc.bold(config.specPath)}`);
    console.log(`Src directory: ${pc.bold(config.srcDir)}`);
    console.log(`Framework: ${pc.bold(config.framework.toUpperCase())}\n`);

    try {
      const specEndpoints = parseOpenApi(config.specPath);
      const codeRoutes = await scanCodebase(config, '.');
      const report = await analyzeGaps(specEndpoints, codeRoutes, '.', config.testDir);

      // Print output
      console.log(pc.bold(pc.white('=== API GAP REPORT ===\n')));

      if (report.missingInCode.length > 0) {
        console.log(pc.red(pc.bold('❌ Missing in Code (OpenAPI spec has these, but code does not):')));
        report.missingInCode.forEach(endpoint => {
          console.log(`  - ${pc.bold(endpoint.method)} ${endpoint.path} (${endpoint.description || 'No description'})`);
        });
        console.log();
      } else {
        console.log(pc.green('✔ All spec endpoints are implemented in code.\n'));
      }

      if (report.missingInSpec.length > 0) {
        console.log(pc.yellow(pc.bold('⚠️ Missing in OpenAPI Spec (Code has these, but spec does not):')));
        report.missingInSpec.forEach(route => {
          console.log(`  - ${pc.bold(route.method)} ${route.path} (at ${route.filePath}:${route.line})`);
        });
        console.log();
      }

      if (report.missingTests.length > 0) {
        console.log(pc.cyan(pc.bold('🧪 Missing Tests (Implemented endpoints without matching test files):')));
        report.missingTests.forEach(test => {
          console.log(`  - ${pc.bold(test.method)} ${test.path} (Expected: ${test.expectedTestPath})`);
        });
        console.log();
      }

      if (report.riskyEndpoints.length > 0) {
        console.log(pc.magenta(pc.bold('⚡ Risky Endpoints (Contract mismatches / Security risks):')));
        report.riskyEndpoints.forEach(risk => {
          const color = risk.severity === 'high' ? pc.red : (risk.severity === 'medium' ? pc.yellow : pc.cyan);
          console.log(`  - [${color(risk.severity.toUpperCase())}] ${pc.bold(risk.method)} ${risk.path}: ${risk.reason}`);
        });
        console.log();
      }

      if (report.suggestedTasks.length > 0) {
        console.log(pc.bold(pc.blue('📋 Suggested Next Tasks:')));
        report.suggestedTasks.forEach(task => {
          console.log(`  ${task}`);
        });
        console.log();
      }

      // Write markdown file if output target path is set
      if (options.output) {
        const mdReport = generateMarkdownReport(config, report);
        const outDir = path.dirname(options.output);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(options.output, mdReport, 'utf-8');
        console.log(pc.gray(`Report saved to ${options.output}`));
      }

    } catch (err: any) {
      console.error(pc.red(`Error during analysis: ${err.message}`));
      process.exit(1);
    }
  });

// Command: MCP Server
program
  .command('mcp')
  .description('Run SpecPilot as an MCP Server')
  .action(() => {
    // Start MCP Server on Stdio transport
    startMcpServer();
  });

// Run
program.parse(process.argv);

function generateMarkdownReport(config: SpecPilotConfig, report: any): string {
  let md = `# API Gap Report - SpecPilot\n\n`;
  md += `*Generated on ${new Date().toISOString()}*\n`;
  md += `- **Spec file**: \`${config.specPath}\`\n`;
  md += `- **Source folder**: \`${config.srcDir}\`\n`;
  md += `- **Framework**: \`${config.framework.toUpperCase()}\`\n\n`;

  md += `## Missing in Code\n`;
  if (report.missingInCode.length === 0) {
    md += `✔ All spec endpoints are implemented in code.\n\n`;
  } else {
    md += `| Method | Path | Description |\n|---|---|---|\n`;
    report.missingInCode.forEach((e: any) => {
      md += `| \`${e.method}\` | \`${e.path}\` | ${e.description || 'No description'} |\n`;
    });
    md += `\n`;
  }

  md += `## Missing in OpenAPI Spec\n`;
  if (report.missingInSpec.length === 0) {
    md += `✔ No extra endpoints found in code.\n\n`;
  } else {
    md += `| Method | Path | Code Location |\n|---|---|---|\n`;
    report.missingInSpec.forEach((r: any) => {
      md += `| \`${r.method}\` | \`${r.path}\` | [\`${r.filePath}:${r.line}\`](file://${path.resolve(r.filePath)}) |\n`;
    });
    md += `\n`;
  }

  md += `## Missing Tests\n`;
  if (report.missingTests.length === 0) {
    md += `✔ All routes have test coverage heuristics.\n\n`;
  } else {
    md += `| Method | Path | Expected Test Location |\n|---|---|---|\n`;
    report.missingTests.forEach((t: any) => {
      md += `| \`${t.method}\` | \`${t.path}\` | \`${t.expectedTestPath}\` |\n`;
    });
    md += `\n`;
  }

  md += `## Risky Endpoints\n`;
  if (report.riskyEndpoints.length === 0) {
    md += `✔ No contract risks detected.\n\n`;
  } else {
    md += `| Severity | Method | Path | Mismatch Issue |\n|---|---|---|---|\n`;
    report.riskyEndpoints.forEach((r: any) => {
      md += `| **${r.severity.toUpperCase()}** | \`${r.method}\` | \`${r.path}\` | ${r.reason} |\n`;
    });
    md += `\n`;
  }

  md += `## Suggested Next Tasks\n`;
  if (report.suggestedTasks.length === 0) {
    md += `✔ API is fully in sync. Ready to deploy!\n`;
  } else {
    report.suggestedTasks.forEach((task: string) => {
      md += `- ${task}\n`;
    });
  }

  return md;
}
