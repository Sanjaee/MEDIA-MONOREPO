import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { transactions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import crypto from 'crypto';
import { getPlisioApiKey, getPlisioBaseUrl, getUrls, mapPlisioStatusToDb } from '@/lib/plisio';

const ROLE_PRICES: Record<string, { title: string; price: number }> = {
  vip: { title: "VIP Member", price: 10 },
  mvp: { title: "MVP", price: 30 },
  mod: { title: "Moderator", price: 50 },
  god: { title: "God", price: 100 },
  ad_slot_1d: { title: "Ad Slot (1 Day)", price: 10 },
};

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { role, currency = 'BTC' } = body;

    if (!role || !ROLE_PRICES[role]) {
      return NextResponse.json({ success: false, error: 'Invalid or missing role' }, { status: 400 });
    }

    const apiKey = getPlisioApiKey();
    const baseUrl = getPlisioBaseUrl();

    const plan = ROLE_PRICES[role];

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const amountUSD = plan.price;
    const orderId = `plisio-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const transactionId = crypto.randomUUID();

    const { backendUrl, frontendUrl } = getUrls();

    const invoiceData: Record<string, string | number> = {
      api_key: apiKey,
      order_name: plan.title,
      order_number: orderId,
      source_currency: 'USD',
      source_amount: amountUSD,
      currency: currency as string,
      callback_url: `${backendUrl}/api/payment/plisio/callback?json=true`,
      success_callback_url: `${backendUrl}/api/payment/plisio/callback?json=true`,
      fail_callback_url: `${backendUrl}/api/payment/plisio/callback?json=true`,
      success_invoice_url: `${frontendUrl}/premium?success=true`,
      fail_invoice_url: `${frontendUrl}/premium?fail=true`,
      email: user.email || '',
      description: `Purchase: ${plan.title}`,
      expire_min: 60,
    };

    const queryParams = new URLSearchParams(
      invoiceData as Record<string, string>
    ).toString();
    const response = await axios.get(
      `${baseUrl}/invoices/new?${queryParams}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    const result = response.data;

    if (result.status !== 'success') {
      const msg = result.data?.message || result.message || 'Failed to create Plisio invoice';
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const txnId = result.data?.txn_id;
    const hostedUrl = result.data?.invoice_url || result.data?.hosted_url || '';

    await db.insert(transactions).values({
      id: transactionId,
      userId: session.user.id,
      role: role,
      amount: amountUSD,
      status: mapPlisioStatusToDb(result.data?.status || 'pending'),
      plisioOrderId: orderId,
      plisioTxnId: txnId || null,
      paymentMethod: 'crypto',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        transactionId,
        orderId,
        amount: amountUSD,
        amountUSD,
        currency: currency as string,
        paymentMethod: 'crypto',
        hostedUrl,
        status: result.data?.status || 'pending',
        txnId: txnId || null,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('Plisio create payment error:', error);
    const message = error.response?.data?.message || error.response?.data?.data?.message || error.message || 'Failed to create payment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
