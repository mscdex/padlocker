# Description

Simple OS-wide generic locking for node.js on Linux using abstract sockets.
The use of abstract sockets allows for automatic unlocking when the process exits.

# Requirements

* Linux

* [node.js](http://nodejs.org/)
  * For node compiled with its bundled library dependencies
    * node v21.6.2+
    * node v22.0.0+
  * For node compiled against shared library dependencies
    * node v21.0.0+ and libuv v1.48.0+

# Installation

    npm install padlocker

# Examples

## Lock and unlock

```js
const PadLocker = require('padlocker');

const locker = new PadLocker('foo.bar.baz.lock');

(async() => {
  await locker.lock();
  // Do something
  await locker.unlock();
})();

```

# API

`require('padlocker')` returns the **_PadLocker_** constructor.

## PadLocker

### PadLocker properties

* **name** - _string_ - The name originally passed in to the constructor.

### PadLocker methods

* **(constructor)**(< _string_ >name) - Creates and returns a new PadLocker instance.

* **lock**([< _integer_ >retries[, < _integer_ >retryDelay]]) - _Promise_ - Attempts to acquire the lock. `retries` if defined, must be a positive integer or `Infinity` that represents how many attempts to make after the first try if unsuccessful (**Default:** `Infinity`). `retryDelay` if defined, must be a positive integer representing how many milliseconds to wait between retries (**Default:** 250ms).

* **unlock**() - _Promise_ - Releases the lock.