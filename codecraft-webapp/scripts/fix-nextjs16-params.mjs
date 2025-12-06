/**
 * Script to fix Next.js 16 async params in route handlers
 * Run: node scripts/fix-nextjs16-params.mjs
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

  // Pattern: { params }: { params: { ... } }
  const paramsPattern = /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
  
  if (paramsPattern.test(content)) {
    // Replace params type to Promise
    content = content.replace(
      /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
      (match, paramsContent) => {
        modified = true;
        return `{ params }: { params: Promise<{${paramsContent}}> }`;
      }
    );

    // Find all function signatures that use params
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
      const hasAwaitParams = functionBody.includes('await params') || functionBody.includes(`const { ${paramsList[0]} } = await params`);
      
      if (!hasAwaitParams) {
        // Add await params at the start of function
        const awaitLine = `\n${indent}const { ${paramsList.join(', ')} } = await params;\n`;
        content = content.substring(0, functionBodyStart) + awaitLine + content.substring(functionBodyStart);
        modified = true;
      }
    }

    // Fix direct params.property usage (if not already fixed)
    const directUsagePattern = /params\.(\w+)/g;
    const directUsages = [...content.matchAll(directUsagePattern)];
    
    for (const usage of directUsages) {
      const paramName = usage[1];
      const usageIndex = usage.index;
      
      // Check if this is inside a function that already has await params
      const beforeUsage = content.substring(0, usageIndex);
      const functionStart = beforeUsage.lastIndexOf('export async function');
      if (functionStart !== -1) {
        const functionBody = content.substring(functionStart, usageIndex);
        if (!functionBody.includes(`const { ${paramName} } = await params`)) {
          // This is a direct usage that needs to be fixed
          // We'll replace it with the variable name (assuming await params was added)
          // But we need to be careful - this is complex, so we'll just log it
          console.log(`⚠️  Direct params.${paramName} usage in ${file} - may need manual fix`);
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


