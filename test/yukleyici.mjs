// Node'da uygulama modüllerini yüklemek için: Firebase CDN adreslerini sahte Firebase'e yönlendirir.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const MOCK = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'mock-firebase.js')).href;
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://www.gstatic.com/firebasejs/')) return { url: MOCK, shortCircuit: true };
  return next(specifier, context);
}
