import React from 'react';
import { UserManagement } from './UserManagement';

export const UserParcelPartners: React.FC = () => {
  return (
    <div className="p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-navy">Parcel Partners</h1>
        <p className="text-sm text-slate-500">Manage all registered delivery partners and drivers</p>
      </div>
      <UserManagement filterRole="driver" />
    </div>
  );
};
