// hooks/useSellerGuard.ts
// FIX 3: Route-level seller verification guard.
//
// Problem: _layout.tsx had a showBusinessNav array but zero redirect logic.
// An unverified seller could navigate directly to /business/products,
// /business/orders, etc. by typing the URL or via a deep link.
//
// Solution: This hook reads verification_status from SecureStore on every
// business screen mount and redirects to /business/verification if the
// seller is not verified. It runs BEFORE the screen content renders,
// so unverified sellers never see a flash of protected content.
//
// Usage — add this single line to the TOP of every protected business screen:
//
//   useSellerGuard();
//
// That's it. The hook handles everything else.

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { storage } from '../services/api';

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

  useEffect(() => {
    let cancelled = false;

    const checkVerification = async () => {
      try {
        // Skip the guard on routes where unverified sellers are allowed
        if (UNGUARDED_BUSINESS_ROUTES.some((r) => pathname.startsWith(r))) {
          if (!cancelled) { setIsVerified(true); setIsChecking(false); }
          return;
        }

        const status = await storage.getItem('currentBusinessVerificationStatus');

        if (cancelled) return;

        if (status !== 'verified') {
          // Not verified — redirect to verification screen immediately
          // Use replace so the protected screen is not in the back stack
          router.replace('/business/verification-status');
          return;
        }

        setIsVerified(true);
      } catch (err) {
        // Storage read failed — treat as unverified to be safe
        if (!cancelled) router.replace('/business/verification-status');
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    checkVerification();
    return () => { cancelled = true; };
  }, [pathname]);

  return { isChecking, isVerified };
};