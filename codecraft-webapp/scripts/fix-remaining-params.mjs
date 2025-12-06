/**
 * Script to fix remaining direct params.property usage in Next.js 16
 * Run: node scripts/fix-remaining-params.mjs
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
  let modified = false;
  const originalContent = content;

  // Check if file has params: Promise<...> but still uses params.property
  if (content.includes('params: Promise<') && content.match(/params\.\w+/)) {
    // Find all function signatures with params: Promise<...>
    const functionPattern = /export\s+async\s+function\s+(\w+)\s*\([^)]*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{([^}]+)\}>\s*\}[^)]*\)\s*\{/g;
    let functionMatch;
    
    while ((functionMatch = functionPattern.exec(content)) !== null) {
      const functionName = functionMatch[1];
      const paramsList = functionMatch[2].split(',').map(p => p.trim().split(':')[0].trim());
      
      // Find the function body
      const functionStart = functionMatch.index;
      const functionBodyStart = functionMatch.index + functionMatch[0].length;
      
      // Find the opening brace and get indentation
      const afterBrace = content.substring(functionBodyStart);
      const firstLineMatch = afterBrace.match(/^(\s*)/);
      const indent = firstLineMatch ? firstLineMatch[1] : '  ';
      
      // Check if params is already awaited
      const functionBody = content.substring(functionBodyStart);
      const hasAwaitParams = functionBody.includes('await params') || 
                            functionBody.includes(`const { ${paramsList[0]} } = await params`);
      
      if (!hasAwaitParams) {
        // Add await params at the start of function
        const awaitLine = `\n${indent}const { ${paramsList.join(', ')} } = await params;\n`;
        content = content.substring(0, functionBodyStart) + awaitLine + content.substring(functionBodyStart);
        modified = true;
      }
    }

    // Replace all direct params.property usage with just property (assuming await params was added)
    // But only if await params exists in the function
    const lines = content.split('\n');
    const newLines = [];
    let inFunction = false;
    let hasAwaitParams = false;
    let paramsVars = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if we're entering a function with params: Promise<...>
      if (line.match(/export\s+async\s+function.*params:\s*Promise</)) {
        inFunction = true;
        hasAwaitParams = false;
        paramsVars = [];
        // Extract param names from Promise<{ param1: type, param2: type }>
        const paramsMatch = line.match(/Promise<\{([^}]+)\}>/);
        if (paramsMatch) {
          paramsVars = paramsMatch[1].split(',').map(p => p.trim().split(':')[0].trim());
        }
      }
      
      // Check if we're leaving the function
      if (inFunction && line.match(/^\s*\}\s*$/)) {
        inFunction = false;
        hasAwaitParams = false;
        paramsVars = [];
      }
      
      // Check if await params exists in this function
      if (inFunction && line.includes('await params')) {
        hasAwaitParams = true;
      }
      
      // Replace params.property with just property if await params exists
      if (inFunction && hasAwaitParams && paramsVars.length > 0) {
        for (const paramVar of paramsVars) {
          const regex = new RegExp(`params\\.${paramVar}\\b`, 'g');
          if (regex.test(line)) {
            const newLine = line.replace(regex, paramVar);
            newLines.push(newLine);
            modified = true;
            continue;
          }
        }
      }
      
      if (!modified || !line.match(/params\.\w+/)) {
        newLines.push(line);
      }
    }
    
    if (modified) {
      content = newLines.join('\n');
    }
  }

  if (modified && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    fixedCount++;
    console.log(`✅ Fixed: ${file}`);
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);


