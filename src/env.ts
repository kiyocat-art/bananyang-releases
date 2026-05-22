// Polyfill for process.env in browser environment
if (typeof window !== 'undefined' && typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {
      // The API_KEY will be injected by the environment,
      // but we need to ensure the structure exists.
      API_KEY: undefined,
    },
  };
}
