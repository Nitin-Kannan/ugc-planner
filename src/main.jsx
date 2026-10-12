import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// If anything unexpected breaks while drawing the screen, show a way back
// instead of a blank white page. Her data is in the Google Sheet, so
// reloading is always safe.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UGC Planner crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <img src="./icon.svg" alt="" width="48" height="48" />
        <h2>Something went wrong on this screen</h2>
        <p>Your deliverables are safe in the Google Sheet. Reloading usually fixes this.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload the app
        </button>
        <details>
          <summary>Details for whoever maintains the app</summary>
          <code>{String(this.state.error?.message || this.state.error)}</code>
        </details>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
