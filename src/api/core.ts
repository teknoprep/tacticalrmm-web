import axios from "axios";
import { openURL } from "quasar";
import { router } from "@/router";

import type {
  URLAction,
  TestRunURLActionRequest,
  TestRunURLActionResponse,
} from "@/types/core/urlactions";

import type { CoreSetting } from "@/types/core/settings";

const baseUrl = "/core";

export async function fetchCoreSettings(params = {}): Promise<CoreSetting> {
  const { data } = await axios.get("/core/settings/", { params: params });
  return data;
}

export async function fetchDashboardInfo(params = {}) {
  const { data } = await axios.get(`${baseUrl}/dashinfo/`, { params: params });
  return data;
}

export async function fetchCustomFields(params = {}) {
  try {
    const { data } = await axios.get(`${baseUrl}/customfields/`, {
      params: params,
    });
    return data;
  } catch (e) {
    console.error(e);
  }
}

export async function fetchURLActions(params = {}): Promise<URLAction[]> {
  const { data } = await axios.get(`${baseUrl}/urlaction/`, {
    params: params,
  });
  return data;
}

export async function saveURLAction(action: URLAction) {
  const { data } = await axios.post(`${baseUrl}/urlaction/`, action);
  return data;
}

export async function editURLAction(id: number, action: URLAction) {
  const { data } = await axios.put(`${baseUrl}/urlaction/${id}/`, action);
  return data;
}

export async function removeURLAction(id: number) {
  const { data } = await axios.delete(`${baseUrl}/urlaction/${id}/`);
  return data;
}

interface RunURLActionRequest {
  agent_id?: string;
  client?: number;
  site?: number;
  action: number;
}

export async function runURLAction(payload: RunURLActionRequest) {
  const { data } = await axios.patch(`${baseUrl}/urlaction/run/`, payload);
  openURL(data);
}

export async function runTestURLAction(
  payload: TestRunURLActionRequest,
): Promise<TestRunURLActionResponse> {
  const { data } = await axios.post(`${baseUrl}/urlaction/run/test/`, payload);
  return data;
}

export async function checkWebTermPerms(): Promise<{
  message: string;
  status: number;
}> {
  const ret = await axios.post(`${baseUrl}/webtermperms/`);
  return { message: ret.data, status: ret.status };
}

export function openWebTerminal(): void {
  const url: string = router.resolve("/webterm").href;
  openURL(url, undefined, {
    popup: true,
    scrollbars: false,
    location: false,
    status: false,
    toolbar: false,
    menubar: false,
    width: 1280,
    height: 720,
  });
}

// TODO: Build out type for openai payload
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateScript(payload: any) {
  const { data } = await axios.post(`${baseUrl}/openai/generate/`, payload);
  return data;
}

// Pi.dev AI providers & models
export async function fetchAIProviders() {
  const { data } = await axios.get(`${baseUrl}/ai/providers/`);
  return data;
}

export async function saveAIProvider(provider: Record<string, unknown>) {
  const { data } = await axios.post(`${baseUrl}/ai/providers/`, provider);
  return data;
}

export async function editAIProvider(id: number, provider: Record<string, unknown>) {
  const { data } = await axios.put(`${baseUrl}/ai/providers/${id}/`, provider);
  return data;
}

export async function deleteAIProvider(id: number) {
  const { data } = await axios.delete(`${baseUrl}/ai/providers/${id}/`);
  return data;
}

export async function fetchAIModels() {
  const { data } = await axios.get(`${baseUrl}/ai/models/`);
  return data;
}

export async function saveAIModel(model: Record<string, unknown>) {
  const { data } = await axios.post(`${baseUrl}/ai/models/`, model);
  return data;
}

export async function editAIModel(id: number, model: Record<string, unknown>) {
  const { data } = await axios.put(`${baseUrl}/ai/models/${id}/`, model);
  return data;
}

export async function deleteAIModel(id: number) {
  const { data } = await axios.delete(`${baseUrl}/ai/models/${id}/`);
  return data;
}

export async function fetchAvailableAIModels() {
  const { data } = await axios.get(`${baseUrl}/ai/available-models/`);
  return data;
}

export async function helpdeskAssist(messages: { role: string; content: string }[]) {
  const { data } = await axios.post(`${baseUrl}/ai/helpdesk-assist/`, { messages });
  return data as { reply: string };
}

export async function getScheduledActions() {
  const { data } = await axios.get(`${baseUrl}/ai/schedule-action/`);
  return data as {
    id: number; ticket_ref: string; agent: string | null; agent_id: string | null;
    action: string; run_at: string; status: string; allow_mutating: boolean;
    created_by: string; result: string;
  }[];
}

export async function deleteScheduledAction(id: number) {
  const { data } = await axios.delete(`${baseUrl}/ai/schedule-action/${id}/`);
  return data;
}

export async function getAIDecision(token: string) {
  const { data } = await axios.get(`${baseUrl}/ai/decision/${token}/`);
  return data as {
    ticket_ref: string;
    question: string;
    context: Record<string, string>;
    messages: { role: string; content: string; ts?: string }[];
    status: string;
  };
}

export async function replyAIDecision(
  token: string,
  message: string,
  opts?: { allow_device_changes?: boolean; allow_customer_reply?: boolean },
) {
  const { data } = await axios.post(`${baseUrl}/ai/decision/${token}/`, {
    message,
    allow_device_changes: opts?.allow_device_changes ?? false,
    allow_customer_reply: opts?.allow_customer_reply ?? false,
  });
  return data as { reply: string; messages: { role: string; content: string }[]; status: string };
}

