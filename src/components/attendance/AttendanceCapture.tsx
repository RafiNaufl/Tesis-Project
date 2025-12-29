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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{actionText}</h2>
          {!isOvertimeFormStep && (
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
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
                <Image 
                  src={capturedPhoto} 
                  alt="Foto hasil tangkap" 
                  width={512}
                  height={384}
                  unoptimized
                  className="rounded-lg max-w-full h-64 object-cover" 
                />
              </div>
            )}
            
            <LocationCapture 
              onLocationCaptured={handleLocationCaptured}
              onError={handleLocationError}
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan alamat (opsional)</label>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Contoh: Gerbang Utama, Jl. Mawar No. 1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">Alamat manual akan dikirim sebagai informasi tambahan untuk atasan.</p>
            </div>
            
            {showFallbackOption && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700 mb-2">
                  'Kesulitan mendapatkan lokasi GPS yang akurat. Foto dan lokasi wajib — pastikan GPS aktif dan coba lagi.'
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
                    Tidak bisa lanjut tanpa lokasi
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : isOvertimeFormStep && !isProcessing ? (
          <div className="p-4">
            <div className="mb-4">
              <label htmlFor="overtime-reason" className="block text-sm font-medium text-gray-700 mb-1">Alasan lembur</label>
              <textarea
                id="overtime-reason"
                value={overtimeReason}
                onChange={(e) => setOvertimeReason(e.target.value)}
                minLength={20}
                required
                aria-required="true"
                aria-invalid={!!formError}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                rows={4}
                placeholder="Jelaskan alasan lembur (minimal 20 karakter)"
              />
              <p className="mt-1 text-xs text-gray-500">Minimal 20 karakter</p>
            </div>
            <div className="mb-4">
              <label className="inline-flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={policyConfirmed}
                  onChange={(e) => setPolicyConfirmed(e.target.checked)}
                  className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  aria-checked={policyConfirmed}
                />
                Saya memahami kebijakan lembur perusahaan
              </label>
            </div>
            {formError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                {formError}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancel}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Batal
              </button>
              <button
                onClick={handleOvertimeSubmit}
                className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${overtimeReason.trim().length >= 20 && policyConfirmed ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500' : 'bg-orange-300 cursor-not-allowed'}`}
                disabled={!(overtimeReason.trim().length >= 20 && policyConfirmed)}
              >
                {actionType === 'overtime-start' ? 'Kirim Permintaan Lembur' : 'Konfirmasi Lembur & Checkout'}
              </button>
            </div>
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
