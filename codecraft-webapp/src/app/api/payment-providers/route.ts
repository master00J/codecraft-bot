import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'

// Get active payment providers (public info only)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('payment_providers')
      .select('provider, display_name, is_active, auto_verification')
      .eq('is_active', true)
      .order('display_name', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ providers: data || [], success: true });
  } catch (error) {
    console.error('Error fetching active payment providers:', error);
    return NextResponse.json({ providers: [], error: 'Internal server error' }, { status: 500 });
  }
}
