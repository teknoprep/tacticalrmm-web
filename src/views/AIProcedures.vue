<template>
  <div style="height: 100vh; display: flex; flex-direction: column; background: #f5f5f5; padding: 6px; box-sizing: border-box">
    <q-card flat bordered style="width: 100%; flex: 1; display: flex; flex-direction: column; min-height: 0">
      <q-card-section class="bg-primary text-white row items-center q-py-sm">
        <q-icon name="menu_book" size="sm" class="q-mr-sm" />
        <div class="text-subtitle1">Pi.dev AI — Procedures</div>
        <q-space />
        <q-input
          v-model="q"
          dense
          dark
          outlined
          debounce="300"
          placeholder="Search symptom / fix / title…"
          style="max-width: 320px"
          class="q-mr-sm"
          @update:model-value="load"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <q-btn dense flat round icon="add" class="q-mr-xs" @click="openNew">
          <q-tooltip>Add procedure</q-tooltip>
        </q-btn>
        <q-btn dense flat round icon="auto_awesome" class="q-mr-xs" :loading="mining" @click="mine">
          <q-tooltip>Mine closed tickets now</q-tooltip>
        </q-btn>
        <q-btn dense flat round icon="refresh" :loading="loading" @click="load" />
      </q-card-section>
      <q-separator />

      <div class="row items-center q-px-md q-py-sm q-gutter-sm">
        <q-select
          v-model="category"
          :options="['', ...categories]"
          dense
          outlined
          options-dense
          label="Category"
          style="min-width: 180px"
          emit-value
          map-options
          @update:model-value="load"
        />
        <q-btn-toggle
          v-model="statusFilter"
          dense
          no-caps
          toggle-color="primary"
          :options="[
            { label: 'All', value: '' },
            { label: 'Draft', value: 'draft' },
            { label: 'Approved', value: 'approved' },
            { label: 'Retired', value: 'retired' },
          ]"
          @update:model-value="load"
        />
        <q-space />
        <div class="text-caption text-grey-7">{{ rows.length }} shown / {{ total }} total</div>
      </div>
      <q-separator />

      <div style="flex: 1; min-height: 0; overflow: auto">
        <q-table
          :rows="rows"
          :columns="columns"
          row-key="id"
          flat
          dense
          :loading="loading"
          :pagination="{ rowsPerPage: 0, sortBy: 'updated', descending: true }"
          hide-bottom
          separator="horizontal"
          class="proc-table"
          @row-dblclick="(e, row) => openEdit(row)"
        >
          <template #body-cell-confidence="props">
            <q-td :props="props">
              <q-badge :color="confColor(props.value)" :label="props.value" />
            </q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge :color="statusColor(props.value)" :label="props.value" />
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" class="text-right">
              <q-btn dense flat round size="sm" icon="edit" @click="openEdit(props.row)">
                <q-tooltip>Edit</q-tooltip>
              </q-btn>
              <q-btn
                v-if="props.row.status !== 'approved'"
                dense
                flat
                round
                size="sm"
                icon="check_circle"
                color="positive"
                @click="setStatus(props.row, 'approved')"
              >
                <q-tooltip>Approve</q-tooltip>
              </q-btn>
              <q-btn dense flat round size="sm" icon="delete" color="negative" @click="remove(props.row)">
                <q-tooltip>Delete</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </div>
    </q-card>

    <!-- editor -->
    <q-dialog v-model="editDialog" persistent>
      <q-card style="width: 840px; max-width: 96vw">
        <q-card-section class="row items-center bg-primary text-white q-py-sm">
          <q-icon name="menu_book" size="sm" class="q-mr-sm" />
          <div class="text-subtitle1">
            {{ edit.id ? "Edit procedure" : "New procedure" }}
            <span v-if="edit.code" class="text-weight-bold q-ml-sm">#{{ edit.code }}</span>
          </div>
          <q-space />
          <q-badge v-if="edit.confidence" :color="confColor(edit.confidence)" class="q-mr-xs" :label="edit.confidence" />
          <q-badge v-if="edit.id" color="white" text-color="primary" :label="'seen ' + (edit.occurrence_count || 1) + '×'" />
        </q-card-section>

        <q-card-section class="scroll q-pt-md" style="max-height: 74vh">
          <q-input v-model="edit.title" outlined dense autogrow label="Title" class="q-mb-md" />
          <div class="row q-col-gutter-md q-mb-md">
            <q-input v-model="edit.category" class="col-12 col-sm-5" outlined dense label="Category" />
            <q-input
              v-model="edit.applies_to"
              class="col-12 col-sm-7"
              outlined
              dense
              autogrow
              label="Applies to (vendor / app / OS keywords)"
            />
          </div>

          <div class="proc-label">Symptom</div>
          <q-input v-model="edit.symptom" type="textarea" outlined autogrow input-style="min-height:56px" class="q-mb-md" />
          <div class="proc-label">Root cause</div>
          <q-input v-model="edit.root_cause" type="textarea" outlined autogrow input-style="min-height:56px" class="q-mb-md" />
          <div class="proc-label">Fix (steps)</div>
          <q-input v-model="edit.fix" type="textarea" outlined autogrow input-style="min-height:120px" class="q-mb-md" />
          <div class="proc-label">Verification</div>
          <q-input v-model="edit.verification" type="textarea" outlined autogrow input-style="min-height:56px" class="q-mb-md" />

          <q-separator class="q-my-sm" />
          <div class="row q-col-gutter-md items-center">
            <q-select
              v-model="edit.status"
              class="col-12 col-sm-4"
              outlined
              dense
              label="Status"
              :options="['draft', 'approved', 'retired']"
            />
            <div class="col-12 col-sm-8 text-caption text-grey-7">
              <span class="q-mr-md">Origin: <b>{{ edit.origin || "human" }}</b></span>
              <span v-if="edit.updated_by">Last edited by <b>{{ edit.updated_by }}</b></span>
            </div>
          </div>
          <div v-if="(edit.source_ticket_refs || []).length" class="q-mt-md">
            <div class="proc-label">Source tickets</div>
            <div class="row q-gutter-xs">
              <q-badge
                v-for="r in edit.source_ticket_refs"
                :key="r"
                color="blue-grey-2"
                text-color="black"
                :label="r"
              />
            </div>
          </div>
        </q-card-section>

        <q-separator />
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" :loading="saving" @click="save" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import { useQuasar } from "quasar";
import {
  getProcedures,
  createProcedure,
  updateProcedure,
  deleteProcedure,
  mineProceduresNow,
} from "@/api/core";

