import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { ApiEndpoint } from './types.js';

/**
 * Normalizes paths to a common format.
 * Converts OpenAPI style '/users/{id}' to Express style '/users/:id'
 * and trims trailing slashes.
 */
export function normalizePath(p: string): string {
  let normalized = p.trim();
  // Ensure it starts with /
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  // Remove trailing slash if not root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // Replace {paramName} with :paramName
  normalized = normalized.replace(/\{([^}]+)\}/g, ':$1');
  return normalized;
}

export function parseOpenApi(specFilePath: string): ApiEndpoint[] {
  if (!fs.existsSync(specFilePath)) {
    throw new Error(`OpenAPI specification file not found: ${specFilePath}`);
  }

  const content = fs.readFileSync(specFilePath, 'utf-8');
  let doc: any;

  if (specFilePath.endsWith('.json')) {
    doc = JSON.parse(content);
  } else {
    doc = YAML.parse(content);
  }

  const endpoints: ApiEndpoint[] = [];
  
  // Extract global security definitions
  const hasGlobalSecurity = !!(doc.security && doc.security.length > 0);

  if (doc && doc.paths) {
    for (const [rawPath, pathItem] of Object.entries(doc.paths)) {
      if (typeof pathItem !== 'object' || pathItem === null) continue;

      const normalizedPath = normalizePath(rawPath);

      for (const [method, operation] of Object.entries(pathItem)) {
        const lowerMethod = method.toLowerCase();
        // Standard HTTP methods to scan
        if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(lowerMethod)) {
          continue;
        }

        const op = operation as any;
        
        // Auth check: check if local security is defined, or if global is defined and not overridden to []
        let hasAuth = hasGlobalSecurity;
        if (op.security) {
          hasAuth = op.security.length > 0;
        }

        // Validation check: check if it has query/path parameters with schemas, or a requestBody
        let hasValidation = false;
        if (op.requestBody && op.requestBody.content) {
          hasValidation = true;
        }
        if (op.parameters && Array.isArray(op.parameters)) {
          const hasQueryOrPathValidation = op.parameters.some((p: any) => p.required || p.schema);
          if (hasQueryOrPathValidation) {
            hasValidation = true;
          }
        }

        const responses = op.responses ? Object.keys(op.responses) : [];

        endpoints.push({
          method: lowerMethod.toUpperCase(),
          path: normalizedPath,
          description: op.summary || op.description || '',
          hasValidation,
          hasAuth,
          responses,
        });
      }
    }
  }

  return endpoints;
}
