'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface LocationCaptureProps {
  onLocationCaptured: (latitude: number, longitude: number) => void;
  onError: (error: string) => void;
}

const LocationCapture: React.FC<LocationCaptureProps> = ({ onLocationCaptured, onError }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const captureLocation = useCallback(async (retryCount = 0) => {
    setIsCapturing(true);
    setLocationError(null);

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolokasi tidak didukung oleh browser Anda.');
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          onLocationCaptured(latitude, longitude);
          setIsCapturing(false);
        },
        (error) => {
          // Retry logic untuk masalah GPS, terutama saat check-out
          if (retryCount < 2 && (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT)) {
            console.log(`GPS retry attempt ${retryCount + 1}/2`);
            setTimeout(() => {
              captureLocation(retryCount + 1);
            }, 2000);
            return;
          }
          
          let errorMessage = 'Gagal mendapatkan lokasi.';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Akses lokasi ditolak. Silakan berikan izin lokasi di pengaturan browser Anda dan refresh halaman.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Informasi lokasi tidak tersedia. Pastikan GPS aktif, pindah ke area terbuka, dan coba lagi.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Waktu permintaan lokasi habis. Pastikan sinyal GPS kuat dan coba lagi.';
              break;
          }
          
          setLocationError(errorMessage);
          onError(errorMessage);
          setIsCapturing(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000, // Increased timeout untuk memberikan waktu lebih
          maximumAge: 60000 // Allow older location untuk mengurangi error
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat mendapatkan lokasi.';
      setLocationError(errorMessage);
      onError(errorMessage);
      setIsCapturing(false);
    }
  }, [onLocationCaptured, onError]);

  useEffect(() => {
    captureLocation();
  }, [captureLocation]);

  const handleRetry = () => {
    captureLocation();
  };

  return (
    <div className="mt-2">
      {isCapturing && (
        <div className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Mendapatkan lokasi Anda...</span>
        </div>
      )}
      
      {locationError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-2">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Masalah GPS</h3>
              <div className="mt-1 text-sm text-red-700">{locationError}</div>
              <div className="mt-3">
                <button 
                  onClick={handleRetry}
                  className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm font-medium transition-colors"
                >
                  🔄 Coba Lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationCapture;