export interface MinisigResult {
  keyId?: string;
  sigB64: string;
}

export function parseMinisig(text: string): MinisigResult {
  const lines = text.trim().split('\n');
  let keyId: string | undefined;
  let sigB64 = '';
  
  for (const line of lines) {
    if (line.startsWith('trusted comment:')) {
      const match = line.match(/keyId:\s*([A-Fa-f0-9]+)/);
      if (match) keyId = match[1];
    } else if (line.startsWith('signature:')) {
      sigB64 = line.substring('signature:'.length).trim();
    } else if (!line.startsWith('untrusted comment:') && line.trim()) {
      sigB64 = line.trim();
    }
  }
  
  return { keyId, sigB64 };
}

export async function verifyBytesEd25519(fileBytes: Uint8Array, sigB64: string, pubkeyB64: string): Promise<boolean> {
  const { verify } = await import('./verify');
  return verify(pubkeyB64, new TextDecoder().decode(fileBytes), sigB64);
}
