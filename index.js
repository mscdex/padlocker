'use strict';

const { createServer } = require('net');

const DEFAULT_RETRIES = Infinity; // how many additional locking attempts to try
const DEFAULT_RETRY_DELAY = 250; // milliseconds

class PadLocker {
  #name;
  #handle = null;
  #state = null;
  #promise = null;
  constructor(name) {
    if (typeof name !== 'string')
      throw new TypeError(`Invalid name argument type: ${typeof name}`);
    const len = Buffer.byteLength(name);
    if (len === 0)
      throw new Error('name must be > 0 bytes');
    if (len > 107) {
      throw new Error(
        `name argument must be <= 107 bytes, received ${len} bytes`
      );
    }
    this.#name = name;
  }
  get name() {
    return this.#name;
  }
  lock(retries, retryDelay) {
    switch (this.#state) {
      case 'locked':
      case 'locking':
        return this.#promise;
      case 'unlocking':
        return new Promise((resolve, reject) => {
          this.#promise.then(() => this.lock(retries, retryDelay));
          this.#promise.catch(reject);
        });
    }

    if (!this.#handle) {
      this.#handle = createServer();
      this.#handle.on('error', () => {});
      this.#handle.unref();
    }

    if (retries === undefined || retries === Infinity) {
      retries = DEFAULT_RETRIES;
    } else if (!Number.isInteger(retries) || retries < 0) {
      throw new TypeError(
        `retries argument must be a valid positive integer or Infinity`
      );
    }

    if (retryDelay === undefined) {
      retryDelay = DEFAULT_RETRY_DELAY;
    } else if (!Number.isInteger(retryDelay) || retryDelay < 0) {
      throw new TypeError(
        `retriesInterval argument must be a valid positive integer`
      );
    }

    let attempts = 0;
    this.#state = 'locking';
    const tryLock = (resolve, reject) => {
      const onListening = () => {
        this.#handle.removeListener('error', onError);

        this.#state = 'locked';
        resolve();
      };

      const onError = (origErr) => {
        this.#handle.removeListener('listening', onListening);

        if (origErr.code === 'EADDRINUSE') {
          if (attempts++ < retries)
            return setTimeout(tryLock, retryDelay, resolve, reject);

          this.#state = null;
          const err = new Error('Timed out waiting to lock');
          err.code = 'ETIMEDOUT';
          return reject(err);
        }

        this.#state = null;
        const err = new Error(
          `Unexpected error while locking: ${origErr.message}`
        );
        err.code = 'EUNEXPECTED';
        err.origError = origErr;
        reject(err);
      };

      this.#handle.once('error', onError);
      this.#handle.once('listening', onListening);
      this.#handle.listen(`\0${this.#name}`);
    };
    this.#promise = new Promise(tryLock);

    return this.#promise;
  }
  unlock() {
    switch (this.#state) {
      case 'unlocked':
      case 'unlocking':
        return this.#promise;
      case 'locking':
        return new Promise(async(resolve, reject) => {
          await this.#promise;
          await this.unlock();
          resolve();
        });
      case null:
        return (this.#promise || (this.#promise = Promise.resolve()));
      case 'locked':
        this.#state = 'unlocking';
        this.#promise = new Promise((resolve, reject) => {
          this.#handle.close((origErr) => {
            if (origErr) {
              this.#state = 'locked';
              const err = new Error(
                `Unexpected error while unlocking: ${origErr.message}`
              );
              err.code = 'EUNEXPECTED';
              err.origError = origErr;
              return reject(err);
            }

            this.#state = 'unlocked';
            resolve();
          });
        });
        return this.#promise;
    }
  }
}

const [ nodeMajor ] =
  /^(\d+)/.exec(process.versions.node).slice(1).map((n) => +n);
const [ uvMajor, uvMinor ] =
  /^(\d+)[.](\d+)/.exec(process.versions.uv).slice(1).map((n) => +n);

if (process.platform !== 'linux')
  throw new Error('Platform not supported');

if (nodeMajor >= 21 && (uvMajor > 1 || (uvMajor === 1 && uvMinor >= 48))) {
  module.exports = PadLocker;
} else {
  throw new Error('Runtime not supported');
}
