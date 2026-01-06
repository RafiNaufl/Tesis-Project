import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ctu.ems',
  appName: 'CTU EMS',
  webDir: 'public',
  server: {
    url: 'http://192.168.1.14:3000',
    cleartext: true
  }
};

export default config;
