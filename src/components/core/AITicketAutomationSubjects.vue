<template>
  <!-- TICKET AUTOMATION SUBJECTS: the kinds of ticket the AI may work on its own.
       Procedures say HOW; a subject says WHICH tickets and HOW FAR. Subjects arrive as
       proposals from the daily report (approve/reject by email or here) or are created
       here by hand. -->
  <div class="subjects-root">
    <div class="q-px-md q-pt-sm text-caption text-grey-7">
      Which tickets the AI may work automatically, and how far it may go. Procedures say <i>how</i>;
      a subject says <i>which tickets</i> and <i>how far</i>. The AI never closes a ticket under a
      subject; it replies only on a confident verdict with two or more concrete findings.
    </div>
    <div class="q-pa-sm">
      <div class="row items-center q-mb-sm">
        <q-btn dense no-caps flat icon="add" label="New subject" color="primary" @click="openNew" />
        <q-btn dense flat round icon="refresh" :loading="loading" class="q-ml-xs" @click="load" />
        <q-space />
        <div class="text-caption text-grey-7">
          Modes: <b>Advise</b> = reply from the ticket, no device access at all &middot;
          <b>Investigate</b> = read-only device probes, nothing changed &middot;
          <b>Fix</b> = needs an attached script (none yet)
        </div>
      </div>

      <q-banner v-if="proposed.length" dense class="bg-amber-1 text-grey-9 q-mb-sm">
        <template #avatar><q-icon name="mark_email_unread" color="amber-9" /></template>
        {{ proposed.length }} proposal(s) from the daily report are waiting. Approve or reject them below.
      </q-banner>

      <q-table
        :rows="rows"
        :columns="columns"
        row-key="id"
        dense
        flat
        hide-bottom
        :pagination="{ rowsPerPage: 0, sortBy: 'status' }"
        table-style="table-layout: fixed"
      >
        <template #body-cell-name="props">
          <q-td :props="props">
            <div class="text-weight-medium">{{ props.row.name }}</div>
            <div class="text-caption text-grey-7 ellipsis">{{ props.row.description }}</div>
          </q-td>
        </template>
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.row)" :label="statusLabel(props.row)" />
          </q-td>
        </template>
        <template #body-cell-mode="props">
          <q-td :props="props">
            <q-badge outline :color="props.row.mode === 'advise' ? 'teal-8' : props.row.mode === 'device_readonly' ? 'blue-8' : 'orange-8'"
              :label="props.row.mode === 'advise' ? 'Advise' : props.row.mode === 'device_readonly' ? 'Investigate' : 'Fix'" />
          </q-td>
        </template>
        <template #body-cell-scope="props">
          <q-td :props="props">
            <span v-if="props.row.all_clients">All clients</span>
            <span v-else>{{ [...(props.row.clients || []), ...(props.row.domains || [])].join(', ') || '—' }}</span>
          </q-td>
        </template>
        <template #body-cell-stats="props">
          <q-td :props="props" class="no-wrap">
            {{ props.row.tickets_worked }} worked · {{ props.row.tickets_matched }} matched
            <span v-if="props.row.tickets_deduped"> · {{ props.row.tickets_deduped }} dedup</span>
            <q-tooltip v-if="props.row.last_worked">Last worked {{ new Date(props.row.last_worked).toLocaleString() }}</q-tooltip>
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" class="no-wrap">
            <template v-if="props.row.status === 'proposed'">
              <q-btn dense no-caps unelevated size="sm" color="positive" label="Approve" class="q-mr-xs" @click="decide(props.row, 'approved')" />
              <q-btn dense no-caps flat size="sm" color="negative" label="Reject" @click="decide(props.row, 'rejected')" />
            </template>
            <template v-else>
              <q-toggle
                v-if="props.row.status === 'approved'"
                :model-value="props.row.enabled"
                dense size="sm"
                @update:model-value="(v) => save(props.row, { enabled: v })"
              >
                <q-tooltip>{{ props.row.enabled ? 'Live - switch off' : 'Off - switch on' }}</q-tooltip>
              </q-toggle>
            </template>
            <q-btn dense flat round size="sm" icon="edit" @click="openEdit(props.row)" />
            <q-btn dense flat round size="sm" icon="delete" color="red" @click="remove(props.row)" />
          </q-td>
        </template>
      </q-table>
      <div v-if="!rows.length && !loading" class="text-grey-6 q-pa-sm">
        No subjects yet. The daily "Ticket Automation Subjects" report proposes them; or add one here.
      </div>
    </div>

    <!-- editor -->
    <q-dialog v-model="dialog">
      <q-card style="width: 760px; max-width: 95vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ edit.id ? 'Edit subject' : 'New ticket automation subject' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input v-model="edit.name" dense outlined label="Name" />
          <q-input v-model="edit.description" dense outlined autogrow type="textarea" label="What this subject covers (plain language)" />
          <div class="row q-col-gutter-sm">
            <q-select v-model="edit.mode" dense outlined emit-value map-options class="col"
              :options="[
                { label: 'Advise - reply from the ticket; no device access', value: 'advise' },
                { label: 'Investigate - read-only device probes, then advise', value: 'device_readonly' },
              ]" label="Mode" />
            <q-select v-model="edit.status" dense outlined emit-value map-options class="col"
              :options="[{label:'Approved (live)',value:'approved'},{label:'Proposed',value:'proposed'},{label:'Rejected',value:'rejected'},{label:'Retired',value:'retired'}]" label="Status" />
          </div>
          <q-input v-model="matchText" dense outlined autogrow type="textarea" input-style="font-family:monospace;font-size:12px"
            label="Match rules (JSON): subject_regex, body_any, body_all, body_none, sender_regex"
            :error="!!matchError" :error-message="matchError" />
          <q-input v-model="procText" dense outlined label="Procedure ids (comma-separated)" hint="Global how-to the AI works from" />
          <q-input v-model="kbText" dense outlined label="Helpdesk KB article ids (comma-separated)" hint="Customer specifics" />
          <q-input v-model="edit.instructions" dense outlined autogrow type="textarea"
            label="Instructions / reply template" hint="If this contains {{findings}} it is used verbatim as the customer reply, with the AI's findings inserted." />
          <div class="row items-center q-col-gutter-sm">
            <q-toggle v-model="edit.all_clients" dense label="All clients" class="col-auto" />
            <q-input v-model="clientsText" dense outlined class="col" :disable="edit.all_clients" label="Clients (comma-separated names)" />
            <q-input v-model="domainsText" dense outlined class="col" :disable="edit.all_clients" label="Requester domains" />
          </div>
          <q-input v-model.number="edit.baseline_minutes" dense outlined type="number" label="Baseline minutes a human takes (for time-saved reporting)" style="max-width: 360px" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn unelevated no-caps color="primary" label="Save" :loading="saving" :disable="!!matchError || !edit.name" @click="submit" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { computed, defineComponent, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import {
  fetchAutomationSubjects,
  createAutomationSubject,
  updateAutomationSubject,
  deleteAutomationSubject,
} from "@/api/core";
import { notifyError, notifySuccess } from "@/utils/notify";

export default defineComponent({
  name: "AITicketAutomationSubjects",
  emits: ["counts"],
  setup(_props, { emit }) {
    const $q = useQuasar();
    const rows = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const dialog = ref(false);
    const edit = ref({});
    const matchText = ref("{}");
    const procText = ref("");
    const kbText = ref("");
    const clientsText = ref("");
    const domainsText = ref("");

    const live = computed(() => rows.value.filter((r) => r.status === "approved" && r.enabled));
    const proposed = computed(() => rows.value.filter((r) => r.status === "proposed"));

    const columns = [
      { name: "name", label: "Subject", field: "name", align: "left", style: "width: 34%" },
      { name: "status", label: "Status", field: "status", align: "left", sortable: true, style: "width: 12%" },
      { name: "mode", label: "Mode", field: "mode", align: "left", style: "width: 10%" },
      { name: "scope", label: "Clients", field: "all_clients", align: "left", style: "width: 16%" },
      { name: "stats", label: "Activity", field: "tickets_worked", align: "left", style: "width: 16%" },
      { name: "actions", label: "", field: "id", align: "right", style: "width: 12%" },
    ];

    const matchError = computed(() => {
      try {
        const v = JSON.parse(matchText.value || "{}");
        if (!v || typeof v !== "object" || Array.isArray(v)) return "must be a JSON object";
        return "";
      } catch (e) {
        return "not valid JSON";
      }
    });

    function statusColor(r) {
      if (r.status === "proposed") return "amber-9";
      if (r.status === "approved") return r.enabled ? "positive" : "grey-6";
      if (r.status === "rejected") return "negative";
      return "grey-6";
    }
    function statusLabel(r) {
      if (r.status === "approved") return r.enabled ? "LIVE" : "off";
      return r.status;
    }

    async function load() {
      loading.value = true;
      try {
        const d = await fetchAutomationSubjects();
        rows.value = d.subjects || [];
        emit("counts", { live: live.value.length, proposed: proposed.value.length });
      } catch (e) {
        notifyError("Could not load automation subjects");
      } finally {
        loading.value = false;
      }
    }

    const split = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

    function openNew() {
      edit.value = { name: "", description: "", mode: "advise", status: "approved", instructions: "",
        all_clients: true, clients: [], domains: [], baseline_minutes: null, match: {}, procedures: [], kb_article_ids: [] };
      matchText.value = JSON.stringify({ subject_regex: "", body_any: [] }, null, 2);
      procText.value = ""; kbText.value = ""; clientsText.value = ""; domainsText.value = "";
      dialog.value = true;
    }
    function openEdit(r) {
      edit.value = { ...r };
      matchText.value = JSON.stringify(r.match || {}, null, 2);
      procText.value = (r.procedures || []).join(", ");
      kbText.value = (r.kb_article_ids || []).join(", ");
      clientsText.value = (r.clients || []).join(", ");
      domainsText.value = (r.domains || []).join(", ");
      dialog.value = true;
    }
    async function submit() {
      saving.value = true;
      try {
        const payload = {
          ...edit.value,
          match: JSON.parse(matchText.value || "{}"),
          procedures: split(procText.value).map(Number).filter((n) => !Number.isNaN(n)),
          kb_article_ids: split(kbText.value).map(Number).filter((n) => !Number.isNaN(n)),
          clients: split(clientsText.value),
          domains: split(domainsText.value),
        };
        delete payload.procedure_titles; delete payload.mode_display;
        if (payload.id) await updateAutomationSubject(payload.id, payload);
        else await createAutomationSubject(payload);
        notifySuccess("Subject saved");
        dialog.value = false;
        await load();
      } catch (e) {
        notifyError(e?.response?.data || "Save failed");
      } finally {
        saving.value = false;
      }
    }
    async function save(r, patch) {
      try {
        await updateAutomationSubject(r.id, patch);
        await load();
      } catch (e) {
        notifyError("Update failed");
      }
    }
    async function decide(r, status) {
      await save(r, { status, enabled: status === "approved" });
      notifySuccess(status === "approved" ? `${r.name} is live` : `${r.name} rejected`);
    }
    function remove(r) {
      $q.dialog({ title: "Delete subject?", message: `${r.name} — matching tickets will no longer be worked automatically.`, cancel: true, ok: { label: "Delete", color: "negative" } })
        .onOk(async () => { try { await deleteAutomationSubject(r.id); await load(); } catch (e) { notifyError("Delete failed"); } });
    }

    watch(() => edit.value.all_clients, () => {});
    onMounted(load);
    return { rows, loading, saving, dialog, edit, matchText, matchError, procText, kbText, clientsText, domainsText,
      live, proposed, columns, statusColor, statusLabel, load, openNew, openEdit, submit, save, decide, remove };
  },
});
</script>

<style scoped>
.subjects-root {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
</style>
