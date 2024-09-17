'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');

const PadLocker = require('..');
const { mustCall } = require('./common.js');

function generateLockName() {
  return `padlocker-test-${Date.now()}-${process.pid}`;
}

function lockExists(name) {
  name = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexp = new RegExp(`[ \t]@${name}$`, 'm');
  return regexp.test(readFileSync('/proc/net/unix', 'utf8'));
}

(async () => {
  const done = mustCall(function allTestsDone() {});

  {
    const locker = new PadLocker(generateLockName());

    await locker.lock();
    assert(lockExists(locker.name));

    await locker.unlock();
    assert(!lockExists(locker.name));
  }
  {
    const locker = new PadLocker(generateLockName());

    locker.lock();
    locker.unlock();
    locker.lock();
    await locker.unlock();
    assert(!lockExists(locker.name));
  }
  {
    const locker = new PadLocker(generateLockName());

    await locker.lock();
    await locker.lock();
    assert(lockExists(locker.name));
    await locker.unlock();
    assert(!lockExists(locker.name));
  }
  {
    const locker = new PadLocker(generateLockName());

    await locker.lock();
    assert(lockExists(locker.name));
    await locker.unlock();
    assert(!lockExists(locker.name));
    await locker.unlock();
    assert(!lockExists(locker.name));
  }
  {
    const locker = new PadLocker(generateLockName());

    await locker.unlock();
    assert(!lockExists(locker.name));
  }
  {
    const locker1 = new PadLocker(generateLockName());
    const locker2 = new PadLocker(locker1.name);

    await locker1.lock();
    setTimeout(() => locker1.unlock(), 100);
    await locker2.lock();
  }
  {
    const locker1 = new PadLocker(generateLockName());
    const locker2 = new PadLocker(locker1.name);

    await locker1.lock();
    const unlocked = new Promise((resolve, reject) => {
      setTimeout(async () => { await locker1.unlock(); resolve(); }, 100);
    });
    assert.rejects(locker2.lock(0));
    await unlocked;
    assert(!lockExists(locker1.name));
  }

  done();
})();
