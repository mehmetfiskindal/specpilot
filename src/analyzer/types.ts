export interface SpecPilotConfig {
  specPath: string;      // Path to OpenAPI specification file (e.g. openapi.yaml)
  srcDir: string;        // Path to code directory (e.g. ./src)
  framework: 'express' | 'nestjs' | 'auto';
  exclude: string[];     // Glob patterns to exclude (e.g. ['**/node_modules/**', '**/*.test.ts'])
  testDir?: string;      // Path to tests (e.g. ./tests)
  docOutputPath?: string; // Path to save generated client documentation
  clientLanguage?: 'typescript' | 'kotlin' | 'swift';
}

export interface ApiEndpoint {
  method: string;        // GET, POST, PUT, DELETE, etc. (normalized to uppercase)
  path: string;          // Normalized path (e.g., /users/:id or /users/{id})
  description?: string;
  hasValidation: boolean;
  hasAuth: boolean;
  responses: string[];   // Response status codes, e.g. ["200", "401"]
}

export interface CodeRoute {
  method: string;
  path: string;          // Normalized path
  filePath: string;
  line: number;
  hasValidation: boolean;
  hasAuth: boolean;
}

export interface GapReport {
  missingInCode: ApiEndpoint[];
  missingInSpec: CodeRoute[];
  missingTests: { method: string; path: string; expectedTestPath?: string }[];
  riskyEndpoints: {
    method: string;
    path: string;
    reason: string;
    severity: 'high' | 'medium' | 'low';
  }[];
  suggestedTasks: string[];
}
