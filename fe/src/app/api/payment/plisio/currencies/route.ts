import { NextResponse } from 'next/server';
import axios from 'axios';
import { getPlisioApiKey, getPlisioBaseUrl } from '@/lib/plisio';

export interface PlisioCurrency {
  name: string;
  cid: string;
  currency: string;
  icon: string;
  rate_usd: string;
  price_usd: string;
  precision: string;
  fiat: string;
  fiat_rate: string;
  min_sum_in: string;
  invoice_commission_percentage: string;
  hidden: number;
  maintenance: boolean;
}

export async function GET() {
  try {
    const apiKey = getPlisioApiKey();
    const baseUrl = getPlisioBaseUrl();

    const response = await axios.get<{
      status: string;
      data?: PlisioCurrency[];
      message?: string;
    }>(`${baseUrl}/currencies`, {
      params: { api_key: apiKey },
      headers: { 'Content-Type': 'application/json' },
    });

    const result = response.data;

    if (result.status !== 'success' || !result.data) {
      return NextResponse.json({
        success: false,
        error: (result as any).data?.message || result.message || 'Failed to get currencies',
      }, { status: 400 });
    }

    const currencies = result.data.filter(
      (c) => !c.hidden && !c.maintenance
    );

    return NextResponse.json({ success: true, data: currencies }, { status: 200 });
  } catch (error: any) {
    console.error('Plisio currencies error:', error);
    const message =
      error.response?.data?.data?.message ||
      error.response?.data?.message ||
      error.message ||
      'Failed to get currencies';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