export default defineComponent({
  name: "AIProcedures",
  setup() {
    const $q = useQuasar();
    const rows = ref([]);
    const categories = ref([]);
    const total = ref(0);
    const loading = ref(false);
    const mining = ref(false);
    const saving = ref(false);
    const q = ref("");
    const category = ref("");
    const statusFilter = ref("");
    const editDialog = ref(false);
    const edit = ref({});

    const columns = [
      { name: "code", label: "ID", field: "code", align: "left", sortable: true },
      { name: "title", label: "Title", field: "title", align: "left", sortable: true },
      { name: "category", label: "Category", field: "category", align: "left", sortable: true },
      { name: "applies_to", label: "Applies to", field: "applies_to", align: "left" },
      { name: "occurrence_count", label: "Seen", field: "occurrence_count", align: "center", sortable: true },
      { name: "confidence", label: "Confidence", field: "confidence", align: "center", sortable: true },
      { name: "status", label: "Status", field: "status", align: "center", sortable: true },
      { name: "updated", label: "Updated", field: "updated", align: "left", sortable: true,
        format: (v) => (v ? new Date(v).toLocaleString() : "") },
      { name: "actions", label: "", field: "actions", align: "right" },
    ];

    const confColor = (c) => ({ high: "green", medium: "orange", low: "grey" }[c] || "grey");
    const statusColor = (s) => ({ approved: "green", draft: "blue-grey", retired: "grey" }[s] || "grey");

    async function load() {
      loading.value = true;
      try {
        const data = await getProcedures({ q: q.value, category: category.value, status: statusFilter.value });
        rows.value = data.procedures;
        categories.value = data.categories;
        total.value = data.total;
      } catch (e) {
        $q.notify({ type: "negative", message: "Failed to load procedures" });
      } finally {
        loading.value = false;
      }
    }

    function openNew() {
      edit.value = { title: "", category: "", applies_to: "", symptom: "", root_cause: "", fix: "", verification: "", status: "draft", origin: "human" };
      editDialog.value = true;
    }
    function openEdit(row) {
      edit.value = { ...row };
      editDialog.value = true;
    }

    async function save() {
      saving.value = true;
      try {
        if (edit.value.id) await updateProcedure(edit.value.id, edit.value);
        else await createProcedure(edit.value);
        editDialog.value = false;
        await load();
        $q.notify({ type: "positive", message: "Saved" });
      } catch (e) {
        $q.notify({ type: "negative", message: "Save failed" });
      } finally {
        saving.value = false;
      }
    }

    async function setStatus(row, status) {
      await updateProcedure(row.id, { ...row, status });
      await load();
    }

    function remove(row) {
      $q.dialog({
        title: "Delete procedure",
        message: `Delete "${row.title}"?`,
        cancel: true,
        ok: { label: "Delete", color: "negative" },
      }).onOk(async () => {
        await deleteProcedure(row.id);
        await load();
      });
    }

    async function mine() {
      mining.value = true;
      try {
        await mineProceduresNow();
        $q.notify({ type: "info", message: "Mining started — new procedures will appear shortly. Refresh in a minute." });
      } finally {
        mining.value = false;
      }
    }

    load();
    return {
      rows, categories, total, loading, mining, saving, q, category, statusFilter,
      editDialog, edit, columns, confColor, statusColor,
      load, openNew, openEdit, save, setStatus, remove, mine,
    };
  },
});
</script>

<style scoped>
/* readable, aligned labels above each multi-line field */
.proc-label {
  font-size: 12px;
  font-weight: 600;
  color: #37474f;
  margin-bottom: 4px;
}
/* larger, easier-to-read text in the editor's textareas */
:deep(.q-textarea .q-field__native) {
  font-size: 13.5px;
  line-height: 1.5;
}
/* rows are double-clickable to open */
.proc-table :deep(tbody tr) {
  cursor: pointer;
}
</style>
