import { api } from './client';

export interface Hub {
  id: string;
  region_id: number;
  hub_name: string;
  partner_name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  region_name?: string;
}

export interface HubStats {
  awaitingCheckIn: number;
  checkedIn: number;
  inTransit: number;
  arrived: number;
}

export interface ParcelOrder {
  id: string;
  order_number: string;
  buyer_id: string;
  store_id: string;
  status: string;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  delivery_address_line1: string;
  delivery_phone: string;
  order_type: string;
  origin_region: string | null;
  destination_region: string | null;
  origin_hub_id: string | null;
  destination_hub_id: string | null;
  parcel_tracking_number: string | null;
  parcel_transit_fee: number;
  estimated_hub_arrival: string | null;
  last_mile_requested: boolean;
  last_mile_fee: number;
  store_name?: string;
  store_logo?: string;
  created_at: string;
}

export interface TransitInfo {
  orderId: string;
  trackingNumber: string | null;
  status: string;
  originHub: Hub | null;
  destHub: Hub | null;
  estimatedArrival: string | null;
  lastMileRequested: boolean;
  lastMileFee: number;
  timeline: {
    status: string;
    notes: string | null;
    photoUrl: string | null;
    createdAt: string;
    hubName: string | null;
  }[];
}

export async function getHubs(): Promise<{ success: boolean; data: Hub[] }> {
  const { data } = await api.get('/parcel-partner/hubs');
  return data;
}

export async function getDashboardStats(hubId: string): Promise<{ success: boolean; data: HubStats }> {
  const { data } = await api.get('/parcel-partner/dashboard', { params: { hubId } });
  return data;
}

export async function getHubParcels(hubId: string, status?: string): Promise<{ success: boolean; data: ParcelOrder[] }> {
  const { data } = await api.get('/parcel-partner/parcels', { params: { hubId, status } });
  return data;
}

export async function checkInParcel(
  orderId: string,
  payload: { hubId: string; notes?: string; photoUrl?: string }
): Promise<{ success: boolean; message: string; trackingNumber: string }> {
  const { data } = await api.put(`/parcel-partner/parcels/${orderId}/check-in`, payload);
  return data;
}

export async function dispatchParcel(
  orderId: string,
  payload: { hubId: string; notes?: string; photoUrl?: string }
): Promise<{ success: boolean; message: string; estimatedArrival: string }> {
  const { data } = await api.put(`/parcel-partner/parcels/${orderId}/dispatch`, payload);
  return data;
}

export async function arriveParcel(
  orderId: string,
  payload: { hubId: string; notes?: string; photoUrl?: string }
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.put(`/parcel-partner/parcels/${orderId}/arrived`, payload);
  return data;
}

export async function requestLastMile(
  orderId: string
): Promise<{ success: boolean; message: string; deliveryId: string }> {
  const { data } = await api.post(`/parcel-partner/orders/${orderId}/request-last-mile`);
  return data;
}

export async function getTransitInfo(
  orderId: string
): Promise<{ success: boolean; data: TransitInfo }> {
  const { data } = await api.get(`/parcel-partner/orders/${orderId}/transit-info`);
  return data;
}
