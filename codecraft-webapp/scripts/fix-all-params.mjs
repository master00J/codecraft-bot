/**
 * Script to fix all remaining params.property usage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const routeFiles = await glob('src/app/api/**/route.ts', { cwd: rootDir });

let fixedCount = 0;

for (const file of routeFiles) {
  const filePath = path.join(rootDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Find all functions with params: Promise<{...}>
  const functionRegex = /export\s+async\s+function\s+\w+\s*\([^)]*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{([^}]+)\}>\s*\}[^)]*\)\s*\{/g;
  let match;

  while ((match = functionRegex.exec(content)) !== null) {
    const paramsList = match[1].split(',').map(p => p.trim().split(':')[0].trim());
    const functionStart = match.index;
    const functionEnd = findFunctionEnd(content, functionStart);
    const functionBody = content.substring(functionStart, functionEnd);

    // Check if await params exists
    if (functionBody.includes('await params')) {
      // Extract the destructured variables from await params
      const awaitMatch = functionBody.match(/const\s+\{([^}]+)\}\s*=\s*await\s+params/);
      if (awaitMatch) {
        const destructuredVars = awaitMatch[1].split(',').map(v => v.trim());
        
        // Replace all params.property with just property
        for (const param of paramsList) {
          if (destructuredVars.includes(param)) {
            const regex = new RegExp(`params\\.${param}\\b`, 'g');
            content = content.substring(0, functionStart) + 
                     functionBody.replace(regex, param) + 
                     content.substring(functionEnd);
            // Recalculate function end after replacement
            const newFunctionEnd = findFunctionEnd(content, functionStart);
            functionBody = content.substring(functionStart, newFunctionEnd);
          }
        }
      }
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    fixedCount++;
    console.log(`✅ Fixed: ${file}`);
  }
}

function findFunctionEnd(content, start) {
  let depth = 0;
  let inString = false;
  let stringChar = null;
  
  for (let i = start; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';
    
    // Handle strings
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      stringChar = null;
    }
    
    if (!inString) {
      if (char === '{') depth++;
      if (char === '}') {
        depth--;
        if (depth === 0) {
          return i + 1;
        }
      }
    }
  }
  
  return content.length;
}

console.log(`\n✅ Fixed ${fixedCount} files`);


