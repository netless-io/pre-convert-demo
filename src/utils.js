export function formatJSON(obj) {
  const keys = Object.keys(obj).sort();
  const target = {};

  for (const key of keys) {
    target[key] = String(obj[key]);
  }

  return target;
}

export function stringify(obj) {
  return Object.keys(obj)
    .map(key => {
      const value = obj[key];
      if (value === undefined) return '';
      if (value === null) return 'null';
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
}

const encoder = new TextEncoder('utf-8');

async function createHmac(hash, secretKey) {
  if (hash === 'sha256') hash = 'SHA-256';
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    {
      name: 'HMAC',
      hash: hash
    },
    true,
    ['sign', 'verify']
  );
  return {
    data: '',
    update(str) {
      this.data += str;
      return this;
    },
    async digest() {
      const data = encoder.encode(this.data);
      const sig = await crypto.subtle.sign('HMAC', key, data);
      const b = Array.from(new Uint8Array(sig));
      return b.map(x => x.toString(16).padStart(2, '0')).join('');
    }
  };
}

export const TokenRole = {
  Admin: '0',
  Writer: '1',
  Reader: '2'
};

export const TokenPrefix = {
  SDK: 'NETLESSSDK_',
  ROOM: 'NETLESSROOM_',
  TASK: 'NETLESSTASK_'
};

import { v1 as uuidv1 } from 'uuid';

export function createToken(prefix) {
  return async (accessKey, secretAccessKey, lifespan, content) => {
    const object = {
      ...content,
      ak: accessKey,
      nonce: uuidv1()
    };

    if (lifespan > 0) {
      object.expireAt = `${Date.now() + lifespan}`;
    }

    const information = JSON.stringify(formatJSON(object));
    const hmac = await createHmac('sha256', secretAccessKey);
    object.sig = await hmac.update(information).digest('hex');
    const query = stringify(formatJSON(object));

    return (
      prefix +
      btoa(query).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    );
  };
}

export const createSdkToken = createToken(TokenPrefix.SDK);
export const createRoomToken = createToken(TokenPrefix.ROOM);
export const createTaskToken = createToken(TokenPrefix.TASK);
