'use client';

import React, { useState } from 'react';
import WebcamCapture from './WebcamCapture';
import LocationCapture from './LocationCapture';

interface AttendanceCaptureProps {
  onComplete: (photoUrl: string, latitude: number, longitude: number) => void;
  onCancel: () => void;
  actionType: 'check-in' | 'check-out';
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

const AttendanceCapture: React.FC<AttendanceCaptureProps> = ({ 
  onComplete, 
  onCancel,
  actionType,
  onSuccess,
  onError
 }) => {
  const [showWebcam, setShowWebcam] = useState(true);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [showFallbackOption, setShowFallbackOption] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePhotoCapture = (photoUrl: string) => {
    setCapturedPhoto(photoUrl);
    setShowWebcam(false);
    setIsCapturingLocation(true);
  };

  const handleLocationCaptured = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setIsCapturingLocation(false);
    setIsProcessing(true);
    
    // Jika foto dan lokasi sudah didapatkan, lanjutkan proses
    if (capturedPhoto) {
      onComplete(capturedPhoto, lat, lng);
    }
  };

  const handleLocationError = (errorMessage: string) => {
    setError(errorMessage);
    setIsCapturingLocation(false);
    
    // Teruskan error ke parent component
    if (onError) {
      onError(errorMessage);
    }
    
    // Untuk check-out, berikan opsi untuk melanjutkan tanpa lokasi presisi
    if (actionType === 'check-out') {
      setShowFallbackOption(true);
    } else {
      // Untuk check-in, berikan opsi retry dan fallback
      setShowFallbackOption(true);
    }
  };
  
  // Fungsi untuk melanjutkan check-out tanpa lokasi presisi
  const handleContinueWithoutPreciseLocation = () => {
    if (capturedPhoto) {
      setIsProcessing(true);
      // Gunakan koordinat default atau koordinat terakhir yang diketahui
      const defaultLat = -6.2088; // Default Jakarta
      const defaultLng = 106.8456;
      onComplete(capturedPhoto, defaultLat, defaultLng);
    }
  };

  // Fungsi untuk menampilkan pesan sukses
  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setIsProcessing(false);
    
    // Tutup modal setelah 3 detik
    setTimeout(() => {
      onCancel();
    }, 3000);
  };

  // Expose showSuccessMessage melalui onSuccess prop
  React.useEffect(() => {
    if (onSuccess) {
      // Simpan referensi ke showSuccessMessage di parent component
      (window as any).showAttendanceSuccess = showSuccessMessage;
    }
  }, [onSuccess]);

  const handleCancel = () => {
    onCancel();
  };
  
  // Fungsi untuk mencoba ulang mendapatkan lokasi
  const handleRetry = () => {
    setError(null);
    setIsCapturingLocation(true);
    setShowFallbackOption(false);
  };

  const actionText = actionType === 'check-in' ? 'Absen Masuk' : 'Absen Keluar';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{actionText}</h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {showWebcam ? (
          <WebcamCapture 
            onCapture={handlePhotoCapture} 
            onCancel={handleCancel} 
          />
        ) : isCapturingLocation ? (
          <div className="p-4">
            <div className="text-center mb-4">
              <h3 className="font-medium">Foto berhasil diambil!</h3>
              <p className="text-sm text-gray-600">Sedang mendapatkan lokasi Anda...</p>
            </div>
            
            {capturedPhoto && (
              <div className="flex justify-center mb-4">
                <img 
                  src={capturedPhoto} 
                  alt="Captured" 
                  className="rounded-lg max-w-full h-64 object-cover" 
                />
              </div>
            )}
            
            <LocationCapture 
              onLocationCaptured={handleLocationCaptured}
              onError={handleLocationError}
            />
            
            {showFallbackOption && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700 mb-2">
                  {actionType === 'check-in' 
                    ? 'Kesulitan mendapatkan lokasi GPS yang akurat. Pastikan GPS aktif dan coba lagi, atau lanjutkan dengan lokasi perkiraan:'
                    : 'Kesulitan mendapatkan lokasi GPS yang akurat. Untuk absen keluar, Anda dapat:'
                  }
                </p>
                <div className="flex space-x-2">
                  <button 
                    onClick={handleRetry}
                    className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm"
                  >
                    Coba Lagi
                  </button>
                  <button 
                    onClick={handleContinueWithoutPreciseLocation}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded text-sm"
                  >
                    {actionType === 'check-in' 
                      ? 'Lanjutkan dengan Lokasi Perkiraan'
                      : 'Lanjutkan Tanpa Lokasi Presisi'
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : successMessage ? (
          <div className="p-4 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-green-600">Berhasil!</h3>
              <p className="mt-1 text-sm text-gray-700">{successMessage}</p>
              <p className="mt-2 text-xs text-gray-500">Modal akan tertutup otomatis dalam 3 detik...</p>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="p-4 text-center">
            <div className="mb-4">
              <div className="mx-auto h-12 w-12 text-blue-500 animate-spin">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium">Proses {actionText} Sedang Diproses</h3>
              <p className="mt-1 text-sm text-gray-500">Mohon tunggu sebentar...</p>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="mt-2 text-lg font-medium">Proses {actionText} Selesai</h3>
              <p className="mt-1 text-sm text-gray-500">Data berhasil disimpan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCapture;