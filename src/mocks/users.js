export const mockUsers = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@cgiworkflo.com',
    role: 'admin',
    address: '123 Admin St, New York, NY',
    phone: '555-0101',
    createdAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'Manager User',
    email: 'manager@cgiworkflo.com',
    role: 'manager',
    address: '456 Manager Ave, Los Angeles, CA',
    phone: '555-0102',
    createdAt: '2024-01-15',
  },
  {
    id: '3',
    name: 'Franchise Owner',
    email: 'franchisee@cgiworkflo.com',
    role: 'franchisee',
    address: '789 Business Blvd, Chicago, IL',
    phone: '555-0103',
    createdAt: '2024-02-01',
  },
  {
    id: '4',
    name: 'John Employee',
    email: 'employee@cgiworkflo.com',
    role: 'employee',
    address: '321 Worker Way, Houston, TX',
    phone: '555-0104',
    franchiseId: '3',
    createdAt: '2024-03-01',
  },
];

export const getUserById = (id) => mockUsers.find((u) => u.id === id);
export const getUsersByRole = (role) => mockUsers.filter((u) => u.role === role);
