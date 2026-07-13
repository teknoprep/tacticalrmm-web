<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" maximized>
    <q-card class="column">
      <q-bar class="bg-primary text-white">
        <q-icon name="smart_toy" />
        <div>Pi AI Tasks — {{ scopeLabel }}</div>
        <q-space />
        <q-btn dense flat icon="refresh" @click="load" />
        <q-btn dense flat icon="close" v-close-popup />
      </q-bar>

      <!-- aggregate status summary -->
      <q-card-section class="row items-center q-gutter-sm">
        <q-chip square color="green" text-color="white" icon="check_circle">
          {{ counts.ok }} OK
        </q-chip>
        <q-chip square color="orange" text-color="white" icon="warning">
          {{ counts.warning }} Warning
        </q-chip>
        <q-chip square color="red" text-color="white" icon="error">
          {{ counts.alert }} Alert
        </q-chip>
        <q-chip square color="grey" text-color="white" icon="help">
          {{ counts.error }} Error
        </q-chip>
        <q-chip square color="blue-grey" text-color="white" icon="schedule">
          {{ counts.never }} Never run
        </q-chip>
        <q-space />
        <q-chip square outline icon="fact_check">{{ tasks.length }} tasks</q-chip>
        <q-chip square outline icon="dns">{{ hostCount }} devices</q-chip>
      </q-card-section>

      <q-separator />

      <q-card-section class="col q-pa-none scroll">
        <q-table
          :rows="tasks"
          :columns="columns"
          row-key="id"
          dense
          flat
          :pagination="{ rowsPerPage: 0, sortBy: 'last_status_rank' }"
          hide-bottom
          :filter="filter"
        >
          <template #top-left>
            <q-input
              v-model="filter"
              dense
              outlined
              debounce="200"
              placeholder="Filter by host or task"
            >
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </template>
          <template #body-cell-hostname="props">
            <q-td :props="props">
              <q-icon name="dns" size="xs" class="q-mr-xs" />{{ props.row.hostname }}
            </q-td>
          </template>
          <template #body-cell-by="props">
            <q-td :props="props">
              {{ props.row.modified_by || props.row.created_by || "—" }}
              <q-tooltip v-if="props.row.created_by || props.row.modified_by">
                Created by {{ props.row.created_by || "unknown" }}<span
                  v-if="props.row.modified_by && props.row.modified_by !== props.row.created_by"
                >
                  &middot; Last edited by {{ props.row.modified_by }}</span
                >
              </q-tooltip>
            </q-td>
          </template>
          <template #body-cell-schedule="props">
            <q-td :props="props">{{ scheduleText(props.row) }}</q-td>
          </template>
          <template #body-cell-enabled="props">
            <q-td :props="props">
              <q-icon
                :name="props.row.enabled ? 'check_circle' : 'pause_circle'"
                :color="props.row.enabled ? 'green' : 'grey'"
              />
            </q-td>
          </template>
          <template #body-cell-last_status="props">
            <q-td :props="props">
              <q-spinner
                v-if="props.row.last_status === 'running'"
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
              <q-btn dense flat size="sm" icon="history" @click="openHistory(props.row)">
                <q-tooltip>Run history</q-tooltip>
              </q-btn>
              <q-btn dense flat size="sm" icon="delete" color="red" @click="remove(props.row)">
                <q-tooltip>Delete task</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
        <div v-if="tasks.length === 0" class="q-pa-lg text-grey text-center">
          No AI tasks configured for any device in {{ scopeLabel }}.
        </div>
      </q-card-section>

      <!-- history / transcript dialog (master-detail) -->
      <q-dialog v-model="historyDialog">
        <q-card class="pi-hist-card">
          <q-bar class="bg-primary text-white">
            <q-icon name="history" />
            <div>{{ historyTask.hostname }} — {{ historyTask.name }}</div>
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
                  @click="selectedRun = r"
                >
                  <q-item-section side>
                    <q-spinner v-if="r.status === 'running'" color="primary" size="18px" />
                    <q-badge v-else :color="statusColor(r.status)" :label="r.status" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label lines="2">{{ r.summary || "(running…)" }}</q-item-label>
                    <q-item-label caption>{{ formatTime(r.started_at) }} · {{ r.triggered_by }}</q-item-label>
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
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import {
  fetchAITasksByScope,
  runAITaskNow,
  deleteAITask,
  fetchAITaskRuns,
} from "@/api/core";
import { runPiChat } from "@/api/agents";
import { notifySuccess, notifyError } from "@/utils/notify";

