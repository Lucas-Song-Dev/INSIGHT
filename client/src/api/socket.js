import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

let socket = null;

/**
 * Get or create the single Socket.IO client instance.
 * @returns {import("socket.io-client").Socket}
 */
function getSocket() {
  if (!socket) {
    socket = io(API_BASE, {
      path: "/socket.io",
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
}

/** @type {Map<string, (log: object) => void>} */
const jobLogHandlers = new Map();

function onJobLogPayload(payload) {
  const jobId = payload?.job_id;
  const log = payload?.log;
  if (!jobId || !log) return;
  const handler = jobLogHandlers.get(jobId);
  if (handler) handler(log);
}

/**
 * Subscribe to real-time pipeline logs for a job.
 * @param {string} jobId - Job ID
 * @param {(log: object) => void} onLog - Callback for each new log entry
 */
export function subscribeJobLogs(jobId, onLog) {
  if (!jobId) return;
  const s = getSocket();
  if (!jobLogHandlers.size) {
    s.on("job_log", onJobLogPayload);
  }
  jobLogHandlers.set(jobId, onLog);
  s.emit("subscribe_job", { job_id: jobId });
}

/**
 * Unsubscribe from pipeline logs for a job.
 * @param {string} jobId - Job ID
 */
export function unsubscribeJobLogs(jobId) {
  if (!jobId) return;
  jobLogHandlers.delete(jobId);
  const s = getSocket();
  s.emit("unsubscribe_job", { job_id: jobId });
  if (!jobLogHandlers.size) {
    s.off("job_log", onJobLogPayload);
  }
}
