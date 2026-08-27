import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Gift } from 'lucide-react';

export const Deals: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Deals & Offers | Shopyos</title>
      </Helmet>
      <div className="space-y-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-navy">Deals & Offers</h1>
        <p className="text-subtle text-lg">Discover the best discounts across all categories.</p>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-10">
          <Gift size={64} className="mx-auto mb-4 text-subtle" strokeWidth={1.5} />
          <h2 className="text-2xl font-bold text-navy mb-2">Exciting deals coming soon</h2>
          <p className="text-subtle">We are working hard to bring you the best prices.</p>
        </div>
      </div>
    </>
  );
};
