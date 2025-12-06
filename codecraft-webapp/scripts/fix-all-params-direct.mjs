/**
 * Script to fix all direct params destructuring without await
 * This finds all instances where params is destructured without await
 * and removes the duplicate destructuring if params was already awaited
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
    
    // Check if params is already awaited at the start
    const awaitPattern = new RegExp(`const\\s+\\{\\s*([^}]+)\\s*\\}\\s*=\\s*await\\s+params`, 's');
    const awaitMatch = functionBody.match(awaitPattern);
    
    if (awaitMatch) {
      // Extract which params were already awaited
      const awaitedParams = awaitMatch[1].split(',').map(p => p.trim().split(':')[0].trim());
      
      // Find all direct destructuring of params without await
      const directDestructPattern = new RegExp(`const\\s+\\{\\s*([^}]+)\\s*\\}\\s*=\\s*params;`, 'g');
      let directMatch;
      
      while ((directMatch = directDestructPattern.exec(functionBody)) !== null) {
        const destructuredParams = directMatch[1].split(',').map(p => p.trim().split(':')[0].trim());
        
        // Check if all destructured params were already awaited
        const allAwaited = destructuredParams.every(p => awaitedParams.includes(p));
        
        if (allAwaited) {
          // Remove this line - it's a duplicate
          const matchStart = functionBodyStart + directMatch.index;
          const matchEnd = matchStart + directMatch[0].length;
          
          // Find the line boundaries
          let lineStart = matchStart;
          while (lineStart > 0 && content[lineStart - 1] !== '\n') {
            lineStart--;
          }
          let lineEnd = matchEnd;
          while (lineEnd < content.length && content[lineEnd] !== '\n') {
            lineEnd++;
          }
          if (lineEnd < content.length && content[lineEnd] === '\n') {
            lineEnd++;
          }
          
          // Remove the entire line including newline
          content = content.substring(0, lineStart) + content.substring(lineEnd);
          modified = true;
          
          // Update functionEnd since we removed content
          functionEnd -= (lineEnd - lineStart);
        }
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

