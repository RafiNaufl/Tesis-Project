'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import WebcamCapture from './WebcamCapture';
import LocationCapture from './LocationCapture';

interface AttendanceCaptureProps {
  onComplete: (photoUrl: string, latitude: number, longitude: number, locationNote?: string) => void;
  onCancel: () => void;
  actionType: 'check-in' | 'check-out' | 'overtime-start' | 'overtime-end';
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  requireOvertimeConfirmation?: boolean;
}

const AttendanceCapture: React.FC<AttendanceCaptureProps> = ({ 
  onComplete, 
  onCancel,
  actionType,
  onSuccess,
  onError,
  requireOvertimeConfirmation
 }) => {
  const [showWebcam, setShowWebcam] = useState(true);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [showFallbackOption, setShowFallbackOption] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState<string>("");
  const [overtimeReason, setOvertimeReason] = useState<string>("");
  const [policyConfirmed, setPolicyConfirmed] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [capturedLat, setCapturedLat] = useState<number | null>(null);
  const [capturedLng, setCapturedLng] = useState<number | null>(null);

  const handlePhotoCapture = (photoUrl: string) => {
    setCapturedPhoto(photoUrl);
    setShowWebcam(false);
    setIsCapturingLocation(true);
  };

  const handleLocationCaptured = (lat: number, lng: number) => {
    setIsCapturingLocation(false);
    // Untuk 'overtime-start' atau checkout yang memerlukan konfirmasi lembur
    if (actionType === 'overtime-start' || (actionType === 'check-out' && requireOvertimeConfirmation)) {
      setIsProcessing(false);
      setFormError(null);
      // Simpan lokasi untuk submit nanti
      setCapturedLat(lat);
      setCapturedLng(lng);
    } else {
      setIsProcessing(true);
      if (capturedPhoto) {
        onComplete(capturedPhoto, lat, lng, manualAddress || undefined);
      }
    }
  };

  const handleOvertimeSubmit = () => {
    setFormError(null);
    if (overtimeReason.trim().length < 20) {
      setFormError("Alasan lembur minimal 20 karakter");
      return;
    }
    if (!policyConfirmed) {
      setFormError("Anda harus menyetujui kebijakan lembur perusahaan");
      return;
    }
    if (capturedPhoto && capturedLat !== null && capturedLng !== null) {
      setIsProcessing(true);
      const payloadNote = manualAddress || undefined;
      // Kirim ke parent dengan alasan sebagai bagian dari locationNote (tetap kirim terpisah via parent)
      // Parent akan meneruskan reason & consentConfirmed ke API
      (window as any).overtimeReason = overtimeReason;
      (window as any).overtimeConsentConfirmed = true;
      onComplete(capturedPhoto, capturedLat!, capturedLng!, payloadNote);
    }
  };

  const handleLocationError = (errorMessage: string) => {
    setError(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
    setShowFallbackOption(false);
  };
  
  // Fungsi untuk melanjutkan check-out tanpa lokasi presisi
  const handleContinueWithoutPreciseLocation = () => {
    const msg = 'Foto dan lokasi wajib untuk semua jenis presensi.';
    setError(msg);
    if (onError) onError(msg);
  };

  // Fungsi untuk menampilkan pesan sukses
  const showSuccessMessage = useCallback((message: string) => {
    setSuccessMessage(message);
    setIsProcessing(false);
    
    // Tutup modal setelah 3 detik
    setTimeout(() => {
      onCancel();
    }, 3000);
  }, [onCancel]);

  // Expose showSuccessMessage melalui onSuccess prop
  React.useEffect(() => {
    if (onSuccess) {
      // Simpan referensi ke showSuccessMessage di parent component
      (window as any).showAttendanceSuccess = showSuccessMessage;
    }
  }, [onSuccess, showSuccessMessage]);

  const handleCancel = () => {
    onCancel();
  };
  
  // Fungsi untuk mencoba ulang mendapatkan lokasi
  const handleRetry = () => {
    setError(null);
    setIsCapturingLocation(true);
    setShowFallbackOption(false);
  };

  const actionText =
    actionType === 'check-in'
      ? 'Absen Masuk'
      : actionType === 'check-out'
      ? 'Absen Keluar'
      : actionType === 'overtime-start'
      ? 'Mulai Lembur'
      : 'Selesai Lembur';

  const isOvertimeFormStep = (actionType === 'overtime-start' || (actionType === 'check-out' && requireOvertimeConfirmation)) && !isProcessing && !showWebcam && !isCapturingLocation;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[200] sm:p-4">
      <div className="bg-white shadow-xl w-full h-full sm:h-auto sm:max-w-md sm:rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-4 border-b border-gray-100 bg-white z-10 sticky top-0">
          <h2 className="text-lg font-semibold text-gray-900">{actionText}</h2>
          {!isOvertimeFormStep && (
            <button
              onClick={handleCancel}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex justify-between items-start animate-in slide-in-from-top-2">
              <span className="flex-1 mr-2">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700 font-bold"
              >
                &times;
              </button>
            </div>
          )}

          {showWebcam ? (
            <div className="flex-1 flex flex-col min-h-0">
              <WebcamCapture 
                onCapture={handlePhotoCapture} 
                onCancel={handleCancel} 
              />
            </div>
          ) : isCapturingLocation ? (
            <div className="flex flex-col h-full space-y-4">
              <div className="text-center py-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-900">Foto berhasil diambil!</h3>
                <p className="text-sm text-gray-500">Sedang mendapatkan lokasi Anda...</p>
              </div>
              
              {capturedPhoto && (
                <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-gray-100 shadow-inner">
                  <Image 
                    src={capturedPhoto} 
                    alt="Foto hasil tangkap" 
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              
              <LocationCapture 
                onLocationCaptured={handleLocationCaptured}
                onError={handleLocationError}
              />
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Catatan lokasi (opsional)</label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Contoh: Gerbang Utama, Jl. Mawar No. 1"
                  className="w-full rounded-xl border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                />
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Info tambahan untuk validasi lokasi
                </p>
              </div>
              
              {showFallbackOption && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-3">
                  <p className="text-sm text-orange-800">
                    Kesulitan mendapatkan lokasi GPS yang akurat. Pastikan GPS aktif dan memiliki akses langit yang jelas.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleRetry}
                      className="w-full bg-white border border-orange-200 text-orange-700 py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors"
                    >
                      Coba Lagi
                    </button>
                    <button 
                      onClick={handleContinueWithoutPreciseLocation}
                      className="w-full bg-orange-100 text-orange-800 py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
                    >
                      Lanjut Tanpa Lokasi
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : isOvertimeFormStep && !isProcessing ? (
            <div className="flex flex-col h-full">
              <div className="space-y-4 flex-1">
                <div>
                  <label htmlFor="overtime-reason" className="block text-sm font-medium text-gray-700 mb-1">Alasan lembur</label>
                  <textarea
                    id="overtime-reason"
                    value={overtimeReason}
                    onChange={(e) => setOvertimeReason(e.target.value)}
                    minLength={20}
                    required
                    aria-required="true"
                    aria-invalid={!!formError}
                    className="w-full rounded-xl border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm min-h-[120px]"
                    placeholder="Jelaskan detail pekerjaan lembur yang dilakukan (minimal 20 karakter)..."
                  />
                  <div className="mt-1 flex justify-between text-xs">
                     <span className={`${overtimeReason.trim().length < 20 ? 'text-orange-600' : 'text-green-600'}`}>
                       {overtimeReason.trim().length}/20 karakter
                     </span>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={policyConfirmed}
                        onChange={(e) => setPolicyConfirmed(e.target.checked)}
                        className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        aria-checked={policyConfirmed}
                      />
                    </div>
                    <span className="text-sm text-gray-700">
                      Saya menyatakan bahwa lembur ini dilakukan atas instruksi atasan dan sesuai dengan kebijakan perusahaan yang berlaku.
                    </span>
                  </label>
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formError}
                  </div>
                )}
              </div>
              
              <div className="mt-6 grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleCancel}
                  className="w-full inline-flex justify-center items-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all active:scale-[0.98]"
                >
                  Batal
                </button>
                <button
                  onClick={handleOvertimeSubmit}
                  disabled={!(overtimeReason.trim().length >= 20 && policyConfirmed)}
                  className={`w-full inline-flex justify-center items-center rounded-xl px-4 py-3 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all active:scale-[0.98] ${
                    overtimeReason.trim().length >= 20 && policyConfirmed 
                    ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' 
                    : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {actionType === 'overtime-start' ? 'Kirim' : 'Konfirmasi'}
                </button>
              </div>
            </div>
          ) : successMessage ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4 animate-in zoom-in duration-300">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Berhasil!</h3>
                <p className="mt-2 text-gray-600">{successMessage}</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1 mt-8 overflow-hidden">
                <div className="bg-green-500 h-1 rounded-full animate-[progress_3s_ease-in-out_forwards]" style={{width: '100%'}}></div>
              </div>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Memproses Data</h3>
                <p className="mt-1 text-sm text-gray-500">Mohon jangan tutup halaman ini...</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Selesai</h3>
              <p className="mt-1 text-sm text-gray-500">Data berhasil disimpan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceCapture;
