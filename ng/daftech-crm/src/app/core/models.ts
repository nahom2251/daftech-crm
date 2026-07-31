export type AccountStatus = 'Pending' | 'Approved' | 'Rejected';
export type EmployeeAccountStatus = 'Active' | 'Disabled';
export type AgreementStatus = 'Active' | 'Expired' | 'Pending';
export type BillingTier = 'Basic' | 'Intermediate' | 'Advanced';

/** Matches Domain.Enums.TicketCategory — note SqlDatabaseError, not the slash-form display string. */
export type TicketCategory = 'SqlDatabaseError' | 'Bug' | 'Other';

/**
 * Matches Domain.Enums.TicketStatus. Assignment is automatic (no manual
 * "assign" step from the Admin) and Resolved no longer means done — it
 * routes through AwaitingClientConfirmation before Closed or Escalated.
 */
export type TicketStatus =
  | 'Submitted'
  | 'Forwarded'
  | 'Assigned'
  | 'InProgress'
  | 'Resolved'
  | 'AwaitingClientConfirmation'
  | 'Escalated'
  | 'Closed';

export type ClosureReason = 'ClientConfirmedSatisfied' | 'AutoClosedNoResponse';

export type MaintenanceCategory =
  | 'SQL/Database error'
  | 'Front-end error'
  | 'Back-end/server error'
  | 'Security patch'
  | 'Performance update'
  | string;
export type MaintenanceStatus = 'Resolved' | 'InProgress' | 'Recurring';

/** Matches Domain.Enums.EmployeeRole — API uses ItSupport/EmployeeTechnician (no slash/space). */
export type EmployeeRole = 'Admin' | 'ItSupport' | 'EmployeeTechnician';

export type DeviceType = 'Laptop' | 'Pc' | 'Tablet' | 'Other';
export type DeviceAccessStatus = 'Allowed' | 'Revoked';
export type NotificationRecipientType = 'Admin' | 'ItSupport' | 'Employee' | 'Client';

/** Display helpers — the API uses PascalCase enum names without spaces/slashes; these map back to the spec's human-readable labels. */
export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  SqlDatabaseError: 'SQL/Database error',
  Bug: 'Bug',
  Other: 'Other',
};

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  Admin: 'Admin',
  ItSupport: 'IT Support',
  EmployeeTechnician: 'Employee/Technician',
};

export interface Client {
  id: string;
  name: string;
  idNumber: string;
  phoneNumber: string;
  email: string;
  office: string;
  location: string;
  kycType: string;
  kycContact: string;
  itSupportContact?: string;
  accountStatus: AccountStatus;
  onboardingDate: string; // ISO date
  rejectionReason?: string;
  username?: string;
  mustChangePassword: boolean;
}

/** Returned once, immediately after Admin registers a new client. Never retrievable again after this response. */
export interface ClientRegisteredResult {
  client: Client;
  username: string;
  oneTimePassword: string;
  emailSent: boolean;
  emailError?: string;
}

export interface Agreement {
  id: string;
  clientId: string;
  documentNumber: string;
  scannedFileUrl?: string;
  agreementPlace: string;
  signDate: string; // ISO date
  expiryDate: string; // ISO date
  supportWindowMonths: number;
  status: AgreementStatus;
  billingTier: BillingTier;
}

export interface Ticket {
  id: string;
  clientId: string;
  clientName: string;
  agreementId: string;
  description: string;
  category: TicketCategory;
  dateSubmitted: string; // ISO datetime
  forwardedByEmployeeId?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  chargeable: boolean;
  status: TicketStatus;
  resolvedAt?: string;
  clientConfirmationDeadline?: string;
  satisfactionStars?: number; // 1-5, set once the client confirms
  satisfactionScore?: number; // stars * 20, out of 100
  closureReason?: ClosureReason;
  auditTrail: TicketAuditEntry[];
}

export interface TicketAuditEntry {
  timestamp: string;
  actor: string;
  action: string;
}

