import { api, extractErrorMessage } from './client';

export type TicketCategory =
  | 'order_issue' | 'delivery_issue' | 'product_issue' | 'payment_issue'
  | 'driver_issue' | 'parcel_partner_issue' | 'platform_issue' | 'other';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ReporterRole = 'buyer' | 'seller' | 'driver' | 'parcel_partner';

export interface SupportTicket {
  id: string;
  reporter_id: string;
  reporter_role: ReporterRole;
  category: TicketCategory;
  subject: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  status: TicketStatus;
  priority: 1 | 2 | 3;
  admin_notes: string | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string;
  reporter_avatar?: string;
}

export const adminGetTickets = async (filters: {
  status?: TicketStatus; category?: TicketCategory; reporter_role?: ReporterRole; page?: number;
} = {}): Promise<{ tickets: SupportTicket[]; total: number; page: number; pages: number }> => {
  try {
    const response = await api.get('/support/admin/tickets', { params: filters });
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminUpdateTicket = async (
  id: string,
  update: { status?: TicketStatus; priority?: 1 | 2 | 3; admin_notes?: string }
): Promise<SupportTicket> => {
  try {
    const response = await api.patch(`/support/admin/tickets/${id}`, update);
    return response.data.ticket;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
