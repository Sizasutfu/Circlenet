import { Suspense } from 'react';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Login | Circlenet Articles',
  description:
    'Sign in to Circlenet Articles and access commenting, liking, and personalized article actions.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-txt2">Loading login...</div>}>
      <LoginForm />
    </Suspense>
  );
}
