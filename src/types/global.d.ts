declare global {
  interface Window {
    showAttendanceSuccess?: (message: string) => void;
  }
}

export {};