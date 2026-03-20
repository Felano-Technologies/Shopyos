// hooks/useSellerGuard.ts
// FIX 3: Route-level seller verification guard.
//
// Usage — add this single line to the TOP of every protected business screen:
//
//   useSellerGuard();
//

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useMyBusinesses } from './useBusiness';

// Screens that unverified sellers ARE allowed to access
const UNGUARDED_BUSINESS_ROUTES = [
  '/business/verification',
  '/business/verification-status',
  '/business/register',
  '/business/businessRegistration',
];

export const useSellerGuard = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  const { data: businessesData, isLoading } = useMyBusinesses();

  useEffect(() => {
    if (isLoading) {
      setIsChecking(true);
      return;
    }

    // Skip the guard on routes where unverified sellers are allowed
    if (UNGUARDED_BUSINESS_ROUTES.some((r) => pathname.startsWith(r))) {
      setIsVerified(true);
      setIsChecking(false);
      return;
    }

    const business = businessesData?.businesses?.[0];

    if (!business) {
      // If no business exists, dashboard handles the "Create Business" modal.
      // We don't want to redirect them to a verification status page for a business they don't have.
      setIsVerified(true);
      setIsChecking(false);
      return;
    }

    if (business.verificationStatus !== 'verified') {
      // Not verified — redirect to verification screen immediately
      router.replace('/business/verification-status');
    } else {
      setIsVerified(true);
    }
    
    setIsChecking(false);
  }, [pathname, isLoading, businessesData, router]);

  return { isChecking, isVerified };
};