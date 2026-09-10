import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { engine } from './game';
import { storage } from '../storage/storage';
import { initPersistence } from '../storage/persistence';
import { preloadSounds, probeAudio, unlockAudio } from '../services/audio';
import { readSharedState } from '../services/share';
import { config } from '../config';

document.documentElement.style.setProperty('--font-scale', String(config.ui.fontScale));

initPersistence(engine, storage);
const sharedState = readSharedState();
if (sharedState) engine.restore(sharedState);
preloadSounds();
probeAudio();
unlockAudio();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
