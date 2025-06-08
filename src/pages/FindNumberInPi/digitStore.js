const API_URL = 'https://api.pi.delivery/v1/pi';
const MAX_CONCURRENT = 6;
const MAX_CACHED_BLOCKS = 4000;
const RETRY_DELAY = 2000;
const MAX_RETRY_DELAY = 30000;

export const TOTAL_DIGITS = 1e14;
export const BLOCK_SIZE = 1000;

export const blocksOf = (start, count) => {
  const first = Math.floor(start / BLOCK_SIZE);
  const last = Math.floor((start + count - 1) / BLOCK_SIZE);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
};

export function createDigitStore() {
  const controller = new AbortController();
  const cache = new Map();
  const loading = new Set();
  const failures = new Map();
  const pinned = new Set();
  const listeners = new Set();
  let local = null;
  let wanted = [];
  let version = 0;
  let offline = false;
  let notifyScheduled = false;
  let retryTimer = 0;

  const notify = () => {
    if (notifyScheduled) return;
    notifyScheduled = true;
    requestAnimationFrame(() => {
      notifyScheduled = false;
      version += 1;
      listeners.forEach((listener) => listener());
    });
  };

  const getBlock = (block) => {
    if (local && (block + 1) * BLOCK_SIZE <= local.length) {
      return local.slice(block * BLOCK_SIZE, (block + 1) * BLOCK_SIZE);
    }
    const digits = cache.get(block);
    if (digits !== undefined) {
      cache.delete(block);
      cache.set(block, digits);
    }
    return digits;
  };

  const read = (start, count) => {
    let digits = '';
    for (const block of blocksOf(start, count)) {
      const part = getBlock(block);
      if (part === undefined) return null;
      digits += part;
    }
    const offset = start % BLOCK_SIZE;
    return digits.slice(offset, offset + count);
  };

  const store = (block, digits) => {
    cache.set(block, digits);
    if (cache.size > MAX_CACHED_BLOCKS) {
      cache.delete(cache.keys().next().value);
    }
  };

  const scheduleRetry = (delay) => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(pump, delay);
  };

  const fetchBlock = async (block) => {
    loading.add(block);
    try {
      const params = new URLSearchParams({
        start: block * BLOCK_SIZE + 1,
        numberOfDigits: BLOCK_SIZE,
      });
      const response = await fetch(`${API_URL}?${params}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`pi.delivery ${response.status}`);
      const { content } = await response.json();
      if (!/^\d+$/.test(content) || content.length !== BLOCK_SIZE) {
        throw new Error('pi.delivery returned malformed digits');
      }
      store(block, content);
      failures.delete(block);
      offline = false;
    } catch (error) {
      if (controller.signal.aborted) return;
      const attempts = (failures.get(block)?.attempts ?? 0) + 1;
      const delay = Math.min(
        RETRY_DELAY * 2 ** (attempts - 1),
        MAX_RETRY_DELAY
      );
      failures.set(block, { attempts, retryAt: Date.now() + delay });
      offline = true;
      scheduleRetry(delay);
    } finally {
      loading.delete(block);
    }
    notify();
    pump();
  };

  function pump() {
    const now = Date.now();
    for (const block of new Set([...pinned, ...wanted])) {
      if (loading.size >= MAX_CONCURRENT) return;
      if (loading.has(block) || getBlock(block) !== undefined) continue;
      if ((failures.get(block)?.retryAt ?? 0) > now) continue;
      fetchBlock(block);
    }
  }

  return {
    read,

    want(blocks) {
      wanted = blocks;
      pump();
    },

    ensure(start, count) {
      const blocks = blocksOf(start, count);
      return new Promise((resolve) => {
        const check = () => {
          if (read(start, count) === null) return;
          blocks.forEach((block) => pinned.delete(block));
          listeners.delete(check);
          resolve();
        };
        blocks.forEach((block) => pinned.add(block));
        listeners.add(check);
        check();
        pump();
      });
    },

    async loadLocal(url) {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`${url} ${response.status}`);
      local = await response.text();
      notify();
      return local;
    },

    getLocal: () => local,

    isOffline: () => offline,

    getVersion: () => version,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      controller.abort();
      clearTimeout(retryTimer);
      listeners.clear();
    },
  };
}
