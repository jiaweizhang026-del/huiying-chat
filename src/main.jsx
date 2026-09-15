import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { loadState } from "./persistence.js";
import { initialState } from "./data.js";
import "./styles.css";
import "./community.css";
import "./companion.css";
function Boot() {
  const [state, setState] = React.useState(null),
    [error, setError] = React.useState(null);
  const loading = React.useRef(false);
  async function load() {
    if (loading.current) return;
    loading.current = true;
    setError(null);
    try {
      setState(await loadState(initialState));
    } catch (e) {
      setError(e.message);
    } finally {
      loading.current = false;
    }
  }
  React.useEffect(() => {
    load();
  }, []);
  return state ? (
    <App initialData={state} />
  ) : (
    <main className="workspace">
      <div className="boot-panel">
        <h1>回应</h1>
        <p role="status">{error || "正在读取你的聊天和日常…"}</p>
        {error && (
          <button className="primary-button" onClick={load}>
            重新连接本地后端
          </button>
        )}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Boot />);
