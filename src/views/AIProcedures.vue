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
      <q-card style="width: 760px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white q-py-sm">
          <div class="text-subtitle1">{{ edit.id ? "Edit procedure" : "New procedure" }}</div>
          <q-space />
          <q-badge v-if="edit.id" color="white" text-color="primary" :label="'seen ' + (edit.occurrence_count || 1) + '×'" />
        </q-card-section>
        <q-card-section class="q-gutter-sm scroll" style="max-height: 70vh">
          <div class="row q-col-gutter-sm">
            <q-input v-model="edit.title" class="col-8" dense outlined label="Title" />
            <q-input v-model="edit.category" class="col-4" dense outlined label="Category" />
          </div>
          <q-input v-model="edit.applies_to" dense outlined label="Applies to (vendor/app/OS keywords)" />
          <q-input v-model="edit.symptom" type="textarea" autogrow dense outlined label="Symptom" />
          <q-input v-model="edit.root_cause" type="textarea" autogrow dense outlined label="Root cause" />
          <q-input v-model="edit.fix" type="textarea" autogrow dense outlined label="Fix (steps)" />
          <q-input v-model="edit.verification" type="textarea" autogrow dense outlined label="Verification" />
          <div class="row q-col-gutter-sm">
            <q-select
              v-model="edit.status"
              class="col-4"
              dense
              outlined
              label="Status"
              :options="['draft', 'approved', 'retired']"
            />
            <q-input class="col-4" dense outlined readonly label="Origin" :model-value="edit.origin || 'human'" />
            <q-input
              class="col-4"
              dense
              outlined
              readonly
              label="Source tickets"
              :model-value="(edit.source_ticket_refs || []).join(', ')"
            />
          </div>
        </q-card-section>
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
