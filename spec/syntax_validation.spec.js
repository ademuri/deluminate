import { describe, it } from 'mocha';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { expect } from 'expect';

const INJECTED_FILES = [
  'content_logic.js',
  'deluminate.js'
];

describe('Syntax Validation for Injected Scripts', () => {
  INJECTED_FILES.forEach(filename => {
    it(`${filename} should be a valid script (not a module)`, () => {
      const filePath = path.resolve(filename);
      const code = fs.readFileSync(filePath, 'utf8');

      try {
        // vm.Script compiles the code. By default, it parses as a Script, not a Module.
        // This will throw a SyntaxError if it encounters 'export' or 'import' statements
        // that are only valid in modules.
        new vm.Script(code, { filename });
      } catch (err) {
        // Re-throw with a clearer message if it's a syntax error related to modules
        if (err.message.includes('Unexpected token') || err.message.includes('export')) {
            throw new Error(`Syntax Error in ${filename}: ${err.message}. 
Injected scripts must not use ES6 modules (import/export).`);
        }
        throw err;
      }
    });
  });
});
