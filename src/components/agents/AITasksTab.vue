<template>
  <div>
    <div v-if="mode === 'none'" class="q-pa-sm text-grey">
      Select an agent, site, or client to view AI tasks.
    </div>
    <div v-else>
      <div class="row items-center q-pa-sm">
        <div class="text-subtitle2">{{ headerText }}</div>
        <q-space />
        <!-- aggregate status chips (scope mode) -->
        <template v-if="mode === 'scope'">
          <q-chip dense square color="green" text-color="white">{{ counts.ok }} OK</q-chip>
          <q-chip dense square color="orange" text-color="white">{{ counts.warning }} Warn</q-chip>
          <q-chip dense square color="red" text-color="white">{{ counts.alert }} Alert</q-chip>
          <q-chip dense square color="grey" text-color="white">{{ counts.error }} Err</q-chip>
          <q-chip dense square color="blue-grey" text-color="white">{{ counts.never }} New</q-chip>
          <q-separator vertical spaced />
        </template>
        <q-btn
          v-if="mode === 'agent'"
          dense
          flat
          icon="add"
          label="New task"
          no-caps
          color="primary"
          @click="addTask"
        />
        <q-btn dense flat icon="refresh" @click="load" />
      </div>
      <q-separator />
      <q-input
        v-if="mode === 'scope'"
        v-model="filter"
        dense
        outlined
        debounce="200"
        placeholder="Filter by host or task"
        class="q-ma-sm"
        style="max-width: 360px"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-table
        :rows="tasks"
        :columns="columns"
        row-key="id"
        dense
        flat
        :pagination="{ rowsPerPage: 0, sortBy: mode === 'scope' ? 'last_status_rank' : 'name' }"
        hide-bottom
        :filter="filter"
        :style="{ height: tableHeight }"
        virtual-scroll
      >
        <template #body-cell-hostname="props">
          <q-td :props="props">
            <q-icon name="dns" size="xs" class="q-mr-xs" />{{ props.row.hostname }}
          </q-td>
        </template>
        <template #body-cell-enabled="props">
          <q-td :props="props">
            <q-icon
              :name="props.row.enabled ? 'check_circle' : 'pause_circle'"
              :color="props.row.enabled ? 'green' : 'grey'"
            />
          </q-td>
        </template>
        <template #body-cell-schedule="props">
          <q-td :props="props">{{ scheduleText(props.row) }}</q-td>
        </template>
        <template #body-cell-last_status="props">
          <q-td :props="props">
            <q-spinner
              v-if="runningTasks[props.row.id]"
              color="primary"
              size="16px"
              class="q-mr-xs"
            />
            <q-badge
              v-if="props.row.last_status"
              :color="statusColor(props.row.last_status)"
              :label="props.row.last_status"
            />
            <span v-else class="text-grey">never run</span>
            <q-tooltip v-if="props.row.last_summary">{{
              props.row.last_summary
            }}</q-tooltip>
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              dense
              flat
              size="sm"
              icon="play_arrow"
              color="primary"
              @click="runNow(props.row)"
            >
              <q-tooltip>Run now</q-tooltip>
            </q-btn>
            <q-btn
              v-if="runningTasks[props.row.id]"
              dense
              flat
              size="sm"
              icon="sensors"
              color="red"
              class="pi-live-pulse"
              @click="openLive(runningTasks[props.row.id])"
            >
              <q-tooltip>Live — trace what it's doing now</q-tooltip>
            </q-btn>
            <q-btn dense flat size="sm" icon="history" @click="openHistory(props.row)">
              <q-tooltip>View run history</q-tooltip>
            </q-btn>
            <q-btn
              v-if="mode === 'agent'"
              dense
              flat
              size="sm"
              icon="edit"
              @click="editTask(props.row)"
            />
            <q-btn
              v-if="mode === 'agent'"
              dense
              flat
              size="sm"
              icon="delete"
              color="red"
              @click="remove(props.row)"
            />
          </q-td>
        </template>
      </q-table>
      <div v-if="tasks.length === 0" class="q-pa-md text-grey">
        <template v-if="mode === 'agent'">
          No scheduled AI tasks yet. Create one to have Pi periodically check this
          device and raise an alert if it finds a problem.
        </template>
        <template v-else>
          No AI tasks configured for any device in this {{ scope.kind }}.
        </template>
      </div>
    </div>

    <!-- edit dialog -->
    <q-dialog v-model="dialog">
      <q-card style="min-width: 560px">
        <q-card-section class="text-subtitle1">
          {{ form.id ? "Edit" : "New" }} AI Task
        </q-card-section>
        <q-card-section class="q-gutter-sm scroll" style="max-height: 70vh">
          <q-input v-model="form.name" outlined dense label="Task name" />
          <q-input
            v-model="form.prompt"
            outlined
            dense
            type="textarea"
            autogrow
            label="Prompt / instructions"
            hint="e.g. Check SQL Server performance. Alert on high wait times or latency over 1s, warn over 500ms."
          />
          <q-select
            v-model="form.model"
            :options="modelOptions"
            emit-value
            map-options
            outlined
            dense
            clearable
            label="Model (blank = global default)"
          />
          <!-- when to run -->
          <q-option-group
            v-model="form.run_mode"
            :options="[
              { label: 'Now (one-shot)', value: 'now' },
              { label: 'Scheduled', value: 'schedule' },
            ]"
            inline
            dense
          />
          <div v-if="form.run_mode === 'now'" class="text-caption text-grey">
            One-shot: runs when you click Run now, then disables itself (kept
            here with its results).
          </div>

          <template v-if="form.run_mode === 'schedule'">
            <div class="row q-col-gutter-sm">
              <q-select
                v-model="form.schedule_type"
                :options="[
                  { label: 'Every N minutes', value: 'interval' },
                  { label: 'Daily', value: 'daily' },
                  { label: 'Weekly', value: 'weekly' },
                  { label: 'Monthly', value: 'monthly' },
                ]"
                emit-value
                map-options
                outlined
                dense
                label="Schedule"
                class="col"
              />
              <q-input
                v-if="form.schedule_type === 'interval'"
                v-model.number="form.interval_minutes"
                type="number"
                outlined
                dense
                label="Interval (minutes)"
                class="col"
              />
              <q-input
                v-else
                v-model="form.run_time"
                type="time"
                outlined
                dense
                label="At time (server time)"
                class="col"
              />
            </div>
            <div v-if="form.schedule_type === 'weekly'">
              <div class="text-caption q-mb-xs">Days of week</div>
              <div class="row q-gutter-sm">
                <q-checkbox
                  v-for="d in weekDays"
                  :key="d.value"
                  v-model="form.weekly_days"
                  :val="d.value"
                  :label="d.label"
                  dense
                />
              </div>
            </div>
            <q-input
              v-if="form.schedule_type === 'monthly'"
              v-model.number="form.monthly_day"
              type="number"
              min="1"
              max="31"
              outlined
              dense
              label="Day of month (1-31)"
            />
          </template>
          <q-select
            v-model="form.alert_threshold"
            :options="[
              { label: 'Never raise an alert', value: 'never' },
              { label: 'Alert on Warning or Alert', value: 'warning' },
              { label: 'Alert only on Alert', value: 'alert' },
            ]"
            emit-value
            map-options
            outlined
            dense
            label="Raise TRMM alert when"
          />
          <q-checkbox
            v-model="form.allow_mutating"
            label="Allow this task to make changes (run scripts, kill processes, reboot)"
          />
          <div class="text-caption text-grey">
            Off = read-only diagnostics (recommended). It can still run shell
            commands you describe in the prompt, but destructive actions are
            blocked.
          </div>
          <q-checkbox v-model="form.enabled" label="Enabled" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" @click="saveForm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- history dialog (master-detail) -->
    <q-dialog v-model="historyDialog">
      <q-card class="pi-hist-card">
        <q-bar class="bg-primary text-white">
          <q-icon name="history" />
          <div>Run history — {{ historyTask.hostname ? historyTask.hostname + " · " : "" }}{{ historyTask.name }}</div>
          <q-space />
          <q-btn dense flat icon="refresh" @click="loadHistory" />
          <q-btn dense flat icon="close" v-close-popup />
        </q-bar>
        <div class="pi-hist-body">
          <div class="pi-hist-list">
            <q-list separator>
              <q-item
                v-for="r in runs"
                :key="r.id"
                clickable
                :active="selectedRun && selectedRun.id === r.id"
                active-class="bg-blue-1 text-black"
                @click="selectRun(r)"
              >
                <q-item-section side>
                  <q-spinner v-if="r.status === 'running'" color="primary" size="18px" />
                  <q-badge v-else :color="statusColor(r.status)" :label="r.status" />
                </q-item-section>
                <q-item-section>
                  <q-item-label lines="2">{{ r.summary || "(running…)" }}</q-item-label>
                  <q-item-label caption>
                    {{ formatTime(r.started_at) }} · {{ r.triggered_by }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side v-if="r.status === 'running'">
                  <q-btn
                    dense
                    flat
                    size="sm"
                    icon="sensors"
                    color="red"
                    @click.stop="openLive(r.run_id)"
                  >
                    <q-tooltip>Watch live</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
            <div v-if="runs.length === 0" class="q-pa-md text-grey">No runs yet.</div>
          </div>
          <div class="col pi-hist-detail">
            <div v-if="selectedRun">
              <div class="row items-center q-gutter-sm q-mb-sm">
                <q-badge :color="statusColor(selectedRun.status)" :label="selectedRun.status" />
                <div class="text-caption text-grey">
                  {{ formatTime(selectedRun.started_at) }} · {{ selectedRun.triggered_by }}
                </div>
                <q-space />
                <q-btn
                  dense
                  flat
                  no-caps
                  color="deep-orange"
                  icon="auto_fix_high"
                  label="AI Resolve"
                  @click="aiResolve(selectedRun)"
                >
                  <q-tooltip>
                    Open a read-only Pi chat on this device that proposes fix
                    options for this finding
                  </q-tooltip>
                </q-btn>
              </div>
              <div class="text-weight-medium q-mb-sm">{{ selectedRun.summary }}</div>
              <q-separator class="q-mb-sm" />
              <pre class="pi-transcript">{{ selectedRun.output || "(no transcript)" }}</pre>
            </div>
            <div v-else class="text-grey q-pa-md">
              Select a run on the left to see everything it did.
            </div>
          </div>
        </div>
      </q-card>
    </q-dialog>

    <!-- live dialog -->
    <q-dialog v-model="liveDialog" @hide="stopLivePoll">
      <q-card style="min-width: 720px; max-width: 90vw">
        <q-card-section class="row items-center">
          <q-spinner v-if="liveState.status === 'running'" color="primary" class="q-mr-sm" />
          <q-icon
            v-else
            :name="liveState.status === 'ok' ? 'check_circle' : 'warning'"
            :color="statusColor(liveState.status)"
            class="q-mr-sm"
          />
          <div class="text-subtitle1">Live trace — {{ liveState.status || "running" }}</div>
          <q-space />
          <q-badge color="red" label="LIVE" v-if="liveState.status === 'running'" />
        </q-card-section>
        <q-card-section class="pi-live" style="max-height: 55vh; overflow: auto">
          <div v-for="(ev, i) in liveState.events" :key="i" class="pi-live-ev q-mb-xs">
            <template v-if="ev.type === 'tool_start'">
              <q-icon name="play_circle" color="blue" size="xs" />
              <span class="text-weight-medium"> {{ ev.tool }}</span>
              <pre class="pi-args">{{ ev.args }}</pre>
            </template>
            <template v-else-if="ev.type === 'tool_end'">
              <q-icon
                :name="ev.isError ? 'error' : 'check_circle'"
                :color="ev.isError ? 'red' : 'green'"
                size="xs"
              />
              <span> {{ ev.tool }} result</span>
              <pre class="pi-args">{{ ev.result }}</pre>
            </template>
            <template v-else-if="ev.type === 'text'">
              <q-icon name="chat" color="grey" size="xs" />
              <span class="pi-say"> {{ ev.text }}</span>
            </template>
            <template v-else-if="ev.type === 'done'">
              <q-icon name="flag" color="green" size="xs" />
              <span class="text-weight-medium"> Verdict: {{ ev.text }}</span>
            </template>
            <template v-else>
              <q-icon name="info" color="grey" size="xs" />
              <span> {{ ev.text }}</span>
            </template>
          </div>
          <div v-if="liveState.events.length === 0" class="text-grey">
            Waiting for the task to start…
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import {
  fetchAITasks,
  fetchAITasksByScope,
  saveAITask,
  editAITask,
  deleteAITask,
  runAITaskNow,
  fetchAIModels,
  fetchAITaskRuns,
  fetchAITaskRunLive,
} from "@/api/core";
import { runPiChat } from "@/api/agents";
import { notifySuccess, notifyError } from "@/utils/notify";

export default {
  name: "AITasksTab",
  setup() {
    const store = useStore();
    const selectedAgent = computed(() => store.state.selectedRow);
    const selectedTree = computed(() => store.state.selectedTree);
    const tabHeight = computed(() => store.state.tabHeight);
    const tasks = ref([]);
    const modelOptions = ref([]);
    const runningTasks = ref({});
    const filter = ref("");

    // scope derived from the tree selection (Client|id / Site|id)
    const scope = computed(() => {
      const t = selectedTree.value || "";
      if (t.includes("Client"))
        return { client: t.split("|")[1], site: null, kind: "client" };
      if (t.includes("Site"))
        return { client: null, site: t.split("|")[1], kind: "site" };
      return { client: null, site: null, kind: null };
    });

    const mode = computed(() => {
      if (selectedAgent.value) return "agent";
      if (scope.value.kind) return "scope";
      return "none";
    });

    const headerText = computed(() =>
      mode.value === "scope"
        ? `Scheduled Pi AI Tasks — all devices in this ${scope.value.kind}`
        : "Scheduled Pi AI Tasks",
    );

    const tableHeight = computed(() => {
      const base = parseInt(tabHeight.value) || 300;
      return `${mode.value === "scope" ? base - 60 : base}px`;
    });

    const columns = computed(() => {
      const cols = [];
      if (mode.value === "scope")
        cols.push({ name: "hostname", label: "Hostname", field: "hostname", align: "left", sortable: true });
      cols.push(
        { name: "name", label: "Task", field: "name", align: "left", sortable: true },
        { name: "schedule", label: "Schedule", field: "schedule", align: "left" },
        { name: "model_display", label: "Model", field: "model_display", align: "left" },
        { name: "alert_threshold", label: "Alert", field: "alert_threshold", align: "left" },
        { name: "last_run", label: "Last run", field: "last_run", align: "left", sortable: true },
        { name: "last_status", label: "Status", field: "last_status_rank", align: "left", sortable: true },
        { name: "enabled", label: "On", field: "enabled", align: "center" },
        { name: "actions", label: "", field: "actions", align: "right" },
      );
      return cols;
    });

    const rank = { alert: 0, error: 1, warning: 2, running: 3, ok: 4 };
    const counts = computed(() => {
      const c = { ok: 0, warning: 0, alert: 0, error: 0, never: 0 };
      for (const t of tasks.value) {
        if (!t.last_status) c.never++;
        else if (c[t.last_status] !== undefined) c[t.last_status]++;
      }
      return c;
    });

    const weekDays = [
      { label: "Mon", value: 0 },
      { label: "Tue", value: 1 },
      { label: "Wed", value: 2 },
      { label: "Thu", value: 3 },
      { label: "Fri", value: 4 },
      { label: "Sat", value: 5 },
      { label: "Sun", value: 6 },
    ];
    function scheduleText(row) {
      if (row.run_mode === "now") return "Now (one-shot)";
      if (row.schedule_type === "once") return `Once at ${row.run_time || "?"}`;
      if (row.schedule_type === "daily") return `Daily at ${row.run_time || "?"}`;
      if (row.schedule_type === "weekly")
        return `Weekly ${(row.weekly_days || []).map((d) => weekDays[d].label).join(",")} at ${row.run_time || "?"}`;
      if (row.schedule_type === "monthly")
        return `Monthly day ${row.monthly_day} at ${row.run_time || "?"}`;
      return `Every ${row.interval_minutes} min`;
    }
    function statusColor(s) {
      return { ok: "green", warning: "orange", alert: "red", error: "grey", running: "blue" }[s] || "grey";
    }
    function formatTime(ts) {
      if (!ts) return "";
      try {
        return new Date(ts).toLocaleString();
      } catch (e) {
        return ts;
      }
    }

    async function load() {
      try {
        let data = [];
        if (mode.value === "agent") data = await fetchAITasks(selectedAgent.value);
        else if (mode.value === "scope") data = await fetchAITasksByScope(scope.value);
        tasks.value = data.map((t) => ({
          ...t,
          last_status_rank: rank[t.last_status] ?? 9,
        }));
      } catch (e) {
        tasks.value = [];
      }
    }
    async function loadModels() {
      try {
        const m = await fetchAIModels();
        modelOptions.value = m
          .filter((x) => x.enabled)
          .map((x) => ({ label: x.display_name, value: x.id }));
      } catch (e) {
        modelOptions.value = [];
      }
    }

    // ---- edit (agent mode only) ----
    const dialog = ref(false);
    const form = ref({});
    function addTask() {
      form.value = {
        name: "",
        prompt: "",
        model: null,
        run_mode: "schedule",
        schedule_type: "daily",
        interval_minutes: 60,
        run_time: "03:00",
        weekly_days: [],
        monthly_day: 1,
        alert_threshold: "alert",
        allow_mutating: false,
        enabled: true,
      };
      dialog.value = true;
    }
    function editTask(row) {
      const f = {
        run_mode: "schedule",
        weekly_days: [],
        monthly_day: 1,
        run_time: "03:00",
        ...row,
      };
      // legacy one-time tasks map onto the Now run mode
      if (f.schedule_type === "once") {
        f.run_mode = "now";
        f.schedule_type = "daily";
      }
      if (!Array.isArray(f.weekly_days)) f.weekly_days = [];
      form.value = f;
      dialog.value = true;
    }
    async function saveForm() {
      try {
        const f = { ...form.value, agent_id: selectedAgent.value };
        if (f.id) await editAITask(f.id, f);
        else await saveAITask(f);
        notifySuccess("Task saved");
        dialog.value = false;
        await load();
      } catch (e) {
        notifyError(e?.response?.data || "Failed to save task");
      }
    }
    async function remove(row) {
      try {
        await deleteAITask(row.id);
        await load();
      } catch (e) {
        notifyError("Failed to delete");
      }
    }

    // ---- run now -> live ----
    async function runNow(row) {
      try {
        await runAITaskNow(row.id);
        notifySuccess("Task started");
        setTimeout(() => findAndTrack(row.id, true), 800);
      } catch (e) {
        notifyError("Failed to run");
      }
    }
    async function findAndTrack(taskId, openLiveView) {
      try {
        const runs = await fetchAITaskRuns(taskId);
        const running = runs.find((r) => r.status === "running") || runs[0];
        if (running && running.status === "running") {
          runningTasks.value = { ...runningTasks.value, [taskId]: running.run_id };
          if (openLiveView) openLive(running.run_id);
        }
      } catch (e) {
        /* noop */
      }
    }

    // ---- history ----
    const historyDialog = ref(false);
    const historyTask = ref({});
    const runs = ref([]);
    const selectedRun = ref(null);
    function openHistory(row) {
      historyTask.value = row;
      selectedRun.value = null;
      historyDialog.value = true;
      loadHistory();
    }
    async function loadHistory() {
      try {
        runs.value = await fetchAITaskRuns(historyTask.value.id);
        if (!selectedRun.value && runs.value.length) selectRun(runs.value[0]);
      } catch (e) {
        runs.value = [];
      }
    }
    function selectRun(r) {
      selectedRun.value = r;
    }
    function aiResolve(r) {
      if (!r || !r.device_id) return;
      runPiChat(r.device_id, { resolve_run: r.run_id });
    }

    // ---- live ----
    const liveDialog = ref(false);
    const liveState = ref({ status: "running", events: [] });
    let livePoll = null;
    let liveRunId = null;
    function openLive(runId) {
      liveRunId = runId;
      liveState.value = { status: "running", events: [] };
      liveDialog.value = true;
      pollLive();
      livePoll = setInterval(pollLive, 1500);
    }
    async function pollLive() {
      if (!liveRunId) return;
      try {
        const data = await fetchAITaskRunLive(liveRunId);
        if (data.live) liveState.value = data.live;
        else if (data.run)
          liveState.value = {
            status: data.run.status,
            events: [{ type: "done", text: data.run.summary }],
            summary: data.run.summary,
          };
        if (liveState.value.status && liveState.value.status !== "running") {
          stopLivePoll();
          load();
          const t = { ...runningTasks.value };
          for (const k of Object.keys(t)) if (t[k] === liveRunId) delete t[k];
          runningTasks.value = t;
        }
      } catch (e) {
        /* keep polling */
      }
    }
    function stopLivePoll() {
      if (livePoll) {
        clearInterval(livePoll);
        livePoll = null;
      }
    }

    async function detectRunning() {
      for (const t of tasks.value) {
        if (t.last_status === "running") findAndTrack(t.id, false);
      }
    }

    watch([selectedAgent, selectedTree], () => load());
    watch(tasks, () => detectRunning());
    onMounted(() => {
      loadModels();
      load();
    });
    onBeforeUnmount(stopLivePoll);

    return {
      mode,
      scope,
      headerText,
      tableHeight,
      tabHeight,
      tasks,
      modelOptions,
      runningTasks,
      filter,
      columns,
      counts,
      weekDays,
      scheduleText,
      statusColor,
      formatTime,
      load,
      dialog,
      form,
      addTask,
      editTask,
      saveForm,
      remove,
      runNow,
      historyDialog,
      historyTask,
      runs,
      selectedRun,
      openHistory,
      loadHistory,
      aiResolve,
      selectRun,
      liveDialog,
      liveState,
      openLive,
      stopLivePoll,
    };
  },
};
</script>

<style scoped>
.pi-hist-card {
  display: flex;
  flex-direction: column;
  width: 70vw;
  height: 80vh;
  max-width: 95vw;
  max-height: 92vh;
  min-width: 600px;
  min-height: 400px;
  resize: both;
  overflow: hidden;
}
.pi-hist-card > .q-bar {
  width: 100%;
}
.pi-hist-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.pi-hist-list {
  width: 340px;
  min-width: 300px;
  height: 100%;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pi-hist-detail {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px;
  min-height: 0;
}
.pi-transcript {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: 11px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
}
.pi-args {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: 11px;
  margin: 2px 0 0 18px;
  color: #607d8b;
}
.pi-say {
  white-space: pre-wrap;
}
.pi-live-ev {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding-bottom: 4px;
}
.pi-live-pulse {
  animation: pi-pulse 1.2s infinite;
}
@keyframes pi-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.35; }
  100% { opacity: 1; }
}
</style>
