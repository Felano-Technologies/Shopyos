import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { getAdminStores } from '../../services/admin';
import { FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';

export const StoreManagement: React.FC = () => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const data = await getAdminStores();
        const storeList = data?.data?.stores || data?.stores || data?.data || data || [];
        setStores(Array.isArray(storeList) ? storeList : []);
      } catch (err) {
        console.error("Failed to load stores", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  return (
    <>
      <Helmet>
        <title>Store Management | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Store Management</h1>
            <p className="text-sm text-gray-500 mt-1">Review, approve, and manage seller stores.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Store</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Verification</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                      Loading stores...
                    </td>
                  </tr>
                ) : stores.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                      No stores found.
                    </td>
                  </tr>
                ) : (
                  stores.map((store: any, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm overflow-hidden">
                            {store.logoUrl ? (
                              <img src={store.logoUrl} alt="Store Logo" className="w-full h-full object-cover" />
                            ) : (
                              store.storeName?.charAt(0) || 'S'
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{store.storeName || 'Unnamed Store'}</div>
                            <div className="text-sm text-gray-500">{store.businessType || 'Retail'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{store.sellerId?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{store.sellerId?.email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {store.verificationStatus === 'approved' ? (
                            <><FiCheckCircle className="w-4 h-4 text-green-500" /><span className="text-sm font-medium text-green-700">Approved</span></>
                          ) : store.verificationStatus === 'pending' ? (
                            <><FiClock className="w-4 h-4 text-amber-500" /><span className="text-sm font-medium text-amber-700">Pending</span></>
                          ) : (
                            <><FiXCircle className="w-4 h-4 text-red-500" /><span className="text-sm font-medium text-red-700">Rejected</span></>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {store.createdAt ? new Date(store.createdAt).toLocaleDateString() : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-navy hover:text-navy/70 transition-colors font-semibold">
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};