/**
 * A single login event captured for an employee — this is how the
 * "employee IP address at login" requirement is recorded, distinct
 * from the longer-lived DeviceSession allow/revoke record below.
 */
export interface LoginRecord {
  id: string;
  employeeId: string;
  timestamp: string; // ISO datetime
  ipAddress: string;
  deviceType: DeviceType;
  deviceIdentifier: string;
  allowed: boolean; // false if blocked by IP allow-list or disabled account
  reason?: string; // populated when allowed = false
}

export interface DeviceSession {
  id: string;
  employeeId: string;
  deviceType: DeviceType;
  deviceIdentifier: string;
  ipAddress: string;
  lastSeen: string; // ISO datetime
  accessStatus: DeviceAccessStatus;
}

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  specialization: string;
  roles: EmployeeRole[];
  accountStatus: EmployeeAccountStatus;
  allowedIpAddresses: string[]; // empty = no IP restriction
  disabledAt?: string;
  disabledReason?: string;
  openTicketCount: number;
  /** Average of SatisfactionScore across this employee's rated tickets (auto-closed/unrated tickets excluded). Null if never rated. */
  averageSatisfactionScore?: number;
  username: string;
  mustChangePassword: boolean;
}

/** Returned once, immediately after Admin registers a new employee. Never retrievable again after this response. */
export interface EmployeeRegisteredResult {
  employee: Employee;
  username: string;
  oneTimePassword: string;
  emailSent: boolean;
  emailError?: string;
}

export interface TimeLog {
  id: string;
  employeeId: string;
  date: string; // ISO date
  startTime?: string; // ISO datetime
  finishTime?: string; // ISO datetime
  totalHours?: number;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  category: MaintenanceCategory;
  description: string;
  performedByEmployeeId: string;
  status: MaintenanceStatus;
  remarks?: string;
}

export interface AppNotification {
  id: string;
  recipientType: NotificationRecipientType;
  recipientId: string; // employeeId, clientId, or 'ALL_ADMIN' / 'ALL_IT_SUPPORT'
  eventType: string;
  message: string;
  dateSent: string;
  readStatus: boolean;
}

export interface EmployeeOnTimeStats {
  employeeId: string;
  employeeName: string;
  onTimeCount: number;
  lateCount: number;
  totalResolved: number;
  onTimeRate: number; // 0-100
}

export interface OnTimeSummary {
  onTimeCount: number;
  lateCount: number;
  totalResolved: number;
  onTimeRate: number; // 0-100
  targetDays: number;
}

export interface OnTimeReport {
  summary: OnTimeSummary;
  byEmployee: EmployeeOnTimeStats[];
}

/**
 * The optional 5-question client satisfaction survey — separate from the
 * 1-5 star Confirm Resolution rating that gates ticket closure.
 */
export interface SatisfactionSurvey {
  id: string;
  ticketId: string;
  clientId: string;
  submittedAt: string;
  responseSpeedRating: number; // 1-5
  professionalismRating: number; // 1-5
  communicationClarityRating: number; // 1-5
  likelihoodToRecommend: number; // 1-5
  improvementFeedback?: string;
}

export type SessionAccountType = 'Employee' | 'Client';

export interface SessionActivity {
  accountType: SessionAccountType;
  accountId: string;
  accountName: string;
  onlineStatus: boolean;
  lastSeen: string;
  mostRecentIpAddress?: string;
}

export interface LoginSessionHistoryEntry {
  id: string;
  ipAddress: string;
  loginTime: string;
  logoutTime?: string;
  onlineStatus: boolean;
  lastSeen: string;
}

export interface EmployeePerformanceReport {
  employeeId: string;
  employeeName: string;
  ticketsAssigned: number;
  ticketsResolved: number;
  averageResolutionHours?: number;
  onTimeRate: number;
  averageSatisfactionScore?: number;
  totalHoursWorked: number;
  aiNarrativeAvailable: boolean;
  aiNarrative?: string;
  aiUnavailableReason?: string;
}
