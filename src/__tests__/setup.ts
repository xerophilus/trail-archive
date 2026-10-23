import { afterEach } from 'vitest';
import 'fake-indexeddb/auto';

afterEach(() => {
  localStorage.clear();
});

global.btoa = (str: string) => Buffer.from(str).toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString();
