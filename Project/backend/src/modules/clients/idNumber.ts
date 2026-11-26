import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedIdNumber {
  iv: string;
  ciphertext: string;
  authTag: string;
}

export function idEncryptionKey(): Buffer {
  const raw = process.env.ID_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ID_ENCRYPTION_KEY is required');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ID_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return key;
}

export function encryptIdNumber(plain: string, key = idEncryptionKey()): EncryptedIdNumber {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptIdNumber(payload: EncryptedIdNumber, key = idEncryptionKey()): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

export function maskIdNumber(plain: string): string {
  const digits = plain.replace(/\D/g, '');
  const tail = digits.slice(-4);
  return tail.length > 0 ? `•••${tail}` : '••••';
}
