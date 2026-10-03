import { NativeModules, Platform } from 'react-native';

interface WearConnectivityModule {
  /** Resolves after durable local enqueue, not remote delivery. */
  publishSnapshot(snapshotJson: string): Promise<void>;
}
// The plugin registers this module only for custom opted-in Android builds.
const WearConnectivity: WearConnectivityModule | null =
  Platform.OS === 'android'
    ? ((NativeModules.WearConnectivity as WearConnectivityModule | undefined) ??
      null)
    : null;
export default WearConnectivity;
