/**
 * Convert openapi.json into a Postman Collection.
 *
 * Output: postman/flower-shop.postman_collection.json (generated, git ignored)
 * - All request URLs use {{baseUrl}} (default http://localhost:3001)
 * - Collection variables: baseUrl, token, sessionId
 * - Login / register store the JWT into {{token}} automatically
 * - Endpoints requiring auth inherit collection-level Bearer {{token}}
 */
const fs = require('fs');
const path = require('path');
const Converter = require('openapi-to-postmanv2');

const ROOT = path.join(__dirname, '..');
const OPENAPI_PATH = path.join(ROOT, 'openapi.json');
const OUTPUT_DIR = path.join(ROOT, 'postman');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'flower-shop.postman_collection.json');
const BASE_URL = 'http://localhost:3001';
const TOKEN_ROUTES = ['POST /api/auth/login', 'POST /api/auth/register'];

const spec = JSON.parse(fs.readFileSync(OPENAPI_PATH, 'utf8'));

// "METHOD /path/:param" → whether the OpenAPI operation declares security,
// and which query parameters are required
const securedOperations = new Map();
const requiredQueryParams = new Map();
for (const [openapiPath, operations] of Object.entries(spec.paths)) {
  const postmanPath = openapiPath.replace(/\{(\w+)\}/g, ':$1');
  for (const [method, operation] of Object.entries(operations)) {
    const key = `${method.toUpperCase()} ${postmanPath}`;
    const isSecured = Array.isArray(operation.security) && operation.security.length > 0;
    securedOperations.set(key, isSecured);
    requiredQueryParams.set(
      key,
      (operation.parameters || []).filter((p) => p.in === 'query' && p.required).map((p) => p.name)
    );
  }
}

function requestKey(request) {
  const segments = Array.isArray(request.url.path) ? request.url.path : [];
  return `${request.method} /${segments.join('/')}`;
}

function normalizeRequest(item) {
  const { request } = item;
  const key = requestKey(request);

  // URL: always {{baseUrl}}
  request.url.host = ['{{baseUrl}}'];
  delete request.url.protocol;
  delete request.url.port;
  // Optional query params (e.g. status filter) start disabled so examples don't filter results
  const required = requiredQueryParams.get(key) || [];
  for (const q of request.url.query || []) {
    q.disabled = !required.includes(q.key) && !['page', 'limit'].includes(q.key);
  }
  const query = (request.url.query || [])
    .filter((q) => !q.disabled)
    .map((q) => `${q.key}=${q.value ?? ''}`)
    .join('&');
  request.url.raw = `{{baseUrl}}/${request.url.path.join('/')}${query ? `?${query}` : ''}`;

  // Auth: secured endpoints inherit the collection Bearer token, public ones use no auth
  if (securedOperations.get(key)) {
    delete request.auth;
  } else {
    request.auth = { type: 'noauth' };
  }

  // Cart supports guest mode via X-Session-Id (disabled by default)
  request.header = (request.header || []).filter((h) => h.key.toLowerCase() !== 'x-session-id');
  if (key.includes(' /api/cart')) {
    request.header.push({
      key: 'X-Session-Id',
      value: '{{sessionId}}',
      disabled: true,
      description: '訪客模式時啟用，並移除 Authorization',
    });
  }

  // Save JWT after login / register
  delete item.event;
  if (TOKEN_ROUTES.includes(key)) {
    item.event = [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            'const json = pm.response.json();',
            'if (pm.response.code >= 200 && pm.response.code < 300 && json.data && json.data.token) {',
            "  pm.collectionVariables.set('token', json.data.token);",
            "  console.log('JWT saved to {{token}}');",
            '}',
          ],
        },
      },
    ];
  }
}

function walk(items) {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      walk(item.item);
    } else if (item.request) {
      normalizeRequest(item);
    }
  }
}

Converter.convert(
  { type: 'json', data: spec },
  { folderStrategy: 'Tags', requestParametersResolution: 'Example' },
  (err, conversion) => {
    if (err || !conversion.result) {
      console.error('OpenAPI → Postman conversion failed:', err ? err.message : conversion.reason);
      process.exit(1);
    }

    const collection = conversion.output[0].data;
    collection.info.name = '花卉電商 API';
    collection.variable = [
      { key: 'baseUrl', value: BASE_URL, type: 'string' },
      { key: 'token', value: '', type: 'string' },
      { key: 'sessionId', value: '', type: 'string' },
    ];
    collection.auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{token}}', type: 'string' }],
    };
    walk(collection.item);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(collection, null, 2));

    // Validate the written file is valid JSON
    try {
      JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    } catch (parseError) {
      console.error('Generated collection is not valid JSON:', parseError.message);
      process.exit(1);
    }

    console.log(`Postman collection generated: ${path.relative(ROOT, OUTPUT_PATH)}`);
  }
);
