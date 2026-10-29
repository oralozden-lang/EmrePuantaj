// Birim testleri için tarayıcı ortamı taklidi (yalnızca modül yüklenirken gereken en az şey).
import { register } from 'node:module';
register('./yukleyici.mjs', import.meta.url);
const yok = () => {};
globalThis.window = globalThis;
globalThis.addEventListener = yok;
globalThis.document = { addEventListener: yok, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, setAttribute: yok, appendChild: yok }), body: { classList: { toggle: yok, contains: () => false, add: yok }, appendChild: yok }, visibilityState: 'visible' };
globalThis.localStorage = { getItem: () => null, setItem: yok, removeItem: yok };
globalThis.sessionStorage = globalThis.localStorage;
