import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { normalizePath } from './openapi.js';

/**
 * Resolves a schema's type to a TypeScript representation.
 */
function resolveTSType(schema: any): string {
  if (!schema) return 'any';
  
  if (schema.$ref) {
    const parts = schema.$ref.split('/');
    return parts[parts.length - 1];
  }
  
  if (schema.oneOf || schema.anyOf) {
    const list = schema.oneOf || schema.anyOf;
    return list.map((s: any) => resolveTSType(s)).join(' | ');
  }
  
  if (schema.allOf) {
    return schema.allOf.map((s: any) => resolveTSType(s)).join(' & ');
  }
  
  switch (schema.type) {
    case 'string':
      if (schema.enum && Array.isArray(schema.enum)) {
        return schema.enum.map((v: any) => typeof v === 'string' ? `'${v}'` : String(v)).join(' | ');
      }
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      const itemType = resolveTSType(schema.items);
      // Use parenthesization for union types in array: (string | number)[]
      return itemType.includes('|') ? `(${itemType})[]` : `${itemType}[]`;
    case 'object':
      if (schema.properties) {
        let lines = '{\n';
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const isRequired = schema.required && schema.required.includes(propName);
          const opt = isRequired ? '' : '?';
          const typeStr = resolveTSType(propSchema);
          
          // Format type nested rows indentation
          const indentedType = typeStr.split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n');
          lines += `  ${propName}${opt}: ${indentedType};\n`;
        }
        lines += '}';
        return lines;
      }
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

/**
 * Recursively generates sample mockup JSON values based on the OpenAPI schema.
 */
function generateSampleJSON(schema: any, schemasSection: any): any {
  if (!schema) return null;
  
  if (schema.$ref) {
    const parts = schema.$ref.split('/');
    const refName = parts[parts.length - 1];
    const refSchema = schemasSection?.[refName];
    if (refSchema) {
      return generateSampleJSON(refSchema, schemasSection);
    }
    return {};
  }
  
  if (schema.oneOf || schema.anyOf) {
    const first = (schema.oneOf || schema.anyOf)[0];
    return generateSampleJSON(first, schemasSection);
  }
  
  if (schema.allOf) {
    let merged = {};
    schema.allOf.forEach((s: any) => {
      merged = { ...merged, ...generateSampleJSON(s, schemasSection) };
    });
    return merged;
  }
  
  switch (schema.type) {
    case 'string':
      if (schema.enum && schema.enum.length > 0) return schema.enum[0];
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'email') return 'user@example.com';
      return 'string';
    case 'number':
    case 'integer':
      return 123;
    case 'boolean':
      return true;
    case 'array':
      return [generateSampleJSON(schema.items, schemasSection)];
    case 'object':
      const obj: any = {};
      if (schema.properties) {
        for (const [key, val] of Object.entries(schema.properties)) {
          obj[key] = generateSampleJSON(val, schemasSection);
        }
      }
      return obj;
    default:
      return {};
  }
}

