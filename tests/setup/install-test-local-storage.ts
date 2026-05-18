export function installTestLocalStorage(): void {
  try {
    globalThis.localStorage.getItem('__catan_test_probe__');
    return;
  } catch {
    // Node / jsdom without a working Storage implementation.
  }

  const store = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number): string | null {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  });
}

installTestLocalStorage();
