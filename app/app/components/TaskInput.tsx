"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Duration, Personality, Subtask } from "../lib/types";
import { addTask } from "../lib/actions";

const DURATIONS: Duration[] = [15, 30, 45, 60];

const EXAMPLES = [
  "Prepare quarterly report",
  "Plan team offsite meeting",
  "Write blog post about AI",
  "Clean up the garage",
  "Research vacation destinations",
  "Update resume for job applications",
];

export default function TaskInput() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManualMode, setShowManualMode] = useState(false);
  const [manualSubtasks, setManualSubtasks] = useState<Subtask[]>([]);
  const [manualDuration, setManualDuration] = useState<Duration>(15);
  const [newStep, setNewStep] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Check speech recognition support
  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  // Check Ollama status on mount
  useEffect(() => {
    const checkOllama = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        setOllamaStatus(data.ollama ? "online" : "offline");
      } catch {
        setOllamaStatus("offline");
      }
    };
    checkOllama();
    const interval = setInterval(checkOllama, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");

    // If AI is available, process and add directly
    if (ollamaStatus === "online") {
      try {
        const response = await fetch("/api/breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: input.trim(), personality: "coach" }),
        });

        if (!response.ok) {
          throw new Error("Failed to break down task");
        }

        const data = await response.json();

        if (!data.subtasks || data.subtasks.length === 0) {
          throw new Error("No subtasks returned");
        }

        // Add task directly - no preview!
        await addTask(
          data.task || input.trim(),
          data.subtasks,
          data.why || "Let's get this done.",
          data.coreWhy || "This task moves you forward.",
          data.duration || 15,
          "coach"
        );

        setInput("");
        router.refresh();
      } catch (err) {
        console.error("Breakdown error:", err);
        // Fall back to manual mode
        setShowManualMode(true);
        setError("AI couldn't process this task. Add steps manually.");
      }
    } else {
      // AI offline - show manual mode
      setShowManualMode(true);
    }

    setLoading(false);
  };

  const handleAddStep = async () => {
    if (!newStep.trim()) return;
    let stepText = newStep.trim();

    // Try to polish if online
    if (ollamaStatus === "online") {
      try {
        const response = await fetch("/api/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: stepText }),
        });
        if (response.ok) {
          const data = await response.json();
          stepText = data.polished || stepText;
        }
      } catch {
        // Use original
      }
    }

    setManualSubtasks([
      ...manualSubtasks,
      { id: `manual-${Date.now()}`, text: stepText, completed: false },
    ]);
    setNewStep("");
  };

  const handleRemoveStep = (id: string) => {
    setManualSubtasks(manualSubtasks.filter((st) => st.id !== id));
  };

  const handleManualAdd = async () => {
    if (manualSubtasks.length === 0) return;
    setLoading(true);

    try {
      await addTask(
        input.trim(),
        manualSubtasks.map((st) => st.text),
        "You've got this.",
        "This needs to get done.",
        manualDuration,
        "coach"
      );
      setInput("");
      setShowManualMode(false);
      setManualSubtasks([]);
      router.refresh();
    } catch {
      setError("Failed to add task");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowManualMode(false);
    setManualSubtasks([]);
    setNewStep("");
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceInput = () => {
    if (!speechSupported) return;

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.start();
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
  };

  return (
    <div style={styles.container}>
      <div style={styles.statusRow}>
        <span
          style={styles.statusIndicator}
          title={ollamaStatus === "online" ? "AI will auto-process tasks" : "Manual mode - add your own steps"}
        >
          <span
            style={{
              ...styles.statusDot,
              ...(ollamaStatus === "online" ? styles.statusDotOnline : {}),
              ...(ollamaStatus === "offline" ? styles.statusDotOffline : {}),
            }}
          />
          {ollamaStatus === "checking" && "Checking..."}
          {ollamaStatus === "online" && "AI ready"}
          {ollamaStatus === "offline" && "Manual mode"}
        </span>
      </div>

      {!showManualMode ? (
        <>
          <div style={styles.inputRow}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Clean up the garage before weekend"
              style={styles.input}
              disabled={loading}
            />
            {speechSupported && (
              <button
                onClick={handleVoiceInput}
                disabled={loading || isListening}
                style={{
                  ...styles.voiceBtn,
                  ...(isListening ? styles.voiceBtnActive : {}),
                }}
                title="Voice input"
              >
                🎙
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              style={{
                ...styles.submitBtn,
                ...(!input.trim() || loading ? styles.btnDisabled : {}),
              }}
            >
              +
            </button>
          </div>
          {!input && !loading && (
            <div style={styles.examplesRow}>
              {EXAMPLES.slice(0, 3).map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  style={styles.exampleBtn}
                >
                  {example}
                </button>
              ))}
            </div>
          )}
          {error && <p style={styles.error}>{error}</p>}
        </>
      ) : (
        <div style={styles.manualMode}>
          <div style={styles.manualHeader}>
            <h3 style={styles.manualTitle}>{input}</h3>
            <div style={styles.durationPicker}>
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setManualDuration(d)}
                  style={{
                    ...styles.durationBtn,
                    ...(d === manualDuration ? styles.durationBtnActive : {}),
                  }}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          <p style={styles.manualNote}>Add your steps below</p>

          <div style={styles.stepList}>
            {manualSubtasks.map((st, i) => (
              <div key={st.id} style={styles.stepItem}>
                <span style={styles.stepNumber}>{i + 1}.</span>
                <span style={styles.stepText}>{st.text}</span>
                <button onClick={() => handleRemoveStep(st.id)} style={styles.stepRemoveBtn}>
                  ×
                </button>
              </div>
            ))}
            {manualSubtasks.length === 0 && (
              <p style={styles.noStepsHint}>Add at least one step</p>
            )}
          </div>

          <div style={styles.addStepRow}>
            <input
              type="text"
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStep()}
              placeholder="Add a step..."
              style={styles.addStepInput}
              autoFocus
            />
            {newStep.trim() && (
              <button onClick={handleAddStep} style={styles.addStepBtn}>+</button>
            )}
          </div>

          <div style={styles.manualActions}>
            <button onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
            <button
              onClick={handleManualAdd}
              disabled={loading || manualSubtasks.length === 0}
              style={{
                ...styles.addBtn,
                ...(manualSubtasks.length === 0 ? styles.btnDisabled : {}),
              }}
            >
              {loading ? "Adding..." : "Add Task"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { marginBottom: "1rem" },
  statusRow: { display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" },
  statusIndicator: { display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--fg-muted)" },
  statusDot: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--fg-muted)" },
  statusDotOnline: { background: "#28a745" },
  statusDotOffline: { background: "#dc3545" },
  inputRow: { display: "flex", gap: "0.5rem" },
  input: { flex: 1, padding: "0.875rem 1rem", fontSize: "1rem", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--fg-primary)", outline: "none" },
  voiceBtn: { padding: "0.875rem 1rem", fontSize: "1.1rem", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer", flexShrink: 0 },
  voiceBtnActive: { background: "rgba(220, 53, 69, 0.2)", borderColor: "#dc3545" },
  submitBtn: { padding: "0.875rem 1.25rem", fontSize: "1.25rem", fontWeight: 500, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--fg-primary)", cursor: "pointer", whiteSpace: "nowrap" },
  examplesRow: { display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" },
  exampleBtn: { padding: "0.5rem 0.75rem", fontSize: "0.8rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "20px", color: "var(--fg-muted)", cursor: "pointer", whiteSpace: "nowrap" },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  error: { marginTop: "0.5rem", fontSize: "0.85rem", color: "#dc3545" },
  manualMode: { padding: "1.25rem", background: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border)" },
  manualHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" },
  manualTitle: { margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "var(--fg-primary)" },
  durationPicker: { display: "flex", gap: "0.25rem" },
  durationBtn: { padding: "0.25rem 0.5rem", fontSize: "0.8rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-muted)", cursor: "pointer" },
  durationBtnActive: { background: "var(--fg-primary)", color: "var(--bg-primary)", borderColor: "var(--fg-primary)" },
  manualNote: { margin: "0 0 1rem 0", padding: "0.5rem 0.75rem", fontSize: "0.85rem", color: "rgba(255, 193, 7, 0.9)", background: "rgba(255, 193, 7, 0.1)", borderRadius: "6px", border: "1px solid rgba(255, 193, 7, 0.3)" },
  stepList: { display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" },
  stepItem: { display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.625rem 0.75rem", background: "var(--bg-tertiary)", borderRadius: "6px" },
  stepNumber: { fontSize: "0.9rem", fontWeight: 500, color: "var(--fg-muted)", minWidth: "1.25rem" },
  stepText: { flex: 1, fontSize: "0.9rem", color: "var(--fg-primary)" },
  stepRemoveBtn: { padding: "0.125rem 0.375rem", fontSize: "0.85rem", background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer" },
  noStepsHint: { padding: "1rem", textAlign: "center", fontSize: "0.85rem", color: "var(--fg-muted)", fontStyle: "italic" },
  addStepRow: { display: "flex", gap: "0.5rem", marginBottom: "1rem" },
  addStepInput: { flex: 1, padding: "0.5rem 0.75rem", fontSize: "0.85rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--fg-primary)", outline: "none" },
  addStepBtn: { padding: "0.5rem 0.75rem", fontSize: "1rem", background: "var(--fg-primary)", border: "none", borderRadius: "6px", color: "var(--bg-primary)", cursor: "pointer" },
  manualActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem" },
  cancelBtn: { padding: "0.625rem 1.25rem", fontSize: "0.9rem", background: "none", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--fg-secondary)", cursor: "pointer" },
  addBtn: { padding: "0.625rem 1.5rem", fontSize: "0.9rem", fontWeight: 500, background: "var(--fg-primary)", border: "none", borderRadius: "8px", color: "var(--bg-primary)", cursor: "pointer" },
};