export async function createDecisionSession(token: string, payload: object = {}) {
  // Mint a stateful, streaming decision-chat session (same machinery as the device chat).
  const { data } = await axios.post(`${baseUrl}/ai/decision/${token}/session/`, payload);
  return data;
}

export async function getAIDecisionStatus(token: string) {
  const { data } = await axios.get(`${baseUrl}/ai/decision/${token}/status/`);
  return data as {
    status: string;
    events: { type: string; label?: string; tool?: string; isError?: boolean }[];
  };
}

export async function closeAIDecision(token: string) {
  const { data } = await axios.post(`${baseUrl}/ai/decision/${token}/`, { action: "close" });
  return data as { status: string };
}

export async function getDeviceNotes(agentId: string) {
  const { data } = await axios.get(`${baseUrl}/ai/device-note/`, {
    params: { agent_id: agentId },
  });
  return data as { agent_id: string; notes: string };
}

export async function saveDeviceNotes(agentId: string, notes: string) {
  const { data } = await axios.put(`${baseUrl}/ai/device-note/`, {
    agent_id: agentId,
    notes,
  });
  return data as { ok: boolean; notes: string };
}

export async function aiPromptAssist(payload: {
  messages: { role: string; content: string }[];
  kind: "single" | "bulk";
  current_prompt?: string;
  current_report?: string;
}) {
  const { data } = await axios.post(`${baseUrl}/ai/prompt-assist/`, payload);
  return data as { reply: string };
}

// Scheduled Pi AI Tasks
export async function fetchAITasks(agentId?: string) {
  const { data } = await axios.get(`${baseUrl}/ai/tasks/`, {
    params: agentId ? { agent_id: agentId } : {},
  });
  return data;
}

// Aggregate: all tasks for a client or site (company-wide view)
export async function fetchAITasksByScope(scope: {
  client?: string | null;
  site?: string | null;
}) {
  const params: Record<string, string> = {};
  if (scope.site) params.site = scope.site;
  else if (scope.client) params.client = scope.client;
  const { data } = await axios.get(`${baseUrl}/ai/tasks/`, { params });
  return data;
}

export async function saveAITask(task: Record<string, unknown>) {
  const { data } = await axios.post(`${baseUrl}/ai/tasks/`, task);
  return data;
}

export async function editAITask(id: number, task: Record<string, unknown>) {
  const { data } = await axios.put(`${baseUrl}/ai/tasks/${id}/`, task);
  return data;
}

export async function deleteAITask(id: number) {
  const { data } = await axios.delete(`${baseUrl}/ai/tasks/${id}/`);
  return data;
}

export async function runAITaskNow(id: number) {
  const { data } = await axios.post(`${baseUrl}/ai/tasks/${id}/run/`);
  return data;
}

export async function fetchAITaskRuns(taskId: number) {
  const { data } = await axios.get(`${baseUrl}/ai/runs/`, {
    params: { task_id: taskId },
  });
  return data;
}

export async function fetchAITaskRunLive(runId: string) {
  const { data } = await axios.get(`${baseUrl}/ai/runs/${runId}/live/`);
  return data;
}

export async function fetchAIRunsByAgent(agentId: string) {
  const { data } = await axios.get(`${baseUrl}/ai/runs/`, {
    params: { agent_id: agentId },
  });
  return data;
}

// Scope = { client: <id> } or { site: <id> }
export async function fetchAIRunsByScope(scope: { client?: number; site?: number }) {
  const { data } = await axios.get(`${baseUrl}/ai/runs/`, { params: scope });
  return data;
}

export async function fetchAIHistoryScope(scope: { client?: number; site?: number }) {
  const { data } = await axios.get(`${baseUrl}/ai/history-scope/`, { params: scope });
  return data;
}

// Bulk AI Commands
export async function fetchBulkAICommands() {
  const { data } = await axios.get(`${baseUrl}/ai/bulk/`);
  return data;
}
export async function saveBulkAICommand(cmd: Record<string, unknown>) {
  const { data } = await axios.post(`${baseUrl}/ai/bulk/`, cmd);
  return data;
}
export async function editBulkAICommand(id: number, cmd: Record<string, unknown>) {
  const { data } = await axios.put(`${baseUrl}/ai/bulk/${id}/`, cmd);
  return data;
}
export async function deleteBulkAICommand(id: number) {
  const { data } = await axios.delete(`${baseUrl}/ai/bulk/${id}/`);
  return data;
}
export async function stopBulkAICommand(id: number) {
  const { data } = await axios.post(`${baseUrl}/ai/bulk/${id}/stop/`);
  return data;
}

export async function stopAllAIRuns() {
  const { data } = await axios.post(`${baseUrl}/ai/stop-all/`);
  return data;
}

export async function fetchBulkAICommandResults(id: number) {
  const { data } = await axios.get(`${baseUrl}/ai/bulk/${id}/results/`);
  return data;
}

export async function runBulkAICommandNow(id: number) {
  const { data } = await axios.post(`${baseUrl}/ai/bulk/${id}/run/`);
  return data;
}
export async function previewBulkAITargets(payload: Record<string, unknown>) {
  const { data } = await axios.post(`${baseUrl}/ai/bulk/preview/`, payload);
  return data;
}
