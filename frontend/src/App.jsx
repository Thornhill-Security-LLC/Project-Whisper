import { useState } from "react";
import "./App.css";

function App() {
  const [health, setHealth] = useState("");
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    setHealth("");
    try {
      const response = await fetch("http://localhost:8000/health");
      const data = await response.json();
      setHealth(JSON.stringify(data));
    } catch (error) {
      console.error(error);
      setHealth("Error contacting API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <h1>Project Whisper</h1>
      <p>Vite + React starter</p>
      <button type="button" onClick={checkHealth} disabled={loading}>
        {loading ? "Checking..." : "API Health"}
      </button>
      {health ? <pre className="health-result">{health}</pre> : null}
    </div>
  );
}

export default App;
