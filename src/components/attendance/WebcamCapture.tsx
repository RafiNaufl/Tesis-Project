'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Webcam from 'react-webcam';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

interface WebcamCaptureProps {
  onCapture: (photoUrl: string) => void;
  onCancel: () => void;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, onCancel }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isCaptureEnabled, setIsCaptureEnabled] = useState<boolean>(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<string>('user');
  const [error, setError] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isNative, setIsNative] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    setIsLoading(false);
  }, []);

  const videoConstraints = {
    width: 320,
    height: 320,
    facingMode: facingMode,
  };

  const captureNative = useCallback(async () => {
    try {
      const permissions = await Camera.checkPermissions();
      if (permissions.camera !== 'granted') {
        const requested = await Camera.requestPermissions();
        if (requested.camera !== 'granted') {
          setError('Izin kamera diperlukan untuk mengambil foto.');
          return;
        }
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: facingMode === 'user' ? CameraDirection.Front : CameraDirection.Rear
      });

      if (image.dataUrl) {
        setCapturedImage(image.dataUrl);
        setIsCaptureEnabled(false);
        setError(null);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.message !== 'User cancelled photos app') {
        setError('Gagal mengambil gambar dari kamera native. Pastikan izin diberikan.');
      }
    }
  }, [facingMode]);

  const capture = useCallback(() => {
    if (isNative) {
      captureNative();
      return;
    }

    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        setIsCaptureEnabled(false);
      } else {
        setError('Gagal mengambil gambar. Pastikan kamera Anda berfungsi dengan baik.');
      }
    }
  }, [webcamRef, isNative, captureNative]);

  // Auto-launch camera on native devices
  useEffect(() => {
    if (isNative && isCaptureEnabled && !isLoading) {
      captureNative();
    }
  }, [isNative, isCaptureEnabled, isLoading, captureNative]);

  const retake = () => {
    setCapturedImage(null);
    setIsCaptureEnabled(true);
    setError(null);
  };

  const confirmImage = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      return;
    }
    if (uploadPreview && uploadedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null;
        if (result) onCapture(result);
      };
      reader.readAsDataURL(uploadedFile);
    }
  };

  const switchCamera = () => {
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
  };

  const handlePermissionDenied = () => {
    setError('Akses kamera ditolak. Silakan berikan izin kamera untuk menggunakan fitur ini.');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Ambil Foto</h2>
          <button
            onClick={onCancel}
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
          </div>
        )}

        <div className="flex flex-col items-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 w-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : isCaptureEnabled ? (
            <>
              {!isNative ? (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  onUserMediaError={handlePermissionDenied}
                  className="rounded-lg mb-4"
                  mirrored={facingMode === 'user'}
                />
              ) : (
                <div 
                  className="flex items-center justify-center bg-gray-100 rounded-lg mb-4 border-2 border-dashed border-gray-300"
                  style={{ width: 320, height: 320 }}
                >
                  <div className="text-center p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-500 text-sm">Gunakan kamera bawaan HP</p>
                  </div>
                </div>
              )}
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={capture}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  {isNative ? 'Buka Kamera' : 'Ambil Foto'}
                </button>
                <button
                  onClick={switchCamera}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg"
                >
                  Ganti Kamera
                </button>
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Atau unggah foto (JPEG/PNG, maks 5MB)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (!file) return;
                    const allowed = ["image/jpeg", "image/png"];
                    if (!allowed.includes(file.type)) {
                      setError("Format file harus JPEG atau PNG");
                      setUploadedFile(null);
                      setUploadPreview(null);
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setError("Ukuran file melebihi batas 5MB");
                      setUploadedFile(null);
                      setUploadPreview(null);
                      return;
                    }
                    setError(null);
                    setUploadedFile(file);
                    const previewUrl = URL.createObjectURL(file);
                    setUploadPreview(previewUrl);
                    setIsCaptureEnabled(false);
                    setCapturedImage(null);
                  }}
                  className="block w-full text-sm text-gray-700"
                />
                {uploadPreview && (
                  <div className="mt-3">
                    <Image
                      src={uploadPreview}
                      alt="Preview unggahan"
                      width={320}
                      height={320}
                      unoptimized
                      className="rounded-lg mb-2 max-w-full"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {(capturedImage || uploadPreview) && (
                <Image
                  src={capturedImage || uploadPreview!}
                  alt="Foto hasil tangkap"
                  width={320}
                  height={320}
                  unoptimized
                  className="rounded-lg mb-4 max-w-full"
                />
              )}
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={confirmImage}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
                >
                  Gunakan Foto
                </button>
                <button
                  onClick={retake}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg"
                >
                  Ambil Ulang
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-500">
          <p>Pastikan wajah Anda terlihat jelas dalam foto.</p>
          <p>Foto ini akan digunakan untuk verifikasi kehadiran Anda.</p>
        </div>
      </div>
    </div>
  );
};

export default WebcamCapture;
