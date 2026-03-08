import { Redirect } from 'expo-router';

import { adminConfigState } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

export default function IndexScreen() {
  const config = useSnapshot(adminConfigState);
  const hasAccount = Boolean(config.baseUrl.trim());

  return <Redirect href={hasAccount ? '/monitor' : '/login'} />;
}
