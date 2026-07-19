'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getApiBase } from '@/lib/utils/api-base';
import { OnPointLayout } from '../../../components/OnPointLayout';

/**
 * Referral landing page - /r/[referralCode]
 * 
 * Handles incoming referral links from agents.
 * Tracks the click and redirects to the appropriate destination.
 * 
 * Flow:
 * 1. Agent shares link with their referral code (e.g., /r/abc123)
 * 2. User clicks link, lands here
 * 3. We capture the visit (POST /api/referrals/capture)
 * 4. Redirect to storefront or landing page
 */
export default function ReferralPage() {
  const params = useParams();
  const router = useRouter();
  const referralCode = params.referralCode as string;

  useEffect(() => {
    const captureAndRedirect = async () => {
      if (!referralCode) {
        router.push('/');
        return;
      }

      // Receipt links used this route before receipts moved under /receipt.
      // Preserve those published links without treating a receipt ID as a referral.
      if (referralCode.startsWith('receipt_')) {
        router.replace(`/receipt/${encodeURIComponent(referralCode)}`);
        return;
      }

      // Store referral code in session storage for later use
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('referral_code', referralCode);
      }

      // Try to capture the referral visit
      try {
        const res = await fetch(`${getApiBase()}/api/referrals/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referralCode,
            action: 'visit',
            timestamp: new Date().toISOString(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // If we got a destination, use it
          if (data.redirectUrl) {
            router.push(data.redirectUrl);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to capture referral:', error);
      }

      // Default redirect to homepage
      router.push('/');
    };

    captureAndRedirect();
  }, [referralCode, router]);

  return (
    <OnPointLayout footer={false}>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="animate-pulse text-4xl">✨</div>
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    </OnPointLayout>
  );
}
