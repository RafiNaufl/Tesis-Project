import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ctu.ems',
  appName: 'CTU EMS',
  webDir: 'public',
  server: {
    url: 'https://tesis-project.vercel.app',
    cleartext: false
  }
};

export default config;
