<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @hide="$emit('update:modelValue', false)"
  >
    <q-card style="min-width: 1000px; max-width: 95vw">
      <q-card-section class="row items-center">
        <q-icon name="smart_toy" size="sm" class="q-mr-sm" />
        <div class="text-subtitle1">AI History — {{ label }}</div>
        <q-space />
        <q-btn dense flat icon="refresh" :loading="loading" @click="load" />
        <q-btn dense flat icon="close" v-close-popup />
      </q-card-section>
      <q-separator />
      <q-card-section class="q-pa-none">
        <q-table
          :rows="rows"
          :columns="columns"
          row-key="key"
          dense
          flat
          :loading="loading"
          :pagination="{ rowsPerPage: 0, sortBy: 'when', descending: true }"
          hide-bottom
          :filter="filter"
          style="max-height: 65vh"
          virtual-scroll
        >
          <template #top-left>
            <q-input v-model="filter" dense outlined debounce="200" placeholder="Filter">
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </template>
          <template #top-right>
            <div class="text-caption text-grey">
              {{ rows.length }} entries across {{ machineCount }} machines
            </div>
          </template>
          <template #body-cell-machine="props">
            <q-td :props="props">
              <q-icon name="dns" size="xs" class="q-mr-xs" />{{ props.row.machine || "—" }}
            </q-td>
          </template>
          <template #body-cell-source="props">
            <q-td :props="props">
              <q-badge :color="sourceColor(props.row.source)" :label="props.row.sourceLabel" />
            </q-td>
          </template>
          <template #body-cell-summary="props">
            <q-td :props="props" style="max-width: 420px; white-space: normal">
              {{ props.row.summary }}
            </q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge
                v-if="props.row.status"
                :color="statusColor(props.row.status)"
                :label="props.row.status"
              />
              <span v-else>—</span>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                v-if="props.row.output"
                dense
                flat
                size="sm"
                icon="visibility"
                @click="viewRun(props.row)"
              >
                <q-tooltip>View output</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <!-- run output viewer -->
    <q-dialog v-model="runDialog">
      <q-card style="min-width: 720px; max-width: 90vw">
        <q-card-section class="row items-center">
          <div class="text-subtitle2">
            {{ runRow.machine }} — {{ runRow.sourceLabel }}
          </div>
          <q-space />
          <q-btn dense flat icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-caption text-grey q-mb-xs">{{ runRow.summary }}</div>
          <pre class="ai-run-output">{{ runRow.output || "(no output)" }}</pre>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-dialog>
</template>

<script>
import { ref, computed, watch } from "vue";
import { fetchAIRunsByScope, fetchAIHistoryScope } from "@/api/core";
import { notifyError } from "@/utils/notify";

export default {
  name: "AIHistoryScope",
  props: {
    modelValue: { type: Boolean, default: false },
    // exactly one of client / site (numeric id)
    client: { type: Number, default: null },
    site: { type: Number, default: null },
    label: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  setup(props) {
    const rows = ref([]);
    const loading = ref(false);
    const filter = ref("");
    const runDialog = ref(false);
    const runRow = ref({});

    const columns = [
      { name: "machine", label: "Machine", field: "machine", align: "left", sortable: true },
      { name: "source", label: "Source", field: "sourceLabel", align: "left", sortable: true },
      { name: "summary", label: "Summary", field: "summary", align: "left" },
      { name: "user", label: "By", field: "user", align: "left", sortable: true },
      { name: "when", label: "When", field: "when", align: "left", sortable: true },
      { name: "status", label: "Status", field: "status", align: "left", sortable: true },
      { name: "actions", label: "", field: "actions", align: "right" },
    ];

    const machineCount = computed(
      () => new Set(rows.value.map((r) => r.machine).filter(Boolean)).size,
    );

    function sourceColor(s) {
      return { chat: "primary", task: "teal", bulk: "deep-purple" }[s] || "grey";
    }
    function statusColor(s) {
      return (
        { ok: "green", warning: "orange", alert: "red", error: "grey", running: "blue" }[s] ||
        "grey"
      );
    }
    function fmt(ts) {
      try {
        return ts ? new Date(ts).toLocaleString() : "";
      } catch (e) {
        return ts;
      }
    }
    function scope() {
      return props.client ? { client: props.client } : { site: props.site };
    }

    async function load() {
      if (!props.client && !props.site) return;
      loading.value = true;
      const merged = [];
      try {
        const data = await fetchAIHistoryScope(scope());
        (data.sessions || []).forEach((s) => {
          merged.push({
            key: "chat:" + s.session_id,
            machine: s.hostname || s.agent_id || "",
            source: "chat",
            sourceLabel: s.multi ? "Chat (multi)" : "Chat",
            summary: s.last_message || s.name || "Chat",
            user: s.user || "",
            when: s.last_activity || s.started,
            _when: fmt(s.last_activity || s.started),
            status: "",
          });
        });
      } catch (e) {
        /* noop */
      }
      try {
        const runs = await fetchAIRunsByScope(scope());
        runs.forEach((r) => {
          merged.push({
            key: "run:" + r.id,
            machine: r.hostname || "",
            source: r.source,
            sourceLabel: r.source === "bulk" ? `Bulk: ${r.source_name}` : `Task: ${r.source_name}`,
            summary: r.summary || "(running…)",
            user: r.triggered_by || "",
            when: r.started_at,
            _when: fmt(r.started_at),
            status: r.status,
            output: r.output,
          });
        });
      } catch (e) {
        notifyError("Failed to load AI history");
      }
      merged.sort((a, b) => (b.when || "").localeCompare(a.when || ""));
      // display formatted time
      merged.forEach((m) => (m.when = m._when || m.when));
      rows.value = merged;
      loading.value = false;
    }

    function viewRun(row) {
      runRow.value = row;
      runDialog.value = true;
    }

    watch(
      () => props.modelValue,
      (v) => {
        if (v) load();
      },
    );

    return {
      rows,
      loading,
      filter,
      columns,
      machineCount,
      sourceColor,
      statusColor,
      runDialog,
      runRow,
      viewRun,
      load,
    };
  },
};
</script>

<style scoped>
.ai-run-output {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 60vh;
  overflow: auto;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.04);
  padding: 8px;
  border-radius: 4px;
}
</style>
