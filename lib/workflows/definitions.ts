import type { ServiceType, StepDefinition } from '@/types/task';

export interface WorkflowDefinition {
  id: string;
  serviceType: ServiceType;
  title: string;
  serviceLabel: string;
  steps: StepDefinition[];
}

/**
 * One workflow shape per service. The engine below is generic — adding a new
 * government service means adding a definition here, not new state code.
 */
export const WORKFLOWS: Record<string, WorkflowDefinition> = {
  pf_withdrawal: {
    id: 'pf_withdrawal',
    serviceType: 'EPFO',
    title: 'PF Withdrawal',
    serviceLabel: 'Provident fund',
    steps: [
      { id: 'account', label: 'Account found' },
      { id: 'kyc', label: 'Your details checked', description: 'Checking your identity and bank details are linked.' },
      { id: 'bank', label: 'Bank details found' },
      { id: 'eligibility', label: 'Amount checked' },
      { id: 'review', label: 'Your check', description: 'Check the amount and where it goes before you confirm.' },
      { id: 'confirmation', label: 'You confirmed' },
      { id: 'submission', label: 'Sent' },
    ],
  },
  passport_application: {
    id: 'passport_application',
    serviceType: 'PASSPORT',
    title: 'Passport Application',
    serviceLabel: 'Passport',
    steps: [
      { id: 'personal', label: 'Your details' },
      { id: 'documents', label: 'Papers collected', description: 'Using papers you already have.' },
      { id: 'preparation', label: 'Application filled in' },
      { id: 'review', label: 'Review' },
      { id: 'submission', label: 'Sent' },
      { id: 'verification', label: 'Verification' },
      { id: 'appointment', label: 'Appointment' },
      { id: 'processing', label: 'Processing' },
      { id: 'dispatch', label: 'Dispatch' },
    ],
  },
  scheme_application: {
    id: 'scheme_application',
    serviceType: 'SCHEME',
    title: 'Scheme Application',
    serviceLabel: 'Government scheme',
    steps: [
      { id: 'eligibility', label: 'Checked what you may get' },
      { id: 'documents', label: 'Papers collected' },
      { id: 'review', label: 'Review' },
      { id: 'submission', label: 'Sent' },
      { id: 'processing', label: 'Processing' },
    ],
  },
  complaint: {
    id: 'complaint',
    serviceType: 'COMPLAINT',
    title: 'Complaint',
    serviceLabel: 'Public grievance',
    steps: [
      { id: 'details', label: 'Your details taken' },
      { id: 'draft', label: 'Complaint written' },
      { id: 'review', label: 'Review' },
      { id: 'submission', label: 'Sent' },
      { id: 'tracking', label: 'Tracking' },
    ],
  },
  /**
   * One workflow for every document, whatever route the citizen takes through
   * it. The visible steps come from the task itself, because "I lost it" and
   * "I never applied" are different journeys.
   */
  document_task: {
    id: 'document_task',
    serviceType: 'DOCUMENT',
    title: 'Document',
    serviceLabel: 'Document',
    steps: [
      { id: 'details', label: 'Your details' },
      { id: 'review', label: 'Your check' },
      { id: 'submit', label: 'Sent' },
      { id: 'processing', label: 'Office checking' },
      { id: 'done', label: 'Ready' },
    ],
  },
  train_booking: {
    id: 'train_booking',
    serviceType: 'RAIL',
    title: 'Train Booking',
    serviceLabel: 'Railway',
    steps: [
      { id: 'journey', label: 'Train chosen' },
      { id: 'passengers', label: 'Your details added' },
      { id: 'review', label: 'Review' },
      { id: 'payment', label: 'Payment' },
      { id: 'booking', label: 'Booking' },
    ],
  },
};

export function getWorkflow(workflowId: string): WorkflowDefinition {
  const workflow = WORKFLOWS[workflowId];
  if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`);
  return workflow;
}
