<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" maximized>
    <q-card class="column">
      <q-bar class="bg-primary text-white">
        <q-icon name="smart_toy" />
        <div>Bulk AI Commands</div>
        <q-space />
        <q-btn dense flat icon="add" label="New" no-caps @click="addCmd" />
        <q-btn dense flat icon="refresh" @click="load" />
        <q-btn dense flat icon="close" v-close-popup />
      </q-bar>

      <q-card-section class="col q-pa-none scroll">
        <q-table
          :rows="cmds"
          :columns="columns"
          row-key="id"
          dense
          flat
          :pagination="{ rowsPerPage: 0 }"
          hide-bottom
        >
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
          <template #body-cell-last_run="props">
            <q-td :props="props">
              <span v-if="props.row.last_run">
                {{ formatTime(props.row.last_run) }}
                <q-badge color="blue-grey" class="q-ml-xs">
                  {{ props.row.last_run_count }} agents
                </q-badge>
              </span>
              <span v-else class="text-grey">never</span>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn dense flat size="sm" icon="play_arrow" color="primary" @click="runNow(props.row)">
                <q-tooltip>Run now (on all online targets)</q-tooltip>
              </q-btn>
              <q-btn dense flat size="sm" icon="edit" @click="editCmd(props.row)" />
              <q-btn dense flat size="sm" icon="delete" color="red" @click="removeCmd(props.row)" />
            </q-td>
          </template>
        </q-table>
        <div v-if="cmds.length === 0" class="q-pa-lg text-grey text-center">
          No bulk AI commands yet. Create one to run an AI prompt across many
          devices on a schedule (offline agents are skipped).
        </div>
      </q-card-section>

      <!-- create / edit dialog -->
      <q-dialog v-model="dialog">
        <q-card style="width: 720px; max-width: 95vw">
          <q-card-section class="text-subtitle1">
            {{ form.id ? "Edit" : "New" }} Bulk AI Command
          </q-card-section>
          <q-card-section class="q-gutter-sm scroll" style="max-height: 74vh">
            <q-input v-model="form.name" outlined dense label="Name" />
            <q-input
              v-model="form.prompt"
              outlined
              dense
              type="textarea"
              autogrow
              label="Prompt / instructions (runs on each targeted device)"
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

            <!-- targeting (mirrors Bulk Command) -->
            <div class="text-subtitle2 q-mt-sm">Targets</div>
            <q-separator />
            <q-option-group
              v-model="form.target"
              :options="targetOptions"
              inline
              dense
              @update:model-value="previewTargets"
            />
            <q-select
              v-if="form.target === 'client'"
              v-model="form.client"
              :options="clientOptions"
              emit-value
              map-options
              outlined
              dense
              label="Client"
              @update:model-value="previewTargets"
            />
            <q-select
              v-else-if="form.target === 'site'"
              v-model="form.site"
              :options="siteOptions"
              emit-value
              map-options
              outlined
              dense
              label="Site"
              @update:model-value="previewTargets"
            />
            <q-select
              v-else-if="form.target === 'agents'"
              v-model="form.agent_ids"
              :options="filteredAgents"
              emit-value
              map-options
              multiple
              use-chips
              use-input
              input-debounce="0"
              outlined
              dense
              label="Agents (type to filter by name / client / site)"
              @filter="filterAgents"
              @update:model-value="previewTargets"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>
                      {{ scope.opt.label }}
                      <span class="pi-faded"
                        >({{ scope.opt.client }} / {{ scope.opt.site }})</span
                      >
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item><q-item-section class="text-grey">No agents</q-item-section></q-item>
              </template>
            </q-select>

            <!-- dynamic filter builder -->
            <div v-else-if="form.target === 'filter'">
              <div class="text-caption text-grey q-mb-xs">
                Match every online agent where ALL conditions are true:
              </div>
              <div
                v-for="(cond, idx) in form.filters"
                :key="idx"
                class="row q-col-gutter-xs q-mb-xs items-center"
              >
                <q-select
                  v-model="cond.field"
                  :options="filterFieldOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Field"
                  class="col-3"
                  @update:model-value="previewTargets"
                />
                <q-select
                  v-model="cond.op"
                  :options="filterOpOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Is"
                  class="col-3"
                  @update:model-value="previewTargets"
                />
                <q-input
                  v-model="cond.value"
                  outlined
                  dense
                  label="Value"
                  class="col"
                  debounce="300"
                  @update:model-value="previewTargets"
                />
                <q-btn
                  dense
                  flat
                  round
                  icon="close"
                  color="red"
                  @click="removeFilter(idx)"
                />
              </div>
              <q-btn
                dense
                flat
                no-caps
                icon="add"
                label="Add filter"
                color="primary"
                @click="addFilter"
              />
            </div>
            <div
              v-if="['all', 'client', 'site'].includes(form.target)"
              class="row q-col-gutter-sm"
            >
              <q-select
                v-model="form.mon_type"
                :options="monTypeOptions"
                emit-value
                map-options
                outlined
                dense
                label="Type"
                class="col"
                @update:model-value="previewTargets"
              />
              <q-select
                v-model="form.os_type"
                :options="osTypeOptions"
                emit-value
                map-options
                outlined
                dense
                label="OS"
                class="col"
                @update:model-value="previewTargets"
              />
            </div>
            <q-banner dense class="bg-blue-1 text-black">
              <div class="row items-center">
                <q-icon name="dns" class="q-mr-xs" /> Matches
                <strong class="q-mx-xs">{{ preview.online_count }}</strong>
                online device(s) right now (offline are skipped at run time).
                <q-space />
                <q-btn
                  v-if="(preview.agents || []).length"
                  dense
                  flat
                  size="sm"
                  no-caps
                  :label="showMatched ? 'Hide list' : 'Show list'"
                  :icon="showMatched ? 'expand_less' : 'expand_more'"
                  @click="showMatched = !showMatched"
                />
              </div>
              <div
                v-if="showMatched && (preview.agents || []).length"
                class="pi-matched q-mt-xs"
              >
                <div
                  v-for="(m, i) in preview.agents"
                  :key="i"
                  class="pi-matched-row"
                >
                  <q-icon name="dns" size="xs" class="q-mr-xs" />{{ m.hostname }}
                  <span class="pi-faded">({{ m.client }} / {{ m.site }})</span>
                </div>
              </div>
            </q-banner>

            <!-- run mode -->
            <div class="text-subtitle2 q-mt-sm">When to run</div>
            <q-separator />
            <q-option-group
              v-model="form.run_mode"
              :options="runModeOptions"
              inline
              dense
            />
            <div v-if="form.run_mode === 'now'" class="text-caption text-grey">
              One-shot: runs on the online targets when you click Run now, then
              disables itself (kept here with its results).
            </div>

            <!-- schedule -->
            <template v-if="form.run_mode === 'schedule'">
            <div class="text-subtitle2 q-mt-sm">Schedule</div>
            <q-separator />
            <q-select
              v-model="form.schedule_type"
              :options="scheduleOptions"
              emit-value
              map-options
              outlined
              dense
              label="Run"
            />
            <q-input
              v-if="form.schedule_type === 'interval'"
              v-model.number="form.interval_hours"
              type="number"
              outlined
              dense
              label="Every N hours"
            />
            <template v-else>
              <q-input
                v-model="form.run_time"
                type="time"
                outlined
                dense
                label="At time (server time)"
              />
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
            </template>

            <!-- options -->
            <q-select
              v-model="form.alert_threshold"
              :options="thresholdOptions"
              emit-value
              map-options
              outlined
              dense
              label="Raise TRMM alert when"
              class="q-mt-sm"
            />
            <q-checkbox
              v-model="form.allow_mutating"
              label="Allow changes (run scripts / kill / reboot) — off = read-only diagnostics"
            />
            <q-checkbox v-model="form.enabled" label="Enabled" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cancel" v-close-popup />
            <q-btn
              v-if="form.id"
              flat
              color="primary"
              icon="play_arrow"
              label="Save & Run now"
              @click="saveAndRun"
            />
            <q-btn color="primary" label="Save" @click="saveForm" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, onMounted } from "vue";
