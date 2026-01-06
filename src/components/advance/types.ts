export interface Advance {
  id: string;
  employeeId: string;
  employee?: {
    name: string;
    employeeId: string;
    user?: {
      name: string;
      email: string;
    };
  };
  // For compatibility with some API responses that flatten the structure
  empId?: string; 
  employeeName?: string;
  
  amount: number;
  reason: string;
  month: number;
  year: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'DEDUCTED' | 'PAID';
  deductionMonth?: number;
  deductionYear?: number;
  rejectionReason?: string;
  createdAt: string;
  deductedAt?: string;
  updatedAt?: string;
}

export interface AdvanceStats {
  totalActive: number;
  totalAmount: number;
  pendingRequests: number;
}

export interface Employee {
  id: string;
  employeeId: string;
  user: {
    name: string;
    email: string;
  };
}
