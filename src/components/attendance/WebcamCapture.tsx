'use client';

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';

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

  const videoConstraints = {
    width: 320,
    height: 320,
    facingMode: facingMode,
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        setIsCaptureEnabled(false);
      } else {
        setError('Gagal mengambil gambar. Pastikan kamera Anda berfungsi dengan baik.');
      }
    }
  }, [webcamRef]);

  const retake = () => {
    setCapturedImage(null);
    setIsCaptureEnabled(true);
    setError(null);
  };

  const confirmImage = () => {
    if (capturedImage) {
      onCapture(capturedImage);
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
          {isCaptureEnabled ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                onUserMediaError={handlePermissionDenied}
                className="rounded-lg mb-4"
                mirrored={facingMode === 'user'}
              />
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={capture}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  Ambil Foto
                </button>
                <button
                  onClick={switchCamera}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg"
                >
                  Ganti Kamera
                </button>
              </div>
            </>
          ) : (
            <>
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured"
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