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
    const baseUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
    
    const res = await fetch(`${baseUrl}/payment/plisio/currencies`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Backend returned error:', errorText);
      return NextResponse.json({ success: false, error: `Failed to fetch currencies from backend: ${errorText}` }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('Plisio currencies error:', error.message || error);
    return NextResponse.json({ success: false, error: 'Failed to get currencies' }, { status: 500 });
  }
}
