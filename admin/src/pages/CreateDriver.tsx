import React from 'react';

export const CreateDriver: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-4">Register Delivery Driver</h1>
      <p className="text-slate-500 mb-8">Manually onboard a new parcel partner</p>
      
      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Driver Name</label>
            <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Vehicle Type</label>
            <select className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
              <option>Motorcycle</option>
              <option>Van</option>
              <option>Truck</option>
            </select>
          </div>
          <button className="bg-navy hover:bg-navy-mid text-white px-6 py-2.5 rounded-xl font-semibold mt-4">
            Register Driver
          </button>
        </div>
      </div>
    </div>
  );
};
