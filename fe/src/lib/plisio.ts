

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

