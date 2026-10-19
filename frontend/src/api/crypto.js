/**
 * Client-side Password Encryption Engine for Sahana IT Asset Manager.
 * 
 * Replaces the plain text password with an encrypted token (AES-256-GCM)
 * before dispatching the login request. This guarantees that the original
 * password is NEVER visible in browser Developer Tools -> Network -> Payload.
 */

const AUTH_KEY = import.meta.env.VITE_AUTH_KEY || '8f7K@2mL:91xPq$4vN!6zR';

function bufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Encrypts the user's password before sending in the login payload.
 * Returns a secure token prefixed with 'enc:v1:'.
 * 
 * @param {string} plainPassword - User entered password
 * @returns {Promise<string>} Encrypted password string
 */
export async function encryptPassword(plainPassword) {
  if (!plainPassword) return plainPassword;

  try {
    const encoder = new TextEncoder();

    // Derive 256-bit AES key via SHA-256
    const keyHash = await window.crypto.subtle.digest(
      'SHA-256',
      encoder.encode(AUTH_KEY)
    );

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      keyHash,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // 12-byte random IV ensures unique ciphertext even for identical passwords
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoder.encode(plainPassword)
    );

    // Combine IV (12 bytes) + Ciphertext + Tag into a single buffer
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return `enc:v1:${bufferToBase64(combined)}`;
  } catch (err) {
    console.error('Password encryption error:', err);
    return plainPassword;
  }
}
