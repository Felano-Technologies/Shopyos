import React from 'react';

export const CreateUser: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-4">Register New User</h1>
      <p className="text-secondary mb-8">Manually create a new platform user</p>
      
      <div className="bg-card rounded-2xl border border-border p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-body mb-1">Full Name</label>
            <input type="text" className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-body mb-1">Email</label>
            <input type="email" className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-body mb-1">Role</label>
            <select className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
              <option>Buyer</option>
              <option>Admin</option>
            </select>
          </div>
          <button className="bg-navy hover:bg-navy-mid text-white px-6 py-2.5 rounded-xl font-semibold mt-4">
            Create User
          </button>
        </div>
      </div>
    </div>
  );
};
