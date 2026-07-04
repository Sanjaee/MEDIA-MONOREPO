import crypto from 'crypto';

const PLISIO_BASE_URL = 'https://api.plisio.net/api/v1';

export function getPlisioApiKey(): string {
  const key = process.env.PLISIO_API_KEY;
  if (!key) {
    throw new Error('PLISIO_API_KEY is not set');
  }
  return key;
}

export function getPlisioBaseUrl(): string {
  return PLISIO_BASE_URL;
}

export function getUrls(): { backendUrl: string; frontendUrl: string } {
  const base =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000';
  const url = base.replace(/\/$/, '');
  return { backendUrl: url, frontendUrl: url };
}

export function mapPlisioStatusToDb(status: string): string {
  switch (status) {
    case 'pending':
    case 'new':
    case 'pending internal':
      return 'pending';
    case 'completed':
    case 'mismatch':
      return 'success';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
    case 'failed':
    case 'error':
      return status === 'expired' ? 'expired' : 'failed';
    default:
      return 'pending';
  }
}

export function verifyPlisioCallback(data: Record<string, unknown>, secretKey: string): boolean {
  const verifyHash = data.verify_hash;
  if (!verifyHash || typeof verifyHash !== 'string' || !secretKey) {
    return false;
  }

  try {
    const ordered = { ...data } as Record<string, unknown>;
    delete ordered.verify_hash;

    const sortedData: Record<string, unknown> = {};
    Object.keys(ordered)
      .sort()
      .forEach((key) => {
        sortedData[key] = ordered[key];
      });

    if (sortedData.expire_utc !== undefined) {
      sortedData.expire_utc = String(sortedData.expire_utc);
    }
    if (typeof sortedData.tx_urls === 'string') {
      sortedData.tx_urls = (sortedData.tx_urls as string)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    }

    const dataString = JSON.stringify(sortedData);
    const hmac = crypto.createHmac('sha1', secretKey);
    hmac.update(dataString);
    const computedHash = hmac.digest('hex');

    return computedHash === verifyHash;
  } catch {
    return false;
  }
}
