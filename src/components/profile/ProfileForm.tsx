"use client";

import { useState, useEffect } from "react";
import { useSession, getSession } from "next-auth/react";
import { organizations, organizationNames } from "@/lib/registrationValidation";

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImageUrl: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeId: string;
    position: string;
    division: string;
    organization?: string | null;
    basicSalary: number;
    hourlyRate?: number | null;
    workScheduleType?: "SHIFT" | "NON_SHIFT" | null;
    bpjsKesehatan?: number | null;
    bpjsKetenagakerjaan?: number | null;
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
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [_uploading, setUploading] = useState(false);
  
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

  // Add effect to initialize profile image from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const storedImageUrl = localStorage.getItem(`profile_image_${session.user.id}`);
      if (storedImageUrl) {
        setPreviewUrl(storedImageUrl);
      }
    }
  }, [session?.user?.id]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        if (!session?.user?.id) {
          // Jika belum ada session, tunggu sampai session tersedia
          return;
        }
        
        // Pastikan menggunakan URL API yang benar dengan port yang sedang berjalan
        const baseUrl = window.location.origin;
        const response = await fetch(`${baseUrl}/api/profile`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Profile API error:', errorData);
          throw new Error(errorData.error || 'Gagal mengambil profil');
        }
        
        const data = await response.json();
        
        // Pastikan data yang diterima valid
        if (!data || !data.id) {
          throw new Error('Data profil tidak valid');
        }
        
        setProfile(data);
        
        // Initialize form values with fallback ke empty string jika properti tidak ada
        setName(data.name || '');
        setEmail(data.email || '');
        setContactNumber(data.employee?.contactNumber || '');
        setAddress(data.employee?.address || '');
        
        // If profile has image URL from API or localStorage, use it
        if (data.profileImageUrl) {
          setPreviewUrl(data.profileImageUrl);
          if (typeof window !== 'undefined' && session?.user?.id) {
            localStorage.setItem(`profile_image_${session.user.id}`, data.profileImageUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setToast({
        visible: true,
        title: 'Error',
        description: 'Gagal memuat informasi profil. Silakan coba refresh halaman.',
        variant: 'destructive',
      });
        
        // Set minimal profile data based on session if available
        if (session?.user) {
          setName(session.user.name || '');
          setEmail(session.user.email || '');
        }
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchProfile();
    }
  }, [session]);

  // Add effect to handle file preview
  useEffect(() => {
    if (!profileImage) {
      return;
    }
    
    const objectUrl = URL.createObjectURL(profileImage);
    setPreviewUrl(objectUrl);
    
    // Free memory when this component is unmounted
    return () => URL.revokeObjectURL(objectUrl);
  }, [profileImage]);
  
  // Function to handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      setProfileImage(null);
      return;
    }
    
    const file = e.target.files[0];
    
    // Only allow image files
    if (!file.type.startsWith('image/')) {
      setToast({
        visible: true,
        title: 'Error',
        description: 'Silakan pilih file gambar (JPG, PNG, dll.)',
        variant: 'destructive',
      });
      return;
    }
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setToast({
        visible: true,
        title: 'Error',
        description: 'File gambar terlalu besar. Silakan pilih file di bawah 5MB.',
        variant: 'destructive',
      });
      return;
    }
    
    setProfileImage(file);
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setUpdating(true);
      
      // Get base URL
      const baseUrl = window.location.origin;
      
      // If there's a profile image to upload, handle it first
      let profileImageUrl = profile?.profileImageUrl || null;
      
      if (profileImage) {
        setUploading(true);
        
        // Create a FormData object for the file upload
        const formData = new FormData();
        formData.append('file', profileImage);
        
        // Upload the image
        const uploadResponse = await fetch(`${baseUrl}/api/upload`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Gagal mengunggah foto profil');
        }
        
        const uploadData = await uploadResponse.json();
        profileImageUrl = uploadData.url;
        
        // Store the image URL in localStorage
        if (typeof window !== 'undefined' && session?.user?.id && profileImageUrl) {
          localStorage.setItem(`profile_image_${session.user.id}`, profileImageUrl);
        }
        
        setUploading(false);
      }
      
      // Update the user profile with all information including the image URL
      const response = await fetch(`${baseUrl}/api/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          contactNumber,
          address,
          profileImageUrl,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memperbarui profil');
      }
      
      const data = await response.json();
      setProfile(prev => ({ ...prev, ...data.user } as UserProfile));
      
      // Update the session with the new user data
      if (updateSession) {
        try {
          // Update the session directly with new data
          await updateSession({
            ...session,
            user: {
              ...session?.user,
              name,
              email,
              image: profileImageUrl,
            }
          });
          
          // Force a complete session sync
          await getSession();
        } catch (error) {
          console.error('Gagal menyinkronkan sesi:', error);
        }
      }
      
      setToast({
        visible: true,
        title: 'Sukses',
        description: 'Profil Anda berhasil diperbarui.',
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setToast({
        visible: true,
        title: 'Error',
        description: error.message || 'Gagal memperbarui profil',
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
      setPasswordError('Password baru tidak cocok');
      return;
    }
    
    try {
      setUpdating(true);
      
      // Get base URL
      const baseUrl = window.location.origin;
      
      const response = await fetch(`${baseUrl}/api/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memperbarui password');
      }
      
      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setToast({
        visible: true,
        title: 'Sukses',
        description: 'Password Anda berhasil diperbarui.',
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      setToast({
        visible: true,
        title: 'Error',
        description: error.message || 'Gagal memperbarui password',
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
        <p>Memuat informasi profil...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Profil Saya</h1>
      
      <div className="mb-4">
        <div className="flex space-x-4 border-b">
          <button
            className={`py-2 px-4 font-medium ${activeTab === 'profile' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('profile')}
          >
            Informasi Profil
          </button>
          <button
            className={`py-2 px-4 font-medium ${activeTab === 'security' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('security')}
          >
            Keamanan
          </button>
        </div>
      </div>
      
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Summary Card */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Ringkasan Akun</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              {/* Profile Image */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 mb-4">
                  {previewUrl ? (
                    <Image 
                      src={previewUrl} 
                      alt="Foto Profil" 
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Nama</h3>
                  <p>{profile?.name}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Email</h3>
                  <p>{profile?.email}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Peran</h3>
                  <p className="capitalize">{profile?.role?.toLowerCase()}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Organisasi</h3>
                  <p>{profile?.employee?.organization && (organizations as readonly string[]).includes(profile.employee.organization) ? organizationNames[profile.employee.organization as keyof typeof organizationNames] : (profile?.employee?.organization ?? '-')}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Anggota Sejak</h3>
                  <p>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('id-ID') : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Profile Edit Form */}
          <div className="bg-white rounded-lg shadow overflow-hidden md:col-span-2">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Edit Profil</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                {/* Profile Image Upload */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Foto Profil</label>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100">
                      {previewUrl ? (
                        <Image 
                          src={previewUrl} 
                          alt="Preview Foto Profil" 
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="photo-upload" className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Ubah Foto
                      </label>
                      <input
                        id="photo-upload"
                        name="photo"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                      <p className="mt-1 text-xs text-gray-500">JPG, PNG, GIF maksimal 5MB</p>
                      {profileImage && (
                        <button
                          type="button"
                          onClick={() => setProfileImage(null)}
                          className="mt-1 text-xs text-red-600 hover:text-red-800"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
                    <input
                      id="name"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Alamat Email</label>
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
                        <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700">Nomor Telepon</label>
                        <input
                          id="contactNumber"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700">Alamat</label>
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
                    {updating ? 'Memperbarui...' : 'Perbarui Profil'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {/* Employee Information (if applicable) */}
          {profile?.employee && (
            <div className="bg-white rounded-lg shadow overflow-hidden md:col-span-3">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Informasi Karyawan</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">ID Karyawan</h3>
                    <p>{profile.employee.employeeId}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Jabatan</h3>
                    <p>{profile.employee.position}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Divisi</h3>
                    <p>{profile.employee.division}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">
                      {profile.employee.workScheduleType === "NON_SHIFT" ? "Rate Per Jam (Non Shift)" : "Gaji Pokok"}
                    </h3>
                    <p>
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
                        profile.employee.workScheduleType === "NON_SHIFT" 
                          ? (profile.employee.hourlyRate || 0) 
                          : profile.employee.basicSalary
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">BPJS Kesehatan</h3>
                    <p>
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
                        profile.employee.bpjsKesehatan || 0
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">BPJS Ketenagakerjaan</h3>
                    <p>
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
                        profile.employee.bpjsKetenagakerjaan || 0
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Tanggal Bergabung</h3>
                    <p>{new Date(profile.employee.joiningDate).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">Status</h3>
                    <p>
                      <span className={`inline-block px-2 py-1 text-xs rounded ${
                        profile.employee.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {profile.employee.isActive ? 'Aktif' : 'Tidak Aktif'}
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
            <h3 className="text-lg font-medium leading-6 text-gray-900">Ubah Password</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">Password Saat Ini</label>
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
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">Password Baru</label>
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
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Konfirmasi Password Baru</label>
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
                  {updating ? 'Memperbarui...' : 'Ubah Password'}
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
import Image from "next/image";
