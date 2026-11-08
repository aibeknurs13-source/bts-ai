import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'katex/dist/katex.min.css';
import './styles.css';
import { reloadOnceOnChunkError } from './lib/util';

// Страница могла остаться открытой из устаревшей сборки — тогда динамический
// импорт чанка падает с «Failed to fetch dynamically imported module».
// Перезагружаем страницу один раз, чтобы подтянуть актуальные файлы.
window.addEventListener('unhandledrejection', (e) => {
  reloadOnceOnChunkError((e as PromiseRejectionEvent).reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
