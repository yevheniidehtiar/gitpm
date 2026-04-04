import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>GitPM</h1>
      <p>Git-Native Project Management</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
