import React from 'react';
import { Helmet } from 'react-helmet-async';

export const DriverDashboard: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Driver Portal | Shopyos</title>
      </Helmet>
      <div className="space-y-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-navy">Driver Portal</h1>
        <p className="text-subtle text-lg">Manage deliveries, track routes, and update order statuses.</p>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-10">
          <div className="text-6xl mb-4">🚚</div>
          <h2 className="text-2xl font-bold text-navy mb-2">Delivery Management</h2>
          <p className="text-subtle">You must be registered as a driver to access active routes.</p>
        </div>
      </div>
    </>
  );
};
