import { Redirect } from 'expo-router';

export default function Index() {
  // TODO: Check auth state, redirect accordingly
  return <Redirect href="/(main)" />;
}
