import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useDriverProfile } from './useDelivery';

// Screens that unverified drivers ARE allowed to access
const UNGUARDED_DRIVER_ROUTES = [
  '/driver/verification',
  '/driver/verification-status',
];

export const useDriverGuard = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  
  const { data: profileData, isLoading } = useDriverProfile();
  



  useEffect(() => {
    if (isLoading) {
      setIsChecking(true);
      return;
    }

    // Skip the guard on routes where unverified drivers are allowed
    if (UNGUARDED_DRIVER_ROUTES.some((r) => pathname.startsWith(r))) {
      setIsChecking(false);
      return;
    }

    const driver = profileData?.profile || profileData?.data || profileData;

    const checkVerification = async () => {
      // 1. If we have driver profile, check verification status
      if (driver) {
        // Only force verification screen if they are NOT verified OR PENDING.
        // Actually, user said "they can login to see their stuff but they cant take some action since they are under review"
        // So we let them stay on the dashboard even if pending, but maybe redirect if REJECTED.
        
        const status = driver.verification_status || (driver.is_verified ? 'verified' : 'pending');
        
        if (status === 'rejected') {
          if (!pathname.startsWith('/driver/verification')) {
             router.replace('/driver/verification');
          }
          return;
        }

        // If they haven't submitted anything yet (no record at all)
        // But getDriverProfile usually returns 404 if no profile.
        // The isLoading/error handles that.
      } else {
        // No driver profile found? Redirect to registration/verification
        if (!pathname.startsWith('/driver/verification') && !pathname.startsWith('/driver/index')) {
           router.replace('/driver/verification');
        }
      }

      setIsChecking(false);
    };

    checkVerification();
  }, [pathname, isLoading, profileData, router]);

  return { isChecking, profile: profileData?.profile || profileData?.data || profileData };
};
