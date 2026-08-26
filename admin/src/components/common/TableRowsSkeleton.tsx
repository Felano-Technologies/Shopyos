import React from 'react';
import { Skeleton } from './Skeleton';

interface TableRowsSkeletonProps {
  rows?: number;
  columns: number;
  /** Render a leading avatar/icon placeholder in the first cell (for tables whose first column shows a logo/avatar) */
  leadingIcon?: boolean;
}

export const TableRowsSkeleton: React.FC<TableRowsSkeletonProps> = ({ rows = 6, columns, leadingIcon = false }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="border-b border-gray-100 last:border-0">
        {Array.from({ length: columns }).map((__, c) => (
          <td key={c} className="px-6 py-4">
            {c === 0 && leadingIcon ? (
              <div className="flex items-center gap-3">
                <Skeleton width={36} height={36} borderRadius={10} />
                <div className="flex flex-col gap-1.5">
                  <Skeleton width={120} height={12} />
                  <Skeleton width={80} height={10} />
                </div>
              </div>
            ) : (
              <Skeleton width={c === columns - 1 ? '40%' : '70%'} height={12} />
            )}
          </td>
        ))}
      </tr>
    ))}
  </>
);
