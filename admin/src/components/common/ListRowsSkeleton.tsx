import React from 'react';
import { Skeleton } from './Skeleton';

interface ListRowsSkeletonProps {
  rows?: number;
  /** Render a leading circular/icon placeholder (avatar, bell icon, timeline dot) */
  leadingIcon?: boolean;
}

export const ListRowsSkeleton: React.FC<ListRowsSkeletonProps> = ({ rows = 5, leadingIcon = true }) => (
  <div className="divide-y divide-gray-100">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="p-4 flex items-start gap-4">
        {leadingIcon && <Skeleton width={36} height={36} borderRadius={10} />}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <Skeleton width="40%" height={13} />
            <Skeleton width={70} height={11} />
          </div>
          <Skeleton width="80%" height={11} />
        </div>
      </div>
    ))}
  </div>
);
