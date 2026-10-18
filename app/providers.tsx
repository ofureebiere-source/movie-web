'use client';
import Layout from '@/components/layout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Provider } from 'react-redux';
import { store } from '../redux/store';
import { PersistGate } from 'redux-persist/integration/react';
import persistStore from 'redux-persist/es/persistStore';
import AuthProvider from '@/components/context/auth-conext';
import { DropdownProvider } from '@/components/context/dropdown-context';
import DisclaimerModalProvider from '@/components/context/disclaimer-modal-context';
import DisclaimerGuard from '@/components/disclaimer/disclaimer-guard';
import IntroGate from '@/components/intro/intro-gate';
import NotificationPrompt from '@/components/notification/notification-prompt';
import useCollectionFetcher from 'hooks/useCollectionFetcher';
import useGuestLoginSync from 'hooks/useGuestLoginSync';
import PostHogProvider from '@/components/analytics/PostHogProvider';

const persistor = persistStore(store);

/**
 * Mounts side-effect hooks that need to run inside the Redux Provider tree.
 * Currently:
 *  - `useCollectionFetcher`: bootstraps the user's movie collection from
 *    Firestore once per login session.
 *  - `useGuestLoginSync`: on guest → login transition, migrates the local
 *    `recent_movies` history into Firestore so the home-page "Continue
 *    Watching" section keeps the user's progress across the auth boundary.
 */
function GlobalEffects() {
  useCollectionFetcher();
  useGuestLoginSync();
  return null;
}

export default function Providers({
  children,
  initialDisclaimerAccepted,
}: {
  children: React.ReactNode;
  initialDisclaimerAccepted: boolean;
}) {
  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}></PersistGate>
      <PostHogProvider>
        <AuthProvider>
          <DisclaimerModalProvider initialAccepted={initialDisclaimerAccepted}>
            <IntroGate>
              <DisclaimerGuard>
                  <GlobalEffects />
                  <DropdownProvider>
                    <Layout>{children}</Layout>
                  </DropdownProvider>
                  <NotificationPrompt />
                  <ToastContainer />
              </DisclaimerGuard>
            </IntroGate>
          </DisclaimerModalProvider>
        </AuthProvider>
      </PostHogProvider>
    </Provider>
  );
}
