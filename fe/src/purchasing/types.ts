/**
 * Domain types for the cross-division Purchase Request (PR) widget.
 *
 * These mirror the finance Go backend's PR domain exactly (same backend/data
 * store as Keuangan's own Purchasing module, port 8084) but are declared here
 * independently — do NOT import from `src/modules/keuangan/*`. This widget is
 * dropped into 6 other division dashboards and must stay fully decoupled.
 */

export interface PRItem {
  no: number;
  nama: string;
  satuan: string;
  qty: number;
  tujuan: string;
}

export interface Approval {
  approvedBy: string;
  approvedByRole: string;
  approvedAt: string;
  note: string;
  rejectedBy: string;
  rejectedByRole: string;
  rejectedAt: string;
  rejectNote: string;
}

export type PRStatus = "draft" | "pending" | "approved" | "rejected";

export interface PurchaseRequest {
  id: string;
  nomor: string;
  status: PRStatus;
  requestDate: string;
  dateRequired: string;
  requestBy: string;
  dept: string;
  proyek: string;
  supplier: string;
  alamatPengiriman: string;
  pic: string;
  items: PRItem[];
  catatan: string;
  diajukanOleh: string;
  diketahuiOleh: string;
  approval: Approval;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ApproverBody {
  name: string;
  role: string;
  dept: string;
}
