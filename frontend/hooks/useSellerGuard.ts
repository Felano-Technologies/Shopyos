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
import { storage } from '@/services/api';

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

    const checkVerification = async () => {
      // 1. If we have API data, use it as the source of truth
      if (business) {
        if (business.verificationStatus !== 'verified') {
          if (!pathname.startsWith('/business/verification-status')) {
             router.replace('/business/verification-status');
          }
          return;
        }
        setIsVerified(true);
        setIsChecking(false);
        return;
      }

      // 2. Fallback: Check storage status if API hasn't loaded a business yet
      // but only if we are NOT on the dashboard (dashboard handles the 'no business' modal)
      const cachedStatus = await storage.getItem('currentBusinessVerificationStatus');
      const isDashboard = pathname.startsWith('/business/dashboard');
      
      if (cachedStatus && cachedStatus !== 'verified' && !isDashboard) {
        if (!pathname.startsWith('/business/verification-status')) {
           router.replace('/business/verification-status');
        }
        return;
      }

      // 3. Allow pass as "Verified" (meaning "Allowed to see UI") for now.
      // Dashboard will show the 'No Business' modal if needed.
      setIsVerified(true);
      setIsChecking(false);
    };

    checkVerification();
  }, [pathname, isLoading, businessesData, router]);

  return { isChecking, isVerified };
};