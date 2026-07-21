<template>
  <div class="q-pa-md" style="min-height: 100vh; background: #f5f5f5">
    <q-card flat bordered style="max-width: 1100px; margin: 0 auto">
      <q-card-section class="bg-primary text-white row items-center q-py-sm">
        <q-icon name="schedule" size="sm" class="q-mr-sm" />
        <div class="text-subtitle1">Pi.dev AI — Scheduled Actions</div>
        <q-space />
        <q-btn dense flat round icon="refresh" :loading="loading" @click="load" />
      </q-card-section>
      <q-separator />
      <q-table
        :rows="rows"
        :columns="columns"
        row-key="id"
        flat
        dense
        :loading="loading"
        :pagination="{ rowsPerPage: 0, sortBy: 'run_at' }"
        hide-bottom
        no-data-label="No scheduled actions. The AI schedules these (in the decision chat) for work that must run at a specific time."
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.row.status)" :label="props.row.status" />
          </q-td>
        </template>
        <template #body-cell-action="props">
          <q-td :props="props" style="max-width: 340px; white-space: normal">
            {{ props.row.action }}
            <div v-if="props.row.result" class="text-caption text-grey">↳ {{ props.row.result }}</div>
          </q-td>
        </template>
        <template #body-cell-cancel="props">
          <q-td :props="props" class="text-right">
            <q-btn
              v-if="props.row.status === 'scheduled'"
              dense
              flat
              round
              color="negative"
              icon="delete"
              @click="cancel(props.row)"
            >
              <q-tooltip>Cancel this scheduled action</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { getScheduledActions, deleteScheduledAction } from "@/api/core";
import { notifyError, notifySuccess } from "@/utils/notify";

export default {
  name: "AIScheduledActions",
  setup() {
    const rows = ref([]);
    const loading = ref(false);
    const columns = [
      { name: "run_at", label: "Run at", field: "run_at", align: "left", sortable: true,
        format: (v) => { try { return new Date(v).toLocaleString(); } catch (e) { return v; } } },
      { name: "status", label: "Status", field: "status", align: "left" },
      { name: "ticket_ref", label: "Ticket", field: "ticket_ref", align: "left" },
      { name: "agent", label: "Device", field: "agent", align: "left" },
      { name: "action", label: "Action", field: "action", align: "left" },
      { name: "created_by", label: "By", field: "created_by", align: "left" },
      { name: "cancel", label: "", field: "cancel", align: "right" },
    ];
    function statusColor(s) {
      return { scheduled: "blue", running: "orange", error: "red", done: "green" }[s] || "grey";
    }
    async function load() {
      loading.value = true;
      try {
        rows.value = await getScheduledActions();
      } catch (e) {
        notifyError("Could not load scheduled actions");
      }
      loading.value = false;
    }
    async function cancel(row) {
      try {
        await deleteScheduledAction(row.id);
        notifySuccess("Scheduled action cancelled");
        await load();
      } catch (e) {
        notifyError("Could not cancel");
      }
    }
    onMounted(load);
    return { rows, loading, columns, statusColor, load, cancel };
  },
};
</script>