export function generateClientDocs(specFilePath: string): string {
  if (!fs.existsSync(specFilePath)) {
    throw new Error(`OpenAPI spec file not found: ${specFilePath}`);
  }

  const content = fs.readFileSync(specFilePath, 'utf-8');
  let doc: any;

  if (specFilePath.endsWith('.json')) {
    doc = JSON.parse(content);
  } else {
    doc = YAML.parse(content);
  }

  const schemas = doc.components?.schemas || {};
  const paths = doc.paths || {};
  const title = doc.info?.title || 'API Specification';
  const description = doc.info?.description || 'Client integration guide and endpoints contract reference.';
  const version = doc.info?.version || '1.0.0';

  let md = `# ${title} - Client Integration Guide\n\n`;
  md += `> **API Version**: \`${version}\`\n`;
  md += `> **Generated on**: ${new Date().toLocaleDateString()}\n\n`;
  md += `${description}\n\n`;

  // 1. Authentication section
  const securitySchemes = doc.components?.securitySchemes || {};
  if (Object.keys(securitySchemes).length > 0) {
    md += `## 🔒 Authentication\n\n`;
    for (const [schemeName, scheme] of Object.entries(securitySchemes)) {
      const s = scheme as any;
      md += `### ${schemeName}\n`;
      md += `- **Type**: \`${s.type}\`\n`;
      if (s.scheme) md += `- **Scheme**: \`${s.scheme}\`\n`;
      if (s.bearerFormat) md += `- **Bearer Format**: \`${s.bearerFormat}\`\n`;
      if (s.in) md += `- **Location**: \`${s.in}\`\n`;
      if (s.name) md += `- **Header/Query Name**: \`${s.name}\`\n`;
      md += `\nExample Authentication Header:\n`;
      md += `\`\`\`http\nAuthorization: Bearer <your-token-here>\n\`\`\`\n\n`;
    }
  }

  // 2. TypeScript Types definitions
  if (Object.keys(schemas).length > 0) {
    md += `## 📦 Data Models (TypeScript Types)\n\n`;
    md += `Copy-paste these interface definitions directly into your frontend or mobile API models file:\n\n`;
    md += `\`\`\`typescript\n`;
    
    for (const [schemaName, schema] of Object.entries(schemas)) {
      const typeDefinition = resolveTSType(schema);
      if (typeDefinition.startsWith('{')) {
        md += `export interface ${schemaName} ${typeDefinition}\n\n`;
      } else {
        md += `export type ${schemaName} = ${typeDefinition};\n\n`;
      }
    }
    
    md += `\`\`\`\n\n`;
  }

  // 3. API Endpoint Reference
  md += `## 🔌 Endpoint Reference\n\n`;
  
  for (const [rawPath, pathItem] of Object.entries(paths)) {
    if (typeof pathItem !== 'object' || pathItem === null) continue;
    
    const normalizedPath = normalizePath(rawPath);
    
    for (const [method, operation] of Object.entries(pathItem)) {
      const lowerMethod = method.toLowerCase();
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(lowerMethod)) continue;
      
      const op = operation as any;
      const endpointName = op.summary || op.description || `${method.toUpperCase()} ${normalizedPath}`;
      
      md += `### ${endpointName}\n`;
      md += `\`${method.toUpperCase()}\` \`${normalizedPath}\`\n\n`;
      
      if (op.description && op.summary) {
        md += `${op.description}\n\n`;
      }

      // Security requirements
      const requiresAuth = !!(op.security && op.security.length > 0) || (doc.security && doc.security.length > 0 && op.security !== null);
      md += `- **Authentication**: ${requiresAuth ? '🔑 Required' : '🌐 Public (No authentication)'}\n`;
      
      // Path / Query parameters
      if (op.parameters && Array.isArray(op.parameters)) {
        md += `\n#### Parameters\n\n`;
        md += `| Name | In | Type | Required | Description |\n|---|---|---|---|---|\n`;
        op.parameters.forEach((p: any) => {
          const typeName = p.schema ? resolveTSType(p.schema) : 'string';
          md += `| \`${p.name}\` | ${p.in} | \`${typeName}\` | ${p.required ? '✅ Yes' : 'No'} | ${p.description || '-'} |\n`;
        });
        md += `\n`;
      }

      // Request Body
      if (op.requestBody) {
        md += `\n#### Request Body\n\n`;
        const contentTypes = op.requestBody.content || {};
        for (const [contentType, mediaType] of Object.entries(contentTypes)) {
          const m = mediaType as any;
          md += `- **Content-Type**: \`${contentType}\`\n`;
          if (m.schema) {
            const schemaRef = resolveTSType(m.schema);
            md += `- **Schema Model**: \`${schemaRef}\`\n\n`;
            
            // Generate request body example payload
            const samplePayload = generateSampleJSON(m.schema, schemas);
            md += `Request Example:\n`;
            md += `\`\`\`json\n${JSON.stringify(samplePayload, null, 2)}\n\`\`\`\n\n`;
          }
        }
      }

      // Response structures
      if (op.responses) {
        md += `\n#### Responses\n\n`;
        md += `| Status Code | Description | Model Schema |\n|---|---|---|\n`;
        
        const responseEntries = Object.entries(op.responses);
        responseEntries.forEach(([statusCode, r]: [string, any]) => {
          let modelStr = '-';
          if (r.content) {
            const firstContent = Object.values(r.content)[0] as any;
            if (firstContent && firstContent.schema) {
              modelStr = `\`${resolveTSType(firstContent.schema)}\``;
            }
          }
          md += `| \`${statusCode}\` | ${r.description || '-'} | ${modelStr} |\n`;
        });
        md += `\n`;

        // Generate response JSON examples
        responseEntries.forEach(([statusCode, r]: [string, any]) => {
          if (r.content) {
            const firstContent = Object.values(r.content)[0] as any;
            if (firstContent && firstContent.schema) {
              const sampleResponse = generateSampleJSON(firstContent.schema, schemas);
              md += `Response Example (\`${statusCode}\`):\n`;
              md += `\`\`\`json\n${JSON.stringify(sampleResponse, null, 2)}\n\`\`\`\n\n`;
            }
          }
        });
      }
      
      md += `***\n\n`;
    }
  }

  return md;
}
