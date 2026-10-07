import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { engine } from './game';
import { storage } from '../storage/storage';
import { initPersistence } from '../storage/persistence';
import { preloadSounds, probeAudio, unlockAudio } from '../services/audio';
import { readSharedSession } from '../services/share';
import { config } from '../config';
import { AnalyticsService } from '../services/analytics';

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

document.documentElement.style.setProperty('--font-scale', String(config.ui.fontScale));

initPersistence(engine, storage);
const sharedSession = readSharedSession();
if (sharedSession) engine.restoreSession(sharedSession);
preloadSounds();
probeAudio();
unlockAudio();

// Initialize analytics if enabled
if (config.analytics.enabled) {
  const analytics = new AnalyticsService(storage, config.analytics, {
    version: __APP_VERSION__,
    platform: detectPlatform(),
  });

  // Wrap engine.dispatch to track actions. Select actions are excluded for privacy.
  const originalDispatch = engine.dispatch;
  engine.dispatch = (action) => {
    if (action.type !== 'select' && action.type !== 'selectGroups') {
      analytics.trackEvent(`action_${action.type}`, {});
    }
    originalDispatch.call(engine, action);
  };

  // Optional work starts after the first paint so it never blocks startup (ARCHITECTURE §32).
  const startAnalytics = () => {
    analytics.start();
    analytics.trackEvent('launch');
    analytics.trackEvent('session_start');
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (idle) {
    idle(startAnalytics);
  } else {
    window.setTimeout(startAnalytics, 0);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
