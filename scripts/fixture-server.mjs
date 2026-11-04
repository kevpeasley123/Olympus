import {createServer} from 'vite';

// Release runs can share the same loopback server across browser fixtures.
export async function createFixtureServer(options) {
  const address = process.argv[2];
  if (!address) return createServer(options);
  const url = new URL(address);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw Error('Expected a loopback fixture server.');
  return {resolvedUrls:{local:[url.href]},listen:async()=>{},close:async()=>{}};
}
