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

document.documentElement.style.setProperty('--font-scale', String(config.ui.fontScale));

initPersistence(engine, storage);
const sharedSession = readSharedSession();
if (sharedSession) engine.restoreSession(sharedSession);
preloadSounds();
probeAudio();
unlockAudio();

// Initialize analytics if enabled
if (config.analytics.enabled) {
  const analytics = new AnalyticsService(storage, config.analytics);
  analytics.start();
  
  // Wrap engine.dispatch to track actions
  const originalDispatch = engine.dispatch;
  engine.dispatch = (action) => {
    // Track the action type (excluding select and selectGroups for privacy)
    if (action.type !== 'select' && action.type !== 'selectGroups') {
      analytics.trackEvent(`action_${action.type}`, {});
    }
    originalDispatch.call(engine, action);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
