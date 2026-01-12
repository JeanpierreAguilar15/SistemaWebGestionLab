/**
 * SecureStorage - Cifrado de datos en localStorage
 *
 * Implementa ISO/IEC 27002:2022 Control 8.24 (Uso de criptografia)
 * y NIST SP 800-53 SC-28 (Protection of Information at Rest)
 *
 * Utiliza AES-GCM con Web Crypto API nativa del navegador
 */

// Clave de cifrado derivada de una semilla (en produccion usar clave mas robusta)
const ENCRYPTION_KEY_SEED = 'LAB_FRANZ_SECURE_2024_KEY';
const SALT = 'laboratorio_franz_salt_v1';

// Cache de la clave derivada
let derivedKey: CryptoKey | null = null;

/**
 * Deriva una clave criptografica a partir de la semilla
 */
async function getDerivedKey(): Promise<CryptoKey> {
  if (derivedKey) return derivedKey;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY_SEED),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Cifra datos usando AES-GCM
 */
async function encrypt(data: string): Promise<string> {
  try {
    const key = await getDerivedKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    );

    // Combinar IV + datos cifrados y convertir a base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[SecureStorage] Error al cifrar:', error);
    throw error;
  }
}

/**
 * Descifra datos usando AES-GCM
 */
async function decrypt(encryptedData: string): Promise<string> {
  try {
    const key = await getDerivedKey();
    const decoder = new TextDecoder();

    // Convertir de base64 a bytes
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extraer IV (primeros 12 bytes) y datos cifrados
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[SecureStorage] Error al descifrar:', error);
    throw error;
  }
}

/**
 * SecureStorage - Almacenamiento cifrado compatible con Zustand
 */
export const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    const encrypted = localStorage.getItem(name);
    if (!encrypted) return null;

    try {
      // Verificar si los datos estan cifrados (empiezan con marca)
      if (encrypted.startsWith('ENC:')) {
        const decrypted = await decrypt(encrypted.slice(4));
        console.log(`[SecureStorage] Datos descifrados para: ${name}`);
        return decrypted;
      }
      // Datos no cifrados (legacy) - migrar automaticamente
      console.log(`[SecureStorage] Migrando datos legacy para: ${name}`);
      return encrypted;
    } catch (error) {
      console.error(`[SecureStorage] Error leyendo ${name}:`, error);
      // Si falla el descifrado, limpiar datos corruptos
      localStorage.removeItem(name);
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;

    try {
      const encrypted = await encrypt(value);
      localStorage.setItem(name, `ENC:${encrypted}`);
      console.log(`[SecureStorage] Datos cifrados guardados para: ${name}`);
    } catch (error) {
      console.error(`[SecureStorage] Error guardando ${name}:`, error);
    }
  },

  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(name);
    console.log(`[SecureStorage] Datos eliminados: ${name}`);
  },
};

/**
 * Funcion para verificar si los datos estan cifrados (util para demo)
 */
export function isDataEncrypted(key: string): { encrypted: boolean; rawData: string | null } {
  if (typeof window === 'undefined') return { encrypted: false, rawData: null };

  const data = localStorage.getItem(key);
  if (!data) return { encrypted: false, rawData: null };

  return {
    encrypted: data.startsWith('ENC:'),
    rawData: data,
  };
}

/**
 * Funcion para mostrar estado del cifrado en consola (para demostracion)
 */
export function logStorageStatus(): void {
  if (typeof window === 'undefined') return;

  console.group('[SecureStorage] Estado del almacenamiento cifrado');
  console.log('='.repeat(50));

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const { encrypted, rawData } = isDataEncrypted(key);
      console.log(`Clave: ${key}`);
      console.log(`  Cifrado: ${encrypted ? 'SI (AES-256-GCM)' : 'NO'}`);
      if (rawData) {
        console.log(`  Datos (primeros 100 chars): ${rawData.substring(0, 100)}...`);
      }
      console.log('-'.repeat(50));
    }
  }

  console.groupEnd();
}

// Exponer funcion de diagnostico en window para demostracion
if (typeof window !== 'undefined') {
  (window as any).secureStorageStatus = logStorageStatus;
  (window as any).isDataEncrypted = isDataEncrypted;
}
