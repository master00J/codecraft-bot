/**
 * Script to fix Next.js 16 async params in route handlers
 * Run: node fix-nextjs16-params.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files
const routeFiles = glob.sync('src/app/api/**/route.ts', { cwd: __dirname });

let fixedCount = 0;

routeFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: { params }: { params: { id: string } }
  const pattern1 = /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
  if (pattern1.test(content)) {
    content = content.replace(
      /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
      (match, paramsContent) => {
        modified = true;
        return `{ params }: { params: Promise<{${paramsContent}}> }`;
      }
    );

    // Also update params.id to await params
    content = content.replace(
      /const\s+(\w+)\s*=\s*params\.(\w+)/g,
      (match, varName, paramName) => {
        // Check if we're already in an async function and haven't awaited params yet
        const beforeMatch = content.substring(0, content.indexOf(match));
        const functionStart = beforeMatch.lastIndexOf('async function');
        const functionBody = content.substring(functionStart, content.indexOf(match));
        
        if (!functionBody.includes('await params')) {
          // Add await params at the start of the function
          const functionMatch = content.match(/export\s+async\s+function\s+\w+\s*\([^)]*\)\s*\{/);
          if (functionMatch) {
            const functionStartPos = functionMatch.index + functionMatch[0].length;
            const nextLine = content.indexOf('\n', functionStartPos);
            if (nextLine !== -1) {
              const indent = content.substring(functionStartPos, nextLine).match(/^\s*/)?.[0] || '  ';
              const awaitParams = `\n${indent}const { ${paramName} } = await params;\n${indent}const ${varName} = ${paramName};`;
              content = content.substring(0, nextLine) + awaitParams + content.substring(nextLine);
              return `const ${varName} = ${paramName}`;
            }
          }
        }
        return match;
      }
    );

    // Fix direct params.id usage
    content = content.replace(
      /params\.(\w+)/g,
      (match, paramName) => {
        // Check if params is already awaited
        const beforeMatch = content.substring(0, content.indexOf(match));
        const functionStart = beforeMatch.lastIndexOf('async function');
        const functionBody = content.substring(functionStart, content.indexOf(match));
        
        if (!functionBody.includes(`const { ${paramName} } = await params`)) {
          // This is a direct usage, we need to await params first
          return paramName; // Will be replaced by the awaited version
        }
        return match;
      }
    );
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    fixedCount++;
    console.log(`Fixed: ${file}`);
  }
});

console.log(`\n✅ Fixed ${fixedCount} files`);


