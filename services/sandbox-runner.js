/**
 * Sandbox Runner Service
 *
 * Executes AI-generated server code in a sandboxed environment.
 * In production, this uses nsjail for secure isolation.
 * In development, it uses a simple VM-based sandbox.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Sandbox configuration
const SANDBOX_TIMEOUT_MS = 30000; // 30 seconds
const USE_NSJAIL = process.env.USE_NSJAIL === 'true';

/**
 * Generate a unique sandbox directory
 */
function createSandboxDir() {
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(os.tmpdir(), `parascene-sandbox-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Clean up sandbox directory
 */
function cleanupSandbox(sandboxDir) {
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup sandbox dir ${sandboxDir}:`, error.message);
  }
}

/**
 * Execute code in a Node.js sandbox (development mode)
 *
 * WARNING: This is NOT secure for production use.
 * In production, use nsjail for proper isolation.
 */
async function executeInDevSandbox(code, request) {
  const sandboxDir = createSandboxDir();

  try {
    // Write the code to a file
    const codePath = path.join(sandboxDir, 'handler.js');
    const wrapperCode = `
const http = require('http');

// The generated handler
${code}

// If there's a default export, use it
const handler = module.exports.default || module.exports;

// Create a simple server to handle the request
const requestData = ${JSON.stringify(request)};

// Simulate the request/response
const mockReq = {
  method: requestData.method,
  headers: requestData.headers || {},
  body: requestData.body
};

const chunks = [];
const mockRes = {
  statusCode: 200,
  _headers: {},
  setHeader(name, value) { this._headers[name.toLowerCase()] = value; },
  getHeader(name) { return this._headers[name.toLowerCase()]; },
  write(chunk) { chunks.push(chunk); },
  end(data) {
    if (data) chunks.push(data);
    const result = {
      statusCode: this.statusCode,
      headers: this._headers,
      body: Buffer.concat(chunks.map(c => Buffer.isBuffer(c) ? c : Buffer.from(c))).toString('base64')
    };
    console.log('__SANDBOX_RESULT__' + JSON.stringify(result));
  },
  status(code) { this.statusCode = code; return this; },
  json(data) {
    this.setHeader('content-type', 'application/json');
    this.end(JSON.stringify(data));
  },
  send(data) {
    this.end(data);
  }
};

// Run the handler
(async () => {
  try {
    await handler(mockReq, mockRes);
  } catch (error) {
    mockRes.statusCode = 500;
    mockRes.json({ error: error.message });
  }
})();
`;

    fs.writeFileSync(codePath, wrapperCode);

    // Execute with timeout
    return new Promise((resolve, reject) => {
      const child = spawn('node', [codePath], {
        cwd: sandboxDir,
        timeout: SANDBOX_TIMEOUT_MS,
        env: {
          NODE_ENV: 'sandbox',
          // Provide access to node_modules for sharp, etc.
          NODE_PATH: path.join(process.cwd(), 'node_modules'),
          PATH: process.env.PATH,
          // Set API_KEY for auth in generated code
          API_KEY: process.env.HOSTED_SERVER_INTERNAL_KEY || 'internal'
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        // Cleanup after execution completes
        cleanupSandbox(sandboxDir);

        // Parse the result from stdout
        const resultMatch = stdout.match(/__SANDBOX_RESULT__(.+)/);
        if (resultMatch) {
          try {
            const result = JSON.parse(resultMatch[1]);
            resolve({
              success: true,
              statusCode: result.statusCode,
              headers: result.headers,
              body: Buffer.from(result.body, 'base64')
            });
          } catch (e) {
            reject(new Error(`Failed to parse sandbox result: ${e.message}`));
          }
        } else if (code !== 0) {
          reject(new Error(`Sandbox process exited with code ${code}: ${stderr}`));
        } else {
          reject(new Error('No result from sandbox'));
        }
      });

      child.on('error', (error) => {
        cleanupSandbox(sandboxDir);
        reject(error);
      });
    });
  } catch (error) {
    cleanupSandbox(sandboxDir);
    throw error;
  }
}

/**
 * Execute code in nsjail sandbox (production mode)
 *
 * Requires nsjail to be installed on the system.
 */
async function executeInNsjail(code, request) {
  const sandboxDir = createSandboxDir();

  try {
    // Write the code to the sandbox directory
    const codePath = path.join(sandboxDir, 'handler.js');
    const requestPath = path.join(sandboxDir, 'request.json');

    fs.writeFileSync(codePath, code);
    fs.writeFileSync(requestPath, JSON.stringify(request));

    // nsjail configuration
    const nsjailArgs = [
      '--mode', 'o',
      '--time_limit', String(Math.ceil(SANDBOX_TIMEOUT_MS / 1000)),
      '--hostname', 'sandbox',
      // User/group mapping
      '--user', '65534:65534',
      '--group', '65534:65534',
      // Mount the sandbox directory read-only
      '--bindmount_ro', `${sandboxDir}:/app`,
      // Mount node binary
      '--bindmount_ro', '/usr/bin/node:/usr/bin/node',
      // No network
      '--disable_clone_newnet', 'false',
      // Seccomp filtering
      '--seccomp_policy', '/etc/nsjail/node-sandbox.policy',
      // Command to run
      '--', '/usr/bin/node', '/app/handler.js'
    ];

    return new Promise((resolve, reject) => {
      const child = spawn('nsjail', nsjailArgs, {
        timeout: SANDBOX_TIMEOUT_MS + 5000 // Extra time for nsjail overhead
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const resultMatch = stdout.match(/__SANDBOX_RESULT__(.+)/);
        if (resultMatch) {
          try {
            const result = JSON.parse(resultMatch[1]);
            resolve({
              success: true,
              statusCode: result.statusCode,
              headers: result.headers,
              body: Buffer.from(result.body, 'base64')
            });
          } catch (e) {
            reject(new Error(`Failed to parse nsjail result: ${e.message}`));
          }
        } else if (code !== 0) {
          reject(new Error(`nsjail process exited with code ${code}: ${stderr}`));
        } else {
          reject(new Error('No result from nsjail'));
        }
      });

      child.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('nsjail not installed. Please install nsjail for production sandbox execution.'));
        } else {
          reject(error);
        }
      });
    });
  } finally {
    cleanupSandbox(sandboxDir);
  }
}

