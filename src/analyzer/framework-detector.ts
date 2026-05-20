import fs from 'fs';
import path from 'path';

export function detectFramework(projectRoot: string): 'express' | 'nestjs' {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['@nestjs/core'] || deps['@nestjs/common']) {
        return 'nestjs';
      }
      if (deps['express']) {
        return 'express';
      }
    } catch {
      // Ignore JSON parsing errors
    }
  }

  // Fallback heuristic: check if any controller decorator or express import exists in src files
  // For simplicity, default to Express if undetermined
  return 'express';
}
