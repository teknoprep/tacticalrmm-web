<template>
  <div>
    <div v-if="!selectedAgent" class="q-pa-sm">No agent selected</div>
    <div v-else>
      <div class="row items-center q-pa-sm">
        <div class="text-subtitle2">AI History</div>
        <q-space />
        <q-btn
          dense
          flat
          icon="add"
          label="New chat"
          no-caps
          color="primary"
          @click="newChat"
        />
        <q-btn dense flat icon="refresh" @click="load" />
      </div>
      <q-separator />
      <q-table
        :rows="rows"
        :columns="columns"
        row-key="key"
        dense
        flat
        :pagination="{ rowsPerPage: 0, sortBy: 'when', descending: true }"
        hide-bottom
        :style="{ height: tabHeight + 'px' }"
        virtual-scroll
      >
        <template #body-cell-source="props">
          <q-td :props="props">
            <q-badge :color="sourceColor(props.row.source)" :label="props.row.sourceLabel" />
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
              v-if="props.row.source === 'chat'"
              dense
              flat
              size="sm"
              icon="chat"
              color="primary"
              label="Continue"
              no-caps
              @click="continueChat(props.row.id)"
            />
            <q-btn
              v-else
              dense
              flat
              size="sm"
              icon="visibility"
              label="View"
              no-caps
              @click="viewRun(props.row)"
            />
            <q-btn
              v-if="props.row.source === 'chat'"
              dense
              flat
              size="sm"
              icon="delete"
              color="red"
              @click="removeChat(props.row.id)"
            />
          </q-td>
        </template>
      </q-table>
      <div v-if="rows.length === 0" class="q-pa-md text-grey">
        No AI activity yet for this device. Start a chat (Pi.dev), or it will
        appear here when a scheduled task or Bulk AI Command runs.
      </div>
    </div>

    <!-- run transcript dialog -->
    <q-dialog v-model="runDialog">
      <q-card style="width: 900px; max-width: 95vw">
        <q-bar class="bg-primary text-white">
          <q-icon name="smart_toy" />
          <div>{{ runRow.sourceLabel }}</div>
          <q-space />
          <q-badge v-if="runRow.status" :color="statusColor(runRow.status)" :label="runRow.status" />
          <q-btn dense flat icon="close" v-close-popup class="q-ml-sm" />
        </q-bar>
        <q-card-section>
          <div class="text-caption text-grey">{{ formatTime(runRow.when) }}</div>
          <div class="text-weight-medium q-mt-xs">{{ runRow.summary }}</div>
          <q-separator class="q-my-sm" />
          <pre class="pi-transcript">{{ runRow.output || "(no transcript)" }}</pre>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { useStore } from "vuex";
import {
  fetchPiHistory,
  deletePiHistory,
  runPiChat,
} from "@/api/agents";
import { fetchAIRunsByAgent } from "@/api/core";
import { notifyError } from "@/utils/notify";

export default {
  name: "AIHistoryTab",
  setup() {
    const store = useStore();
    const selectedAgent = computed(() => store.state.selectedRow);
    const tabHeight = computed(() => store.state.tabHeight);
    const rows = ref([]);

    const columns = [
      { name: "source", label: "Source", field: "sourceLabel", align: "left", sortable: true },
      { name: "summary", label: "Summary", field: "summary", align: "left" },
      { name: "user", label: "By", field: "user", align: "left" },
      { name: "when", label: "When", field: "when", align: "left", sortable: true },
      { name: "status", label: "Status", field: "status", align: "left" },
      { name: "actions", label: "", field: "actions", align: "right" },
    ];

    function sourceColor(s) {
      return { chat: "primary", task: "teal", bulk: "deep-purple" }[s] || "grey";
    }
    function statusColor(s) {
      return { ok: "green", warning: "orange", alert: "red", error: "grey", running: "blue" }[s] || "grey";
    }
    function formatTime(ts) {
      try {
        return new Date(ts).toLocaleString();
      } catch (e) {
        return ts;
      }
    }

    async function load() {
      if (!selectedAgent.value) return;
      const merged = [];
      // chat sessions
      try {
        const data = await fetchPiHistory(selectedAgent.value);
        (data.sessions || []).forEach((s) => {
          merged.push({
            key: "chat:" + s.session_id,
            id: s.session_id,
            source: "chat",
            sourceLabel: "Chat",
            summary: s.last_message || s.name || "Chat",
            user: s.user || "",
            when: s.last_activity || s.started,
            status: "",
          });
        });
      } catch (e) {
        /* noop */
      }
      // task + bulk runs
      try {
        const runs = await fetchAIRunsByAgent(selectedAgent.value);
        runs.forEach((r) => {
          merged.push({
            key: "run:" + r.id,
            id: r.id,
            source: r.source, // 'task' | 'bulk'
            sourceLabel:
              r.source === "bulk"
                ? `Bulk: ${r.source_name}`
                : `Task: ${r.source_name}`,
            summary: r.summary || "(running…)",
            user: r.triggered_by || "",
            when: r.started_at,
            status: r.status,
            output: r.output,
          });
        });
      } catch (e) {
        /* noop */
      }
      merged.sort((a, b) => (b.when || "").localeCompare(a.when || ""));
      rows.value = merged;
    }

    function continueChat(sessionId) {
      runPiChat(selectedAgent.value, { resume: sessionId });
    }
    function newChat() {
      runPiChat(selectedAgent.value);
    }
    async function removeChat(sessionId) {
      try {
        await deletePiHistory(selectedAgent.value, sessionId);
        await load();
      } catch (e) {
        notifyError("Failed to delete conversation");
      }
    }

    const runDialog = ref(false);
    const runRow = ref({});
    function viewRun(row) {
      runRow.value = row;
      runDialog.value = true;
    }

    watch(selectedAgent, () => load());
    onMounted(() => {
      if (selectedAgent.value) load();
    });

    return {
      selectedAgent,
      tabHeight,
      rows,
      columns,
      sourceColor,
      statusColor,
      formatTime,
      load,
      continueChat,
      newChat,
      removeChat,
      runDialog,
      runRow,
      viewRun,
    };
  },
};
</script>

<style scoped>
.pi-transcript {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: 11px;
  max-height: 55vh;
  overflow: auto;
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
}
</style>
