import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { CodeRoute, SpecPilotConfig } from './types.js';
import { normalizePath } from './openapi.js';

export async function scanCodebase(config: SpecPilotConfig, projectRoot: string): Promise<CodeRoute[]> {
  const absoluteSrcDir = path.resolve(projectRoot, config.srcDir);
  const excludePatterns = config.exclude || [];
  
  // Build glob pattern for files
  const globPattern = '**/*.{ts,js}';
  const ignorePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.test.{ts,js}',
    '**/*.spec.{ts,js}',
    ...excludePatterns
  ];

  const files = await fg(globPattern, {
    cwd: absoluteSrcDir,
    absolute: true,
    ignore: ignorePatterns
  });

  const routes: CodeRoute[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(projectRoot, file);

    if (config.framework === 'nestjs') {
      scanNestJSFile(content, relativePath, routes);
    } else {
      scanExpressFile(content, relativePath, routes);
    }
  }

  return routes;
}

function scanExpressFile(content: string, relativePath: string, routes: CodeRoute[]) {
  const lines = content.split('\n');
  
  // Matches: app.get('/users', ...), router.post('/login', ...), route.put('/path', ...)
  // Captures method: group 1, path: group 2
  const expressRegex = /(?:app|router|route|express)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i;

  lines.forEach((line, idx) => {
    const match = expressRegex.exec(line);
    if (match) {
      const method = match[1].toUpperCase();
      const rawPath = match[2];
      const normalizedPath = normalizePath(rawPath);
      const lineNumber = idx + 1;

      // Look at the line content for simple middleware checks
      // e.g. auth, validate, passport, jwt, schema, body, check
      const lowerLine = line.toLowerCase();
      const hasAuth = /auth|passport|jwt|guard/i.test(lowerLine);
      const hasValidation = /validate|schema|body|check|validation/i.test(lowerLine);

      // Check if duplicate route/method already scanned in this file/line
      const exists = routes.some(r => r.method === method && r.path === normalizedPath && r.filePath === relativePath && r.line === lineNumber);
      if (!exists) {
        routes.push({
          method,
          path: normalizedPath,
          filePath: relativePath,
          line: lineNumber,
          hasAuth,
          hasValidation,
        });
      }
    }
  });
}

function scanNestJSFile(content: string, relativePath: string, routes: CodeRoute[]) {
  const lines = content.split('\n');
  
  let currentControllerPrefix: string | null = null;
  let controllerLineNumber = 0;

  // Regex to find Controller class declaration decorator
  const controllerRegex = /@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/;
  
  // Regex to find HTTP methods decorators
  const methodDecoratorRegex = /@(Get|Post|Put|Delete|Patch)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/;

  lines.forEach((line, idx) => {
    const controllerMatch = controllerRegex.exec(line);
    if (controllerMatch) {
      currentControllerPrefix = controllerMatch[1] || '';
      controllerLineNumber = idx + 1;
      return;
    }

    if (currentControllerPrefix !== null) {
      const methodMatch = methodDecoratorRegex.exec(line);
      if (methodMatch) {
        const method = methodMatch[1].toUpperCase();
        const subPath = methodMatch[2] || '';
        
        // Assemble absolute route path
        const rawPath = currentControllerPrefix + '/' + subPath;
        const normalizedPath = normalizePath(rawPath);
        const lineNumber = idx + 1;

        // Context search: scan surrounding lines (say 3 lines above, 5 lines below the decorator)
        // to see if we have Guards, Roles, Validation pipes, or Body decorators
        const contextLines = lines.slice(Math.max(0, idx - 4), Math.min(lines.length, idx + 6));
        const contextText = contextLines.join('\n');

        const hasAuth = /@UseGuards\b|@Auth\b|@Roles\b|passport|jwt/i.test(contextText);
        const hasValidation = /@Body\b|@Query\b|ValidationPipe|@Param\b|validate|schema/i.test(contextText);

        routes.push({
          method,
          path: normalizedPath,
          filePath: relativePath,
          line: lineNumber,
          hasAuth,
          hasValidation,
        });
      }
    }
  });
}
