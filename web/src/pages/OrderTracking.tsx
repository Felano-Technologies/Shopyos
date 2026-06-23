import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderDetail } from '../hooks/useOrders';
import { socketService } from '../services/socket';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet broken default marker icon image asset references in Vite builds
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom colored markers for Store (Green) and Driver (Blue/Bike icon if possible)
const storeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const driverIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

export const OrderTracking: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrderDetail(id || '');

  const [driverCoords, setDriverCoords] = useState<[number, number] | null>(null);

  // Connect to Socket.IO and listen for driver updates if the order is active
  useEffect(() => {
    let socketRef: any = null;

    const initSocket = async () => {
      try {
        const socket = await socketService.connect();
        socketRef = socket;

        // Listen for delivery updates
        socket.on('delivery:location_update', (data: any) => {
          console.log('📡 Socket coordinate update:', data);
          if (data.deliveryId === order?.delivery?.id || data.orderId === order?.id) {
            setDriverCoords([data.latitude, data.longitude]);
          }
        });
      } catch (err) {
        console.warn('Socket connection failed for tracking:', err);
      }
    };

    if (order) {
      initSocket();
      // Set initial driver coords if already in order details
      if (order.delivery?.current_lat && order.delivery?.current_lng) {
        setDriverCoords([order.delivery.current_lat, order.delivery.current_lng]);
      }
    }

    return () => {
      if (socketRef) {
        socketRef.off('delivery:location_update');
      }
    };
  }, [order]);

  if (isLoading) {
    return <div className="text-center py-20 text-subtle font-semibold animate-pulse">Loading tracking details...</div>;
  }

  if (error || !order) {
    return (
      <div className="text-center py-12 max-w-md mx-auto bg-white p-8 rounded-[22px] border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-red-500 mb-2">Failed to load order tracking</h3>
        <button onClick={() => navigate('/orders')} className="bg-navy hover:bg-navy-mid text-white font-bold px-6 py-2.5 rounded-full text-sm transition-colors mt-4">
          Back to Orders
        </button>
      </div>
    );
  }

  // Lat/Lng Fallbacks (Accra default)
  const buyerCoords: [number, number] = [
    order.buyer_lat || order.latitude || 5.6037,
    order.buyer_lng || order.longitude || -0.1870
  ];

  const storeCoords: [number, number] = [
    order.store_lat || order.store?.latitude || 5.6100,
    order.store_lng || order.store?.longitude || -0.1900
  ];

  const isTrackingAvailable = order.status?.toLowerCase() === 'out_for_delivery';

  return (
    <div className="flex flex-col gap-8 animate-fade-in mt-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-[16px] shadow-sm border border-gray-100">
        <h2 className="text-xl md:text-2xl font-bold text-body">Order #{order.id.slice(0, 8)}</h2>
        <button onClick={() => navigate('/orders')} className="text-navy font-bold hover:underline text-sm flex items-center gap-2">
          &larr; Back to History
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left pane: Details, Progress stepper */}
        <div className="flex flex-col gap-6">
          {/* Stepper Card */}
          <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
            <h4 className="font-bold mb-6 text-xs text-subtle uppercase tracking-wider">Delivery Status</h4>
            <div className="flex justify-between items-center relative">
              <div className="flex flex-col items-center flex-1 z-10">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-navy text-white shadow-sm">
                  1
                </div>
                <span className="text-xs font-semibold mt-2 text-body">Placed</span>
              </div>
              
              <div className="flex flex-col items-center flex-1 z-10">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 shadow-sm ${
                  ['accepted', 'preparing', 'ready', 'out_for_delivery', 'completed'].includes(order.status)
                    ? 'bg-navy text-white'
                    : 'bg-gray-100 text-subtle'
                }`}>
                  2
                </div>
                <span className="text-xs font-semibold mt-2 text-body">Preparing</span>
              </div>

              <div className="flex flex-col items-center flex-1 z-10">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 shadow-sm ${
                  ['out_for_delivery', 'completed'].includes(order.status)
                    ? 'bg-navy text-white'
                    : 'bg-gray-100 text-subtle'
                }`}>
                  3
                </div>
                <span className="text-xs font-semibold mt-2 text-body">Shipping</span>
              </div>

              <div className="flex flex-col items-center flex-1 z-10">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 shadow-sm ${
                  order.status === 'completed'
                    ? 'bg-lime text-white'
                    : 'bg-gray-100 text-subtle'
                }`}>
                  4
                </div>
                <span className="text-xs font-semibold mt-2 text-body">Arrived</span>
              </div>

              {/* connector line */}
              <div className="absolute top-[18px] left-[10%] right-[10%] h-[2px] bg-gray-100 z-0" />
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white p-6 rounded-[24px] flex flex-col gap-5 border border-gray-100 shadow-sm">
            <h4 className="font-bold text-xs text-subtle uppercase tracking-wider">Order Summary</h4>
            <div className="border-b border-gray-100 pb-4">
              <p className="text-xs text-subtle uppercase tracking-wider font-bold mb-1">Deliver to:</p>
              <strong className="text-sm font-semibold text-body">{order.delivery_address}</strong>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-body items-center bg-gray-50 p-2 rounded-[12px]">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{item.product?.name || item.name}</span>
                    <strong className="bg-navy/10 text-navy px-2 py-0.5 rounded-full text-xs font-bold">x{item.quantity}</strong>
                  </span>
                  <strong className="font-bold">₵{Number(item.price * item.quantity).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 flex justify-between font-bold text-base text-body">
              <span>Total Paid</span>
              <span className="text-lime text-lg font-black">₵{Number(order.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Right pane: Leaflet interactive OpenStreetMap */}
        <div className="flex flex-col gap-4 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
          <h4 className="font-bold text-xs text-subtle uppercase tracking-wider">
            {isTrackingAvailable ? '📡 Live Delivery Route' : '🗺️ Delivery Address Map'}
          </h4>
          <div className="h-[420px] w-full rounded-[16px] overflow-hidden border border-gray-200 relative shadow-inner z-0">
            <MapContainer center={buyerCoords} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Buyer Destination Marker */}
              <Marker position={buyerCoords}>
                <Popup>Your Delivery Destination Address</Popup>
              </Marker>

              {/* Vendor Store Marker */}
              <Marker position={storeCoords} icon={storeIcon}>
                <Popup>Vendor Store Location</Popup>
              </Marker>

              {/* Live Driver Marker */}
              {isTrackingAvailable && driverCoords && (
                <Marker position={driverCoords} icon={driverIcon}>
                  <Popup>Delivery Rider coordinates location (real-time updates!)</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
          <p className="text-xs text-subtle text-center bg-gray-50 p-3 rounded-[12px] font-medium">
            {isTrackingAvailable
              ? 'Rider is currently on the way! Watch marker move on the map.'
              : 'Live tracking activates as soon as the rider picks up your package.'}
          </p>
        </div>
      </div>
    </div>
  );
};
