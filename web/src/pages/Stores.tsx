import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Store } from 'lucide-react';

export const Stores: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Stores | Shopyos</title>
      </Helmet>
      <div className="space-y-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-navy">Verified Stores</h1>
        <p className="text-subtle text-lg">Shop directly from trusted businesses and sellers.</p>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-10">
          <Store size={64} className="mx-auto mb-4 text-subtle" strokeWidth={1.5} />
          <h2 className="text-2xl font-bold text-navy mb-2">Store directory under construction</h2>
          <p className="text-subtle">Browse our featured sellers and brands shortly.</p>
        </div>
      </div>
    </>
  );
};
