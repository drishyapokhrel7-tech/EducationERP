export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type UserStatus = "ACTIVE" | "SUSPENDED" | "INVITED" | "DEACTIVATED";

export interface SafeUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campus {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterOrganizationInput {
  organizationName: string;
  slug: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateCampusInput {
  name: string;
  code: string;
}
