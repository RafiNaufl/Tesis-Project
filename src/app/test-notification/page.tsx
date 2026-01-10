'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export default function TestNotificationPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sendTestNotification = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/test-notification', {
        method: 'POST',
      });
      const data = await res.json();
      setResult(data);
      
      if (data.success) {
        if (data.firebaseResult.successCount > 0) {
          toast.success(`Sent successfully to ${data.firebaseResult.successCount} devices`);
        } else {
          toast.error('Sent but no devices accepted it (invalid tokens?)');
        }
      } else {
        toast.error(data.message || 'Failed to send');
      }
    } catch (error) {
      console.error(error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <div className="p-8">Please login first</div>;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Push Notifications</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <p className="mb-4">
          <strong>User ID:</strong> {session.user.id}
        </p>
        <p className="mb-4 text-gray-600">
          Click the button below to send a test notification to all your registered devices.
          Ensure this app is installed on your phone and you are logged in.
        </p>
        
        <button
          onClick={sendTestNotification}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Test Notification'}
        </button>
      </div>

      {result && (
        <div className="bg-gray-100 p-4 rounded overflow-auto">
          <h2 className="font-bold mb-2">Result:</h2>
          <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
