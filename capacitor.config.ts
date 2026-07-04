import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ctu.ems.tesis',
  appName: 'CTU EMS',
  webDir: 'public',
  server: {
    url: 'https://tesis-project.vercel.app',
    cleartext: false
  },
  ios: {
    contentInset: "always"
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  }
};

export default config;
