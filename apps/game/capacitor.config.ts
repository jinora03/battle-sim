import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kinetic.battleengine',
  appName: 'Kinetic Battle Engine',
  webDir: 'dist',
  backgroundColor: '#05070c',
  android: {
    allowMixedContent: false,
    backgroundColor: '#05070c'
  },
  ios: {
    backgroundColor: '#05070c',
    contentInset: 'automatic'
  }
};

export default config;
