export type LeadStage =
  | "New"
  | "Contacted"
  | "Qualifying"
  | "Qualified"
  | "Proposal"
  | "Booked"
  | "Lost";

export type LeadUrgency =
  | "Today"
  | "This Week"
  | "Next Week"
  | "This Month"
  | "Flexible";

export type NotificationType =
  | "new_lead"
  | "booked"
  | "attention"
  | "ai_paused"
  | "summary"
  | "system"
  | "whatsapp_message";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  service: string;
  urgency: LeadUrgency;
  stage: LeadStage;
  source: string;
  assignedTo?: string;
  notes?: string;
  avatarColor: string;
  createdAt: string;
  lastActivity: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeadFormData {
  name: string;
  phone: string;
  email: string;
  service: string;
  urgency: LeadUrgency | "";
  source: string;
  stage: LeadStage;
  assignedTo: string;
  notes: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  actionLeadId?: string;
}

export interface SortConfig {
  key: keyof Lead | null;
  direction: "asc" | "desc";
}

export type KnowledgeType = "pdf" | "faq" | "text" | "image";

export interface KnowledgeSource {
  id: string;
  type: KnowledgeType;
  title: string;
  description: string;
  status: "synced" | "syncing" | "error";
  lastUpdated: string;
  size?: string;
  itemCount?: number;
}
