const path = require('path');

module.exports = (request, options) => {
  // Try the default resolver first
  try {
    return options.defaultResolver(request, options);
  } catch (e) {
    // If it fails, try adding .ts extension
    if (request.startsWith('.') || request.startsWith('/')) {
      const tsPath = request + '.ts';
      try {
        return options.defaultResolver(tsPath, options);
      } catch (e2) {
        // Try index.ts
        const indexPath = path.join(request, 'index.ts');
        try {
          return options.defaultResolver(indexPath, options);
        } catch (e3) {
          throw e; // Throw original error
        }
      }
    }
    throw e;
  }
};
