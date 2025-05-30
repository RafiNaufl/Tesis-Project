"use client";

import { useState, useEffect } from "react";
import { useSession, getSession } from "next-auth/react";

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  employee?: {
    id: string;
    employeeId: string;
    position: string;
    department: string;
    basicSalary: number;
    joiningDate: string;
    contactNumber: string;
    address: string;
    isActive: boolean;
  };
};

export default function ProfileForm() {
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Toast state
  const [toast, setToast] = useState<{
    visible: boolean;
    title: string;
    description: string;
    variant: 'default' | 'destructive';
  } | null>(null);

  // Auto-hide toast after a few seconds
  useEffect(() => {
    if (toast?.visible) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000); // Hide after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/profile');
        
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        
        const data = await response.json();
        setProfile(data);
        
        // Initialize form values
        setName(data.name || '');
        setEmail(data.email || '');
        setContactNumber(data.employee?.contactNumber || '');
        setAddress(data.employee?.address || '');
      } catch (error) {
        console.error('Error fetching profile:', error);
        setToast({
          visible: true,
          title: 'Error',
          description: 'Failed to load profile information.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchProfile();
    }
  }, [session]);

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setUpdating(true);
      
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          contactNumber,
          address,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
      
      const data = await response.json();
      setProfile(prev => ({ ...prev, ...data.user } as UserProfile));
      
      // Update the session with the new user data
      if (updateSession) {
        try {
          console.log('Updating session with new data:', { name, email });
          await updateSession({
            ...session,
            user: {
              ...session?.user,
              name,
              email,
            }
          });
          console.log('Session updated successfully');
          
          // Force a session refresh across all tabs
          await getSession();
        } catch (error) {
          console.error('Failed to update session:', error);
        }
      }
      
      setToast({
        visible: true,
        title: 'Success',
        description: 'Your profile has been updated successfully.',
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setToast({
        visible: true,
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError('');
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    try {
      setUpdating(true);
      
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update password');
      }
      
      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setToast({
        visible: true,
        title: 'Success',
        description: 'Your password has been updated successfully.',
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      setToast({
        visible: true,
        title: 'Error',
        description: error.message || 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  // Toast component
  const Toast = () => {
    if (!toast?.visible) return null;
    
    return (
      <div 
        className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg ${
          toast.variant === 'destructive' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'
        }`}
      >
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {toast.variant === 'destructive' ? (
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium">{toast.title}</h3>
            <p className="mt-1 text-sm">{toast.description}</p>
          </div>
          <div className="ml-auto pl-3">
            <button
              onClick={() => setToast(null)}
              className="inline-flex rounded-md bg-transparent text-gray-400 hover:text-gray-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>Loading profile information...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      
      <div className="mb-4">
        <div className="flex space-x-4 border-b">
          <button
            className={`py-2 px-4 font-medium ${activeTab === 'profile' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile Information
          </button>
          <button
            className={`py-2 px-4 font-medium ${activeTab === 'security' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('security')}
          >
            Security
          </button>
        </div>
      </div>
      
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Summary Card */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Account Summary</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="flex flex-col space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Name</h3>
                  <p>{profile?.name}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Email</h3>
                  <p>{profile?.email}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Role</h3>
                  <p className="capitalize">{profile?.role?.toLowerCase()}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Member Since</h3>
                  <p>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Profile Edit Form */}
          <div className="bg-white rounded-lg shadow overflow-hidden md:col-span-2">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Edit Profile</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input
                      id="name"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input
                      id="email"
                      type="email"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  {profile?.employee && (
                    <>
                      <div className="space-y-2">
                        <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700">Contact Number</label>
                        <input
                          id="contactNumber"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
                        <input
                          id="address"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <button 
                    type="submit" 
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75"
                    disabled={updating}
                  >
                    {updating ? 'Updating...' : 'Update Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {/* Employee Information (if applicable) */}
          {profile?.employee && (
            <div className="bg-white rounded-lg shadow overflow-hidden md:col-span-3">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Employee Information</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Employee ID</h3>
                    <p>{profile.employee.employeeId}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Position</h3>
                    <p>{profile.employee.position}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Department</h3>
                    <p>{profile.employee.department}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Basic Salary</h3>
                    <p>${profile.employee.basicSalary.toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Joining Date</h3>
                    <p>{new Date(profile.employee.joiningDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Status</h3>
                    <p>
                      <span className={`inline-block px-2 py-1 text-xs rounded ${
                        profile.employee.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {profile.employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'security' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Change Password</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="border-t my-4 border-gray-200"></div>
              
              <div className="space-y-2">
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {passwordError && (
                  <p className="text-sm text-red-500 mt-1">{passwordError}</p>
                )}
              </div>
              
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75"
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Toast notification */}
      <Toast />
    </div>
  );
} 