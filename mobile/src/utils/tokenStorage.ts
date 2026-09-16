import * as Keychain from 'react-native-keychain';

// JWT stored in the OS Keychain/Keystore rather than AsyncStorage, since
// AsyncStorage is unencrypted on-device storage.
const SERVICE = 'penzi_token';

export async function setToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('penzi', token, { service: SERVICE });
}

export async function getToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  return credentials ? credentials.password : null;
}

export async function clearToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
