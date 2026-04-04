import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';

// biome-ignore lint/style/noNonNullAssertion: root element guaranteed in index.html
createRoot(document.getElementById('root')!).render(<App />);
