import { useEffect } from 'react';
import { dailyCheckin } from '@/services/api';
import { storage } from '@/services/client';
import { CustomInAppToast } from '@/components/InAppToastHost';

const CHECKIN_KEY = 'lastDailyCheckin';

/**
 * Fires the daily check-in once per calendar day when mounted (buyer home).
 * Awards loyalty points server-side; shows a toast only when points were earned.
 */
export const useDailyCheckin = () => {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const last = await storage.getItem(CHECKIN_KEY);
        if (last === today) return;

        const result = await dailyCheckin();
        if (cancelled) return;

        await storage.setItem(CHECKIN_KEY, today);

        if (!result.alreadyCheckedIn && result.pointsAwarded > 0) {
          CustomInAppToast.show({
            type: 'success',
            title: result.bonusDay
              ? `🔥 ${result.streak}-day streak bonus!`
              : `Day ${result.streak} check-in ✓`,
            message: `+${result.pointsAwarded} loyalty points added to your balance.`,
          });
        }
      } catch {
        // Silent: check-in is a bonus, never block or nag on failure.
        // No local date is stored on failure so it retries next mount.
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);
};
