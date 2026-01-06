"use client";

import { useState, useEffect } from "react";
import { useSession, getSession } from "next-auth/react";
import { organizations, organizationNames } from "@/lib/registrationValidation";
import Image from "next/image";
import { 
  User, 
  Shield, 
  Camera, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Save
} from "lucide-react";

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
        className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl transition-all duration-300 transform translate-y-0 ${
          toast.variant === 'destructive' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {toast.variant === 'destructive' ? <AlertCircle className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">{toast.title}</h3>
            <p className="text-xs mt-0.5 opacity-90">{toast.description}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-100px)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-gray-500 text-sm font-medium">Memuat profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-20 md:pb-6">
      {/* Header with Background */}
      <div className="relative mb-16 md:mb-20">
        <div className="h-32 md:h-48 w-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-b-3xl md:rounded-3xl shadow-lg"></div>
        <div className="absolute -bottom-12 left-0 right-0 flex justify-center px-4">
          <div className="relative group">
            <div className="h-24 w-24 md:h-32 md:w-32 rounded-full border-4 border-white shadow-xl bg-white overflow-hidden relative">
              {previewUrl ? (
                <Image 
                  src={previewUrl} 
                  alt="Foto Profil" 
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                  <User className="h-10 w-10 md:h-12 md:w-12" />
                </div>
              )}
              {/* Overlay for uploading on desktop */}
              <label 
                htmlFor="photo-upload-overlay" 
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="h-8 w-8 text-white" />
              </label>
              <input
                id="photo-upload-overlay"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <label 
              htmlFor="photo-upload-mobile" 
              className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg border-2 border-white cursor-pointer md:hidden active:scale-95 transition-transform"
            >
              <Camera className="h-4 w-4" />
            </label>
            <input
              id="photo-upload-mobile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      <div className="text-center mb-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900">{profile?.name}</h1>
        <p className="text-gray-500 text-sm">{profile?.email}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 capitalize">
            {profile?.role?.toLowerCase()}
          </span>
          {profile?.employee?.isActive && (
            <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100">
              Aktif
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-6">
        <div className="bg-gray-100 p-1 rounded-xl flex">
          <button
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'profile' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('profile')}
          >
            <User className="h-4 w-4" />
            Profil
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'security' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('security')}
          >
            <Shield className="h-4 w-4" />
            Keamanan
          </button>
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="px-4 space-y-6">
          {/* Employee Info Card */}
          {profile?.employee && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-600" />
                  Informasi Pekerjaan
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                  <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">ID Karyawan</p>
                      <p className="text-gray-900 font-semibold mt-0.5">{profile.employee.employeeId}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Jabatan & Divisi</p>
                      <p className="text-gray-900 font-semibold mt-0.5">{profile.employee.position}</p>
                      <p className="text-sm text-gray-500">{profile.employee.division}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                      <Building className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Organisasi</p>
                      <p className="text-gray-900 font-semibold mt-0.5">
                        {profile.employee.organization && (organizations as readonly string[]).includes(profile.employee.organization) 
                          ? organizationNames[profile.employee.organization as keyof typeof organizationNames] 
                          : (profile.employee.organization ?? '-')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bergabung Sejak</p>
                      <p className="text-gray-900 font-semibold mt-0.5">{new Date(profile.employee.joiningDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Informasi Gaji & Tunjangan</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">
                          {profile.employee.workScheduleType === "NON_SHIFT" ? "Rate Per Jam" : "Gaji Pokok"}
                        </p>
                        <p className="font-semibold text-gray-900">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
                            profile.employee.workScheduleType === "NON_SHIFT" 
                              ? (profile.employee.hourlyRate || 0) 
                              : profile.employee.basicSalary
                          )}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">BPJS Kesehatan</p>
                        <p className="font-semibold text-gray-900">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
                            profile.employee.bpjsKesehatan || 0
                          )}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">BPJS Ketenagakerjaan</p>
                        <p className="font-semibold text-gray-900">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
                            profile.employee.bpjsKetenagakerjaan || 0
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Personal Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-600" />
                Informasi Pribadi
              </h3>
            </div>
            <div className="p-5">
              <form onSubmit={handleProfileUpdate} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Lengkap</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Nama Lengkap"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  {profile?.employee && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Nomor Telepon</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Phone className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            value={contactNumber}
                            onChange={(e) => setContactNumber(e.target.value)}
                            placeholder="0812..."
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Alamat</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                            <MapPin className="h-4 w-4 text-gray-400" />
                          </div>
                          <textarea
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px] resize-none"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Alamat Lengkap"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    className="w-full md:w-auto md:px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    disabled={updating}
                  >
                    {updating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Simpan Perubahan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-2xl mx-auto">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-600" />
                Ubah Password
              </h3>
            </div>
            <div className="p-5">
              <form onSubmit={handlePasswordUpdate} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Password Saat Ini</label>
                  <input
                    type="password"
                    className="block w-full px-3 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Password Baru</label>
                  <input
                    type="password"
                    className="block w-full px-3 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Konfirmasi Password Baru</label>
                  <input
                    type="password"
                    className="block w-full px-3 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {passwordError && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {passwordError}
                    </p>
                  )}
                </div>
                
                <div className="pt-2">
                  <button 
                    type="submit" 
                    className="w-full px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    disabled={updating}
                  >
                    {updating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memperbarui...
                      </>
                    ) : (
                      'Ubah Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast notification */}
      <Toast />
    </div>
  );
}