export default {
  name: "AITasksOverview",
  props: {
    scope: { type: Object, required: true }, // { client, site, label }
  },
  emits: [...useDialogPluginComponent.emits],
  setup(props) {
    const { dialogRef, onDialogHide } = useDialogPluginComponent();
    const tasks = ref([]);
    const filter = ref("");

    const scopeLabel = computed(() => props.scope.label || "All companies");

    const columns = [
      { name: "hostname", label: "Hostname", field: "hostname", align: "left", sortable: true },
      { name: "name", label: "Task", field: "name", align: "left", sortable: true },
      { name: "schedule", label: "Schedule", field: "schedule", align: "left" },
      { name: "model_display", label: "Model", field: "model_display", align: "left" },
      { name: "by", label: "By", field: (r) => r.modified_by || r.created_by || "", align: "left", sortable: true },
      { name: "last_run", label: "Last run", field: "last_run", align: "left", sortable: true },
      {
        name: "last_status",
        label: "Status",
        field: "last_status_rank",
        align: "left",
        sortable: true,
      },
      { name: "enabled", label: "On", field: "enabled", align: "center" },
      { name: "actions", label: "", field: "actions", align: "right" },
    ];

    function statusColor(s) {
      return { ok: "green", warning: "orange", alert: "red", error: "grey", running: "blue" }[s] || "grey";
    }
    function scheduleText(row) {
      return row.schedule_type === "daily"
        ? `Daily at ${row.run_time || "?"}`
        : `Every ${row.interval_minutes} min`;
    }
    function formatTime(ts) {
      if (!ts) return "";
      try {
        return new Date(ts).toLocaleString();
      } catch (e) {
        return ts;
      }
    }

    const counts = computed(() => {
      const c = { ok: 0, warning: 0, alert: 0, error: 0, never: 0 };
      for (const t of tasks.value) {
        if (!t.last_status) c.never++;
        else if (c[t.last_status] !== undefined) c[t.last_status]++;
      }
      return c;
    });
    const hostCount = computed(
      () => new Set(tasks.value.map((t) => t.hostname)).size,
    );

    // rank so worst status sorts to top
    const rank = { alert: 0, error: 1, warning: 2, running: 3, ok: 4 };
    async function load() {
      try {
        const data = await fetchAITasksByScope(props.scope);
        tasks.value = data.map((t) => ({
          ...t,
          last_status_rank: rank[t.last_status] ?? 9,
        }));
      } catch (e) {
        tasks.value = [];
      }
    }

    async function runNow(row) {
      try {
        await runAITaskNow(row.id);
        notifySuccess(`Started "${row.name}" on ${row.hostname}`);
        setTimeout(load, 1500);
      } catch (e) {
        notifyError("Failed to run");
      }
    }

    const $q = useQuasar();
    function remove(row) {
      $q.dialog({
        title: "Delete AI task",
        message: `Delete "${row.name}" on ${row.hostname}? This cannot be undone.`,
        cancel: true,
        ok: { label: "Delete", color: "negative" },
      }).onOk(async () => {
        try {
          await deleteAITask(row.id);
          notifySuccess("AI task deleted");
          load();
        } catch (e) {
          notifyError(
            e?.response?.status === 403
              ? "You don't have permission to delete this task"
              : "Failed to delete",
          );
        }
      });
    }

    // history
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
        if (runs.value.length) selectedRun.value = runs.value[0];
      } catch (e) {
        runs.value = [];
      }
    }
    function aiResolve(r) {
      if (!r || !r.device_id) return;
      runPiChat(r.device_id, { resolve_run: r.run_id });
    }

    onMounted(load);

    return {
      dialogRef,
      onDialogHide,
      tasks,
      filter,
      scopeLabel,
      columns,
      counts,
      hostCount,
      statusColor,
      scheduleText,
      formatTime,
      load,
      runNow,
      remove,
      historyDialog,
      historyTask,
      runs,
      selectedRun,
      openHistory,
      loadHistory,
      aiResolve,
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
</style>
