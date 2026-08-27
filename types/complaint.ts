export type ComplaintStatus = 'draft' | 'submitted_demo' | 'under_review_demo' | 'closed_demo';

export interface Complaint {
  id: string;
  userId: string;
  taskId: string;
  category: string;
  department: string;
  subject: string;
  description: string;
  status: ComplaintStatus;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  officialSourceName: string;
  officialSourceUrl: string;
  /** The demo grievance mailbox this complaint would be emailed to. */
  departmentEmail?: string;
  /** The authority that owns this category of grievance. */
  authority?: string;
  /** The citizen's own words, kept verbatim as the heart of the complaint. */
  citizenStatement?: string;
}
