/**
 * Script to fix all direct params.property usage in Next.js 16
 * This script finds all functions with params: Promise<...> and ensures
 * params are awaited and all params.property references are replaced
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Find all route.ts files
const routeFiles = await glob('src/app/api/**/route.ts', { cwd: rootDir });

let fixedCount = 0;

for (const file of routeFiles) {
  const filePath = path.join(rootDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Only process files that have params: Promise<...>
  if (!content.includes('params: Promise<')) {
    continue;
  }

  // Find all function signatures with params: Promise<...>
  const functionPattern = /export\s+async\s+function\s+(\w+)\s*\([^)]*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{([^}]+)\}>\s*\}[^)]*\)\s*\{/g;
  let modified = false;
  let functionMatch;

  while ((functionMatch = functionPattern.exec(content)) !== null) {
    const functionStart = functionMatch.index;
    const functionBodyStart = functionStart + functionMatch[0].length;
    
    // Extract param names from Promise<{ param1: type, param2: type }>
    const paramsList = functionMatch[2]
      .split(',')
      .map(p => p.trim().split(':')[0].trim())
      .filter(p => p.length > 0);

    if (paramsList.length === 0) continue;

    // Get function body - find the matching closing brace
    let braceCount = 1;
    let functionEnd = functionBodyStart;
    for (let i = functionBodyStart; i < content.length && braceCount > 0; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0) {
        functionEnd = i;
        break;
      }
    }

    const functionBody = content.substring(functionBodyStart, functionEnd);
    
    // Check if params is already awaited
    const awaitPattern = new RegExp(`const\\s+\\{\\s*${paramsList.join('\\s*,\\s*')}\\s*\\}\\s*=\\s*await\\s+params`, 's');
    const hasAwaitParams = awaitPattern.test(functionBody) || 
                          functionBody.includes('await params');

    // Check if params.property is used
    const hasParamsUsage = paramsList.some(param => 
      new RegExp(`params\\.${param}\\b`).test(functionBody)
    );

    if (!hasParamsUsage) continue;

    // If params not awaited, add it
    if (!hasAwaitParams) {
      // Find the first line after function signature
      const afterBrace = content.substring(functionBodyStart);
      const firstLineMatch = afterBrace.match(/^(\s*)/);
      const indent = firstLineMatch ? firstLineMatch[1] : '  ';
      
      const awaitLine = `\n${indent}const { ${paramsList.join(', ')} } = await params;\n`;
      content = content.substring(0, functionBodyStart) + awaitLine + content.substring(functionBodyStart);
      modified = true;
      
      // Update functionEnd since we added content
      functionEnd += awaitLine.length;
    }

    // Replace all params.property with just property
    for (const param of paramsList) {
      const regex = new RegExp(`params\\.${param}\\b`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, param);
        modified = true;
      }
    }
  }

  if (modified && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    fixedCount++;
    console.log(`✅ Fixed: ${file}`);
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);

