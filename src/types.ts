/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Role {
  USER = 'user',
  RESPONDER = 'responder',
}

export enum UserType {
  CITIZEN = 'citizen',
  EMERGENCY_DEPARTMENT = 'emergency_department',
}

export enum EmergencyStatus {
  ACTIVE = 'active',
  UNASSIGNED = 'unassigned',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  SOLVED = 'solved',
  ESCALATED = 'escalated',
}

export enum EmergencyType {
  GENERAL = 'general',
  MEDICAL = 'medical',
  FIRE = 'fire',
  SECURITY = 'security',
  MANUAL = 'manual',
  CRASH = 'crash',
  BYSTANDER = 'bystander',
}

export interface MedicalInfo {
  bloodGroup: string;
  allergies?: string;
  conditions?: string;
  complications?: string;
}

export interface EmergencyContact {
  name: string;
  phoneNumber: string;
  relationship: string;
  isVerified?: boolean;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  gender?: string;
  age?: number;
  phoneNumber?: string;
  emergencyContacts?: EmergencyContact[];
  role: Role;
  userType?: UserType;
  department?: string;
  occupation?: string;
  proofOfIdentity?: string; // URL
  serviceId?: string; // URL
  photo?: string; // URL
  certifications?: string[];
  medicalInfo?: MedicalInfo;
  location?: Location;
  isAvailable?: boolean;
  lastActive?: number;
}

export interface EmergencyCase {
  id: string;
  victimId?: string;
  victimName?: string;
  victimDetails?: Partial<UserProfile>;
  location: Location;
  status: EmergencyStatus;
  type: EmergencyType;
  specificIssue?: string;
  description?: string;
  audioDescription?: string; // URL
  incidentImage?: string; // URL
  severity?: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  updatedAt: number;
  responderId?: string;
  solvedBy?: string;
  skipList?: string[]; // IDs of responders who skipped
  aiAdvise?: string;
  medicalSnapshot?: MedicalInfo | null;
  priorityLevel?: number;
  broadcastAttempts?: number;
}

export interface LeaderboardEntry {
  uid: string;
  name: string;
  casesSolved: number;
  lastLocation?: Location;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}
