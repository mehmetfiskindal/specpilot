import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { ApiEndpoint, CodeRoute, GapReport } from './types.js';

/**
 * Normalizes parameters in a path for comparison.
 * e.g., '/users/:id/posts/:postId' -> '/users/:param/posts/:param'
 */
function standardizeParametricPath(p: string): string {
  return p.replace(/:[a-zA-Z0-9_]+/g, ':param');
}

export async function analyzeGaps(
  specEndpoints: ApiEndpoint[],
  codeRoutes: CodeRoute[],
  projectRoot: string,
  testDir?: string
): Promise<GapReport> {
  const missingInCode: ApiEndpoint[] = [];
  const missingInSpec: CodeRoute[] = [];
  const missingTests: GapReport['missingTests'] = [];
  const riskyEndpoints: GapReport['riskyEndpoints'] = [];
  const suggestedTasks: string[] = [];

  // Group code routes by standardized paths
  const codeRouteMap = new Map<string, CodeRoute>();
  codeRoutes.forEach(route => {
    const key = `${route.method}:${standardizeParametricPath(route.path)}`;
    codeRouteMap.set(key, route);
  });

  // 1. Find missing in code & risks
  specEndpoints.forEach(spec => {
    const specKey = `${spec.method}:${standardizeParametricPath(spec.path)}`;
    const matchedCode = codeRouteMap.get(specKey);

    if (!matchedCode) {
      // Missing in code
      missingInCode.push(spec);
    } else {
      // Check for security mismatch
      if (spec.hasAuth && !matchedCode.hasAuth) {
        riskyEndpoints.push({
          method: spec.method,
          path: spec.path,
          reason: `Requires auth in spec, but auth middleware/guard was not detected in code.`,
          severity: 'high'
        });
      }

      // Check for validation mismatch
      if (spec.hasValidation && !matchedCode.hasValidation) {
        riskyEndpoints.push({
          method: spec.method,
          path: spec.path,
          reason: `Defines validation in spec, but input validation/Body decorator was not detected in code.`,
          severity: 'medium'
        });
      }

      // Check missing auth responses
      if (spec.hasAuth && !spec.responses.includes('401') && !spec.responses.includes('403')) {
        riskyEndpoints.push({
          method: spec.method,
          path: spec.path,
          reason: `Requires auth but does not define 401 or 403 responses in spec.`,
          severity: 'low'
        });
      }
    }
  });

  // 2. Find missing in spec (implemented in code but not in spec)
  const specEndpointMap = new Map<string, ApiEndpoint>();
  specEndpoints.forEach(spec => {
    const key = `${spec.method}:${standardizeParametricPath(spec.path)}`;
    specEndpointMap.set(key, spec);
  });

  codeRoutes.forEach(code => {
    const codeKey = `${code.method}:${standardizeParametricPath(code.path)}`;
    if (!specEndpointMap.has(codeKey)) {
      missingInSpec.push(code);
    }
  });

  // 3. Find missing test files
  // Heuristic: check if there's a test file matching the codeRoute's file name
  // e.g. for `src/controllers/user.controller.ts`, we look for `src/controllers/user.controller.spec.ts` or `src/controllers/user.controller.test.ts`
  // or inside testDir
  const checkedFiles = new Set<string>();
  
  for (const code of codeRoutes) {
    const fileBase = code.filePath;
    if (checkedFiles.has(fileBase)) continue;
    checkedFiles.add(fileBase);

    const ext = path.extname(fileBase);
    const baseNameWithoutExt = fileBase.slice(0, -ext.length);

    const testFilePatterns = [
      `${baseNameWithoutExt}.test${ext}`,
      `${baseNameWithoutExt}.spec${ext}`,
      `${baseNameWithoutExt}.test.ts`,
      `${baseNameWithoutExt}.spec.ts`,
      `${baseNameWithoutExt}.test.js`,
      `${baseNameWithoutExt}.spec.js`
    ];

    if (testDir) {
      const fileName = path.basename(baseNameWithoutExt);
      testFilePatterns.push(
        path.join(testDir, `**/${fileName}.test${ext}`),
        path.join(testDir, `**/${fileName}.spec${ext}`)
      );
    }

    let hasTest = false;
    for (const pattern of testFilePatterns) {
      const resolvedPath = path.resolve(projectRoot, pattern);
      // Simple glob/fs check
      if (fs.existsSync(resolvedPath)) {
        hasTest = true;
        break;
      }
    }

    if (!hasTest) {
      missingTests.push({
        method: code.method,
        path: code.path,
        expectedTestPath: `${baseNameWithoutExt}.test${ext}`
      });
    }
  }

  // 4. Generate suggested tasks
  let taskCounter = 1;
  missingInCode.forEach(spec => {
    suggestedTasks.push(`${taskCounter++}. Implement endpoint: ${spec.method} ${spec.path}`);
  });

  riskyEndpoints
    .filter(r => r.severity === 'high')
    .forEach(risk => {
      suggestedTasks.push(`${taskCounter++}. Fix high risk: Add auth guard/middleware to ${risk.method} ${risk.path}`);
    });

  missingTests.forEach(test => {
    suggestedTasks.push(`${taskCounter++}. Create tests: Add validation/integration test for ${test.method} ${test.path} (e.g. in ${test.expectedTestPath})`);
  });

  riskyEndpoints
    .filter(r => r.severity === 'medium')
    .forEach(risk => {
      suggestedTasks.push(`${taskCounter++}. Add validation schema to code: ${risk.method} ${risk.path}`);
    });

  return {
    missingInCode,
    missingInSpec,
    missingTests,
    riskyEndpoints,
    suggestedTasks,
  };
}
export { standardizeParametricPath };