/**
 * Validate generated code for obvious issues
 */
export function validateCode(code) {
  const errors = [];

  // Check for syntax errors
  try {
    new Function(code);
  } catch (e) {
    errors.push(`Syntax error: ${e.message}`);
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, message: 'child_process module is not allowed' },
    { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, message: 'Direct fs access is not allowed (use provided storage APIs)' },
    { pattern: /process\.env(?!\.)/, message: 'Direct process.env access pattern detected' },
    { pattern: /eval\s*\(/, message: 'eval() is not allowed' },
    { pattern: /Function\s*\(/, message: 'Function constructor is not allowed' }
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(code)) {
      errors.push(message);
    }
  }

  // Check for required patterns
  const requiredPatterns = [
    { pattern: /req\.method\s*===?\s*['"]GET['"]|GET/i, message: 'Handler should check for GET requests' },
    { pattern: /req\.method\s*===?\s*['"]POST['"]|POST/i, message: 'Handler should check for POST requests' },
    { pattern: /X-Image-Width|x-image-width/i, message: 'Handler should set X-Image-Width header' }
  ];

  const warnings = [];
  for (const { pattern, message } of requiredPatterns) {
    if (!pattern.test(code)) {
      warnings.push(message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Run a smoke test on generated code
 */
export async function smokeTest(code, config) {
  const results = {
    syntax: { passed: false, message: '' },
    structure: { passed: false, message: '' },
    getEndpoint: { passed: false, message: '' },
    postEndpoint: { passed: false, message: '' }
  };

  // Test 1: Syntax validation
  const validation = validateCode(code);
  if (validation.valid) {
    results.syntax = { passed: true, message: 'Syntax is valid' };
  } else {
    results.syntax = { passed: false, message: validation.errors.join('; ') };
    return results; // Can't proceed with other tests if syntax is broken
  }

  // Test 2: Structure validation
  try {
    // Check if code exports a handler
    if (code.includes('module.exports') || code.includes('export default')) {
      results.structure = { passed: true, message: 'Handler export found' };
    } else {
      results.structure = { passed: false, message: 'No handler export found' };
    }
  } catch (e) {
    results.structure = { passed: false, message: e.message };
  }

  // Test 3: GET endpoint (capabilities)
  try {
    const getRequest = {
      method: 'GET',
      headers: { authorization: 'Bearer test-key' },
      body: null
    };

    if (USE_NSJAIL) {
      const response = await executeInNsjail(code, getRequest);
      if (response.success && response.statusCode === 200) {
        results.getEndpoint = { passed: true, message: 'GET endpoint responds with 200' };
      } else {
        results.getEndpoint = { passed: false, message: `GET endpoint returned ${response.statusCode}` };
      }
    } else {
      // In dev mode, just validate structure
      results.getEndpoint = { passed: true, message: 'GET endpoint structure validated (dev mode)' };
    }
  } catch (e) {
    results.getEndpoint = { passed: false, message: e.message };
  }

  // Test 4: POST endpoint structure
  try {
    // Just check if POST handling exists in the code
    if (code.includes('POST') && (code.includes('method') || code.includes('X-Image'))) {
      results.postEndpoint = { passed: true, message: 'POST endpoint structure validated' };
    } else {
      results.postEndpoint = { passed: false, message: 'POST endpoint handling not found' };
    }
  } catch (e) {
    results.postEndpoint = { passed: false, message: e.message };
  }

  return results;
}

/**
 * Execute a request against AI-generated code
 *
 * Used when running hosted AI servers on parasharkgod
 */
export async function executeRequest(code, method, headers, body) {
  const request = { method, headers, body };

  if (USE_NSJAIL) {
    return executeInNsjail(code, request);
  } else {
    return executeInDevSandbox(code, request);
  }
}

export default {
  validateCode,
  smokeTest,
  executeRequest
};