import { useDialogPluginComponent } from "quasar";
import {
  fetchBulkAICommands,
  saveBulkAICommand,
  editBulkAICommand,
  deleteBulkAICommand,
  runBulkAICommandNow,
  previewBulkAITargets,
  fetchAIModels,
} from "@/api/core";
import { useClientDropdown, useSiteDropdown } from "@/composables/clients";
import { fetchAgents } from "@/api/agents";
import { notifySuccess, notifyError } from "@/utils/notify";

export default {
  name: "BulkAICommands",
  emits: [...useDialogPluginComponent.emits],
  setup() {
    const { dialogRef, onDialogHide } = useDialogPluginComponent();
    const { clientOptions } = useClientDropdown(true);
    const { siteOptions } = useSiteDropdown(true);
    const allAgents = ref([]); // [{value, label, client, site}]
    const filteredAgents = ref([]);
    async function loadAgents() {
      try {
        const data = await fetchAgents({ detail: false });
        allAgents.value = (data || []).map((a) => ({
          value: a.agent_id,
          label: a.hostname,
          client: a.client,
          site: a.site,
        }));
        filteredAgents.value = allAgents.value;
      } catch (e) {
        allAgents.value = [];
      }
    }
    function filterAgents(val, update) {
      update(() => {
        const needle = (val || "").toLowerCase();
        filteredAgents.value = !needle
          ? allAgents.value
          : allAgents.value.filter(
              (o) =>
                o.label.toLowerCase().includes(needle) ||
                (o.client || "").toLowerCase().includes(needle) ||
                (o.site || "").toLowerCase().includes(needle),
            );
      });
    }

    const cmds = ref([]);
    const modelOptions = ref([]);
    const preview = ref({ online_count: 0, agents: [] });
    const showMatched = ref(false);

    const columns = [
      { name: "name", label: "Name", field: "name", align: "left" },
      { name: "target_summary", label: "Targets", field: "target_summary", align: "left" },
      { name: "schedule", label: "Schedule", field: "schedule", align: "left" },
      { name: "model_display", label: "Model", field: "model_display", align: "left" },
      { name: "alert_threshold", label: "Alert", field: "alert_threshold", align: "left" },
      { name: "last_run", label: "Last run", field: "last_run", align: "left" },
      { name: "enabled", label: "On", field: "enabled", align: "center" },
      { name: "actions", label: "", field: "actions", align: "right" },
    ];
    const targetOptions = [
      { label: "All", value: "all" },
      { label: "Client", value: "client" },
      { label: "Site", value: "site" },
      { label: "Agents", value: "agents" },
      { label: "Filter", value: "filter" },
    ];
    const filterFieldOptions = [
      { label: "Hostname", value: "hostname" },
      { label: "Client", value: "client" },
      { label: "Site", value: "site" },
      { label: "Description", value: "description" },
      { label: "OS", value: "operating_system" },
      { label: "Platform (windows/linux/darwin)", value: "plat" },
      { label: "Monitoring type (server/workstation)", value: "monitoring_type" },
    ];
    const filterOpOptions = [
      { label: "contains", value: "contains" },
      { label: "does not contain", value: "not_contains" },
      { label: "equals", value: "equals" },
      { label: "does not equal", value: "not_equals" },
      { label: "starts with", value: "startswith" },
    ];
    function addFilter() {
      form.value.filters.push({ field: "hostname", op: "contains", value: "" });
    }
    function removeFilter(idx) {
      form.value.filters.splice(idx, 1);
      previewTargets();
    }
    const monTypeOptions = [
      { label: "All", value: "all" },
      { label: "Servers", value: "servers" },
      { label: "Workstations", value: "workstations" },
    ];
    const osTypeOptions = [
      { label: "All", value: "all" },
      { label: "Windows", value: "windows" },
      { label: "Linux", value: "linux" },
      { label: "macOS", value: "darwin" },
    ];
    const runModeOptions = [
      { label: "Now (one-shot)", value: "now" },
      { label: "Scheduled", value: "schedule" },
    ];
    const scheduleOptions = [
      { label: "Every N hours", value: "interval" },
      { label: "Daily", value: "daily" },
      { label: "Weekly", value: "weekly" },
      { label: "Monthly", value: "monthly" },
    ];
    const thresholdOptions = [
      { label: "Never raise an alert", value: "never" },
      { label: "Alert on Warning or Alert", value: "warning" },
      { label: "Alert only on Alert", value: "alert" },
    ];
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
      if (row.schedule_type === "interval") return `Every ${row.interval_hours}h`;
      if (row.schedule_type === "daily") return `Daily at ${row.run_time || "?"}`;
      if (row.schedule_type === "weekly")
        return `Weekly ${(row.weekly_days || []).map((d) => weekDays[d].label).join(",")} at ${row.run_time || "?"}`;
      if (row.schedule_type === "monthly")
        return `Monthly day ${row.monthly_day} at ${row.run_time || "?"}`;
      return "";
    }
    function formatTime(ts) {
      try {
        return new Date(ts).toLocaleString();
      } catch (e) {
        return ts;
      }
    }

    async function load() {
      try {
        cmds.value = await fetchBulkAICommands();
      } catch (e) {
        cmds.value = [];
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

    const dialog = ref(false);
    const form = ref({});
    function blankForm() {
      return {
        name: "",
        prompt: "",
        model: null,
        run_mode: "schedule",
        target: "all",
        client: null,
        site: null,
        agent_ids: [],
        mon_type: "all",
        os_type: "all",
        filters: [],
        schedule_type: "daily",
        interval_hours: 24,
        run_time: "03:00",
        weekly_days: [],
        monthly_day: 1,
        alert_threshold: "alert",
        allow_mutating: false,
        enabled: true,
      };
    }
    function addCmd() {
      form.value = blankForm();
      preview.value = { online_count: 0 };
      dialog.value = true;
      previewTargets();
    }
    function editCmd(row) {
      form.value = { ...blankForm(), ...row };
      dialog.value = true;
      previewTargets();
    }

    async function previewTargets() {
      try {
        preview.value = await previewBulkAITargets({
          target: form.value.target,
          client: form.value.client,
          site: form.value.site,
          agent_ids: form.value.agent_ids,
          filters: form.value.filters,
          mon_type: form.value.mon_type,
          os_type: form.value.os_type,
        });
      } catch (e) {
        preview.value = { online_count: 0 };
      }
    }

    async function saveForm() {
      try {
        if (form.value.id) await editBulkAICommand(form.value.id, form.value);
        else await saveBulkAICommand(form.value);
        notifySuccess("Bulk AI command saved");
        dialog.value = false;
        await load();
      } catch (e) {
        notifyError(e?.response?.data || "Failed to save");
      }
    }
    async function saveAndRun() {
      try {
        await editBulkAICommand(form.value.id, form.value);
        await runBulkAICommandNow(form.value.id);
        notifySuccess("Saved and queued to run now");
        dialog.value = false;
        await load();
      } catch (e) {
        notifyError("Failed");
      }
    }
    async function runNow(row) {
      try {
        await runBulkAICommandNow(row.id);
        notifySuccess(`"${row.name}" queued — runs on online targets`);
        setTimeout(load, 1500);
      } catch (e) {
        notifyError("Failed to run");
      }
    }
    async function removeCmd(row) {
      try {
        await deleteBulkAICommand(row.id);
        await load();
      } catch (e) {
        notifyError("Failed to delete");
      }
    }

    onMounted(async () => {
      loadModels();
      load();
      await loadAgents();
    });

    return {
      dialogRef,
      onDialogHide,
      cmds,
      modelOptions,
      preview,
      showMatched,
      clientOptions,
      siteOptions,
      filteredAgents,
      filterAgents,
      columns,
      filterFieldOptions,
      filterOpOptions,
      addFilter,
      removeFilter,
      targetOptions,
      monTypeOptions,
      osTypeOptions,
      runModeOptions,
      scheduleOptions,
      thresholdOptions,
      weekDays,
      scheduleText,
      formatTime,
      load,
      dialog,
      form,
      addCmd,
      editCmd,
      previewTargets,
      saveForm,
      saveAndRun,
      runNow,
      removeCmd,
    };
  },
};
</script>

<style scoped>
.pi-faded {
  opacity: 0.55;
  font-size: 0.9em;
}
.pi-matched {
  max-height: 220px;
  overflow-y: auto;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  padding-top: 4px;
}
.pi-matched-row {
  font-size: 12px;
  padding: 1px 0;
}
</style>
