// utils/adminExport.ts
// Cross-platform export helper for admin screens.
// Web: opens the URL in a new tab (browser handles Content-Disposition download).
// Mobile/tablet: downloads to device cache then invokes the share sheet.

import { Platform } from 'react-native';
import { baseURL } from '@/services/client';
import { secureStorage } from '@/services/client';

type ExportFormat = 'xlsx' | 'csv';

export type ExportResource =
  | 'users'
  | 'orders'
  | 'audit-logs'
  | 'stores'
  | 'revenue'
  | 'payouts'
  | 'driver-verifications'
  | 'reports';

export async function exportAdminData(
  resource: ExportResource,
  filters: Record<string, string> = {},
  format: ExportFormat = 'xlsx'
): Promise<void> {
  const query = new URLSearchParams({ format, ...filters }).toString();
  const url = `${baseURL}/api/v1/admin/export/${resource}?${query}`;

  if (Platform.OS === 'web') {
    // Token goes in the URL via the Authorization header — but window.open can't
    // set headers. Instead we fetch as a blob and create an <a> link.
    const token =
      (await secureStorage.getItem('userToken')) ||
      (await secureStorage.getItem('businessToken'));

    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `${resource}-${dateStr}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');

  const token =
    (await secureStorage.getItem('userToken')) ||
    (await secureStorage.getItem('businessToken'));

  const dateStr = new Date().toISOString().slice(0, 10);
  const dest =
    FileSystem.cacheDirectory + `${resource}-${dateStr}.${format}`;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const mimeTypes: Record<ExportFormat, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
  };

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: mimeTypes[format],
      dialogTitle: `Export ${resource}`,
    });
  }
}
