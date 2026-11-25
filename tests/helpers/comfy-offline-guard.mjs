// Applied only to mocked API tests and their CLI children; never production.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) {
    throw new Error(`Offline API tests prohibit external connections: ${url.origin}`);
  }
  return originalFetch(input, options);
};
