import React from 'react';
import { UserManagement } from './UserManagement';

export const UserBuyers: React.FC = () => {
  return (
    <div className="p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-navy">Buyer Accounts</h1>
        <p className="text-sm text-slate-500">Manage all customer accounts</p>
      </div>
      <UserManagement filterRole="buyer" />
    </div>
  );
};
