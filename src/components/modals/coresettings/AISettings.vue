<template>
  <div>
    <div class="text-subtitle2">Pi.dev AI Assistant</div>
    <q-separator class="q-mb-sm" />

    <!-- global toggles -->
    <q-card-section class="row q-gutter-md">
      <q-checkbox
        :model-value="settings.ai_module_enabled"
        label="Enable Pi.dev module"
        @update:model-value="update('ai_module_enabled', $event)"
      />
      <q-checkbox
        :model-value="settings.ai_require_approval"
        label="Require approval for device actions"
        @update:model-value="update('ai_require_approval', $event)"
      />
      <q-checkbox
        :model-value="settings.ai_persist_history"
        label="Persist chat history per device"
        @update:model-value="update('ai_persist_history', $event)"
      />
      <q-checkbox
        :model-value="settings.ai_alerts_only_on_ticket_error"
        label="Only raise RMM alerts when a ticket can't be filed"
        @update:model-value="update('ai_alerts_only_on_ticket_error', $event)"
      >
        <q-tooltip max-width="360px">
          When on, scheduled AI tasks &amp; bulk AI commands do NOT raise a Tactical RMM
          alert on warning/alert findings (tickets are the notification channel). An RMM
          alert is raised ONLY if the AI failed to file its ticket, or the run errored.
        </q-tooltip>
      </q-checkbox>
    </q-card-section>
    <div class="text-caption text-grey q-mb-md">
      Remember to click <strong>Save</strong> below after changing these toggles.
      Providers and models are saved immediately.
    </div>

    <!-- providers -->
    <div class="row items-center q-mb-xs">
      <div class="text-subtitle2">Providers</div>
      <q-space />
      <q-btn dense flat icon="add" label="Add provider" no-caps @click="addProvider" />
    </div>
    <q-table
      :rows="providers"
      :columns="providerColumns"
      row-key="id"
      dense
      flat
      hide-bottom
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #body-cell-api_key_set="props">
        <q-td :props="props">
          <q-icon
            :name="props.row.api_key_set ? 'check_circle' : 'cancel'"
            :color="props.row.api_key_set ? 'green' : 'grey'"
          />
        </q-td>
      </template>
      <template #body-cell-enabled="props">
        <q-td :props="props">
          <q-icon
            :name="props.row.enabled ? 'check_circle' : 'cancel'"
            :color="props.row.enabled ? 'green' : 'grey'"
          />
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn dense flat size="sm" icon="edit" @click="editProvider(props.row)" />
          <q-btn dense flat size="sm" icon="delete" color="red" @click="removeProvider(props.row)" />
        </q-td>
      </template>
    </q-table>

    <!-- models -->
    <div class="row items-center q-mb-xs q-mt-lg">
      <div class="text-subtitle2">Models</div>
      <q-space />
      <q-btn dense flat icon="add" label="Add model" no-caps :disable="providers.length === 0" @click="addModel" />
    </div>
    <q-table
      :rows="models"
      :columns="modelColumns"
      row-key="id"
      dense
      flat
      hide-bottom
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #body-cell-enabled="props">
        <q-td :props="props">
          <q-icon :name="props.row.enabled ? 'check_circle' : 'cancel'" :color="props.row.enabled ? 'green' : 'grey'" />
        </q-td>
      </template>
      <template #body-cell-is_default="props">
        <q-td :props="props">
          <q-icon v-if="props.row.is_default" name="star" color="amber" />
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn dense flat size="sm" icon="edit" @click="editModel(props.row)" />
          <q-btn dense flat size="sm" icon="delete" color="red" @click="removeModel(props.row)" />
        </q-td>
      </template>
    </q-table>

    <!-- helpdesk / ticketing integration (below providers + models) -->
    <div class="row items-center q-mt-lg">
      <div class="text-subtitle2">Helpdesk / Ticketing Integration</div>
      <q-space />
      <q-btn
        dense
        no-caps
        color="primary"
        icon="smart_toy"
        label="Use AI to Help Create These"
        @click="openAssist"
      />
    </div>
    <q-separator class="q-mb-sm" />
    <div class="row q-col-gutter-sm q-mb-sm">
      <div class="col-7">
        <q-input
          :model-value="settings.ai_helpdesk_api_base_url"
          outlined
          dense
          label="Ticketing API base URL (e.g. https://erp.example.com)"
          @update:model-value="update('ai_helpdesk_api_base_url', $event)"
        />
      </div>
      <div class="col-5">
        <q-input
          :model-value="settings.ai_helpdesk_api_key"
          outlined
          dense
          type="password"
          label="Ticketing API key"
          @update:model-value="update('ai_helpdesk_api_key', $event)"
        />
      </div>
    </div>

    <div class="text-caption text-weight-medium q-mt-sm">Helpdesk Ticket Policy (prompt)</div>
    <q-input
      :model-value="settings.ai_helpdesk_prompt"
      type="textarea"
      outlined
      autogrow
      input-style="min-height: 140px"
      label="When/how the AI should ticket, and which operations to call"
      @update:model-value="update('ai_helpdesk_prompt', $event)"
    />
    <div class="text-caption text-grey q-mb-md">
      Natural-language policy: <em>when</em> to open tickets and <em>which operations</em>
      (defined by the code below) to call. Injected into every AI session and scheduled run.
    </div>

    <div class="text-caption text-weight-medium">Helpdesk Integration Code (helpdesk.js)</div>
    <q-input
      :model-value="settings.ai_helpdesk_code"
      type="textarea"
      outlined
      input-style="min-height: 220px; font-family: monospace; font-size: 12px;"
      label="JavaScript defining exports.operations for your ticketing system"
      @update:model-value="update('ai_helpdesk_code', $event)"
    />
    <div class="text-caption text-grey q-mb-md">
      Deterministic integration for <strong>any</strong> helpdesk/ERP. Define
      <code>exports.operations</code> (e.g. create_ticket, reply_to_ticket, add_note,
      submit_report, resolve_customer), plus optional <code>exports.meta</code> and
      <code>exports.mutating</code>. In scope: <code>helpdesk.baseUrl</code>,
      <code>helpdesk.apiKey</code>, <code>fetch</code>. The API key stays server-side and is
      scrubbed from anything the AI sees. The example targets Odoo/Softhealer &mdash; edit it
      for Zendesk / Freshdesk / etc. Saved with the main <strong>Save</strong> button.
    </div>

    <div class="row items-center q-mt-md">
      <div class="text-subtitle2">Ticket Automation (pilot)</div>
      <q-space />
      <q-toggle
        :model-value="settings.ai_ticket_automation_enabled"
        label="Enabled (master switch)"
        left-label
        @update:model-value="update('ai_ticket_automation_enabled', $event)"
      />
    </div>
    <div class="row justify-end q-mb-xs">
      <q-toggle
        :model-value="settings.ai_ticket_act_on_alerts"
        label="Act on alerts (cancel non-actionable, claim actionable)"
        left-label
        color="deep-orange"
        @update:model-value="update('ai_ticket_act_on_alerts', $event)"
      />
    </div>
    <q-separator class="q-mb-sm" />
    <div class="text-caption text-grey q-mb-sm">
      Autonomous ticket triage. The poller lists open tickets via the
      <code>list_open_tickets</code> operation in the integration code above (works with any
      helpdesk), applies the scope limiter, and triages each new in-scope ticket.
      <strong>Phase 1 = shadow mode:</strong> the AI only classifies and posts a staff-only
      internal note of what it <em>would</em> do &mdash; it never closes, replies, or touches devices.
    </div>

    <!-- Granular, no-JSON scope controls (these read/write ai_ticket_scope under the hood) -->
    <div class="text-caption text-weight-medium text-primary q-mt-xs">1 &middot; What the AI READS (triage scope)</div>
    <q-toggle
      :model-value="scopeBool('look_at_all_unassigned', false)"
      label="Read &amp; triage EVERY open, unassigned / bot-owned ticket"
      @update:model-value="setScopeBool('look_at_all_unassigned', $event)"
    />
    <q-select
      v-if="!scopeBool('look_at_all_unassigned', false)"
      :model-value="scopeList('work_regular_ticket_if_requester_domain_in')"
      multiple
      use-input
      use-chips
      hide-dropdown-icon
      new-value-mode="add-unique"
      outlined
      dense
      class="q-mb-xs"
      label="…otherwise only read tickets from these requester email domains (type + Enter)"
      @update:model-value="setScopeList('work_regular_ticket_if_requester_domain_in', $event)"
    />
    <q-toggle
      :model-value="scopeBool('always_look_at_alerts', true)"
      label="Always read alert tickets (regardless of the domain list)"
      @update:model-value="setScopeBool('always_look_at_alerts', $event)"
    />
    <div class="text-caption text-grey q-mb-sm">
      <strong>Reading</strong> = triage only: the AI classifies the ticket and posts an internal note
      plus a chat link. It never changes a device or emails a customer just from reading.
    </div>

    <div class="text-caption text-weight-medium text-primary">2 &middot; How the AI RECOGNIZES an alert ticket</div>
    <q-select
      :model-value="alertList('subject_starts_with')"
      multiple
      use-input
      use-chips
      hide-dropdown-icon
      new-value-mode="add-unique"
      outlined
      dense
      class="q-mb-xs"
      label="Alert subject prefixes (e.g. [Alert]) — type + Enter"
      @update:model-value="setAlertList('subject_starts_with', $event)"
    />
    <q-select
      :model-value="alertList('from_email_domains')"
      multiple
      use-input
      use-chips
      hide-dropdown-icon
      new-value-mode="add-unique"
      outlined
      dense
      class="q-mb-sm"
      label="Alert sender email domains (monitoring / backup senders)"
      @update:model-value="setAlertList('from_email_domains', $event)"
    />

    <div class="text-caption text-weight-medium text-primary">3 &middot; What the AI may ACT on (auto-manage)</div>
    <q-select
      :model-value="scopeList('auto_action_domains')"
      multiple
      use-input
      use-chips
      hide-dropdown-icon
      new-value-mode="add-unique"
      outlined
      dense
      class="q-mb-xs"
      label="Auto-action requester email domains (cancel / claim / fix / reply)"
      @update:model-value="setScopeList('auto_action_domains', $event)"
    />
    <q-select
      :model-value="scopeList('auto_action_clients')"
      multiple
      use-input
      use-chips
      hide-dropdown-icon
      new-value-mode="add-unique"
      outlined
      dense
      label="Auto-action client names (covers infra / monitoring alerts with no requester)"
      @update:model-value="setScopeList('auto_action_clients', $event)"
    />
    <div class="text-caption text-grey q-mb-sm">
      Anything NOT listed here is <strong>look-only</strong>: the AI triages it and leaves a note + a
      chat link for a human, but never auto-cancels, touches a device, or emails the customer.
      Start with one or two trusted clients.
    </div>

    <q-expansion-item dense dense-toggle icon="code" label="Advanced: raw scope JSON" class="q-mb-md">
      <q-input
        :model-value="settings.ai_ticket_scope"
        type="textarea"
        outlined
        autogrow
        input-style="min-height: 90px; font-family: monospace; font-size: 12px;"
        @update:model-value="update('ai_ticket_scope', $event)"
      />
    </q-expansion-item>

    <div class="text-caption text-weight-medium">Ticket Triage Policy (prompt)</div>
    <q-input
      :model-value="settings.ai_ticket_triage_prompt"
      type="textarea"
      outlined
      autogrow
      input-style="min-height: 120px"
      label="How to classify YOUR tickets: what's a clean alert vs actionable, what to draft"
      @update:model-value="update('ai_ticket_triage_prompt', $event)"
    />
    <div class="text-caption text-grey q-mb-md">
      Deployment-specific triage rules (stages, alert patterns, examples). Like the policy
      above, this is a prompt &mdash; adjust it on the fly for any ticketing system.
    </div>

    <div class="text-caption text-weight-medium">Decision-Chat Policy (prompt)</div>
    <q-input
      :model-value="settings.ai_ticket_decision_prompt"
      type="textarea"
      outlined
      autogrow
      input-style="min-height: 160px"
      label="How the AI behaves in the 'Johnny 5 Need Input!' decision chat (routing, completion, device-fix/email rules)"
      @update:model-value="update('ai_ticket_decision_prompt', $event)"
    />
    <div class="text-caption text-grey q-mb-md">
      Governs the ticket <strong>chat</strong> where a tech works a ticket with the AI: closing/
      routing rules, the completion policy (review + customer reply), device‑fix and email guidance.
      The dynamic bits (ticket, resolved context, per‑turn approvals) are added automatically.
      Edit freely &mdash; leave blank to use the built‑in default.
    </div>

    <!-- AI helpdesk-setup assistant -->
    <q-dialog v-model="assistDialog">
      <q-card style="min-width: 760px; max-width: 92vw">
        <q-card-section class="row items-center">
          <div class="text-subtitle1">AI Helpdesk Integration Builder</div>
          <q-space />
          <q-btn dense flat icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section style="max-height: 55vh; overflow-y: auto">
          <div v-if="assistMessages.length === 0" class="text-grey text-caption q-mb-sm">
            The AI will interview you about your helpdesk/ticketing system, then draft the
            Policy and helpdesk.js for you to review and apply. Click <strong>Send</strong>
            to start, or type what system you use.
          </div>
          <div v-for="(m, i) in assistMessages" :key="i">
            <q-chat-message
              :text="[m.text]"
              :sent="m.role === 'user'"
              :bg-color="m.role === 'user' ? 'blue-2' : 'grey-3'"
            />
            <div v-if="m.policy || m.code" class="q-gutter-xs q-mb-md">
              <q-btn
                v-if="m.policy"
                dense
                no-caps
                size="sm"
                color="teal"
                icon="check"
                label="Apply to Policy box"
                @click="applyPolicy(m.policy)"
              />
              <q-btn
                v-if="m.code"
                dense
                no-caps
                size="sm"
                color="deep-purple"
                icon="check"
                label="Apply to Code box"
                @click="applyCode(m.code)"
              />
            </div>
          </div>
          <div v-if="assistLoading" class="text-grey text-caption">
            <q-spinner-dots size="1.5em" /> thinking…
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section class="row q-gutter-sm items-center">
          <q-input
            v-model="assistInput"
            outlined
            dense
            autogrow
            class="col"
            type="textarea"
            input-style="max-height: 120px"
            placeholder="Answer the AI, or describe your helpdesk… (Enter to send)"
            @keydown.enter.exact.prevent="sendAssist"
          />
          <q-btn
            color="primary"
            icon="send"
            :loading="assistLoading"
            :disable="assistLoading"
            @click="sendAssist"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- provider dialog -->
    <q-dialog v-model="providerDialog">
      <q-card style="min-width: 400px">
        <q-card-section class="text-subtitle1">
          {{ providerForm.id ? "Edit" : "Add" }} provider
        </q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-select
            v-model="providerForm.name"
            :options="providerNameOptions"
            emit-value
            map-options
            outlined
            dense
            label="Provider"
            :disable="!!providerForm.id"
          />
          <q-input
            v-model="providerForm.api_key"
            outlined
            dense
            label="API Key"
            :placeholder="providerForm.id ? '(leave blank to keep existing)' : ''"
            type="password"
          />
          <q-input
            v-model="providerForm.base_url"
            outlined
            dense
            label="Base URL (optional, for custom/self-hosted)"
          />
          <q-checkbox v-model="providerForm.enabled" label="Enabled" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" @click="saveProviderForm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- model dialog -->
    <q-dialog v-model="modelDialog">
      <q-card style="min-width: 400px">
        <q-card-section class="text-subtitle1">
          {{ modelForm.id ? "Edit" : "Add" }} model
        </q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-select
            v-model="modelForm.provider"
            :options="providerOptions"
            emit-value
            map-options
            outlined
            dense
            label="Provider"
            @update:model-value="onProviderChange"
          />
          <q-select
            v-if="availableForProvider.length > 0"
            v-model="modelForm.model_id"
            :options="availableForProvider"
            emit-value
            map-options
            outlined
            dense
            use-input
            input-debounce="0"
            label="Model"
            :loading="loadingAvailable"
            @filter="filterAvailable"
            @update:model-value="onModelPick"
          >
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">
                  No models found for this key
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <q-input
            v-else
            v-model="modelForm.model_id"
            outlined
            dense
            :loading="loadingAvailable"
            label="Model ID (no key detected — type manually, e.g. gpt-4o)"
          />
          <q-input v-model="modelForm.display_name" outlined dense label="Display name" />
          <q-select
            v-model="modelForm.thinking_level"
            :options="['off', 'minimal', 'low', 'medium', 'high']"
            outlined
            dense
            label="Thinking level"
          />
          <q-checkbox v-model="modelForm.enabled" label="Enabled" />
          <q-checkbox v-model="modelForm.is_default" label="Default model" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" @click="saveModelForm" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import {
  fetchAIProviders,
  saveAIProvider,
  editAIProvider,
  deleteAIProvider,
  fetchAIModels,
  saveAIModel,
  editAIModel,
  deleteAIModel,
  fetchAvailableAIModels,
  helpdeskAssist,
} from "@/api/core";
import { notifySuccess, notifyError } from "@/utils/notify";

export default {
  name: "AISettings",
  props: {
    settings: { type: Object, required: true },
  },
  emits: ["update"],
  setup(props, { emit }) {
    const apiKeyPlaceholder = "{{HELPDESK_API_KEY}}";
    const providers = ref([]);

    // ---- AI helpdesk-setup assistant ----
    const assistDialog = ref(false);
    const assistMessages = ref([]);
    const assistInput = ref("");
    const assistLoading = ref(false);
    function openAssist() {
      assistDialog.value = true;
    }
    function parseProposal(reply) {
      const extract = (start, end) => {
        const i = reply.indexOf(start);
        if (i < 0) return null;
        const j = reply.indexOf(end, i + start.length);
        if (j < 0) return null;
        return reply.slice(i + start.length, j).trim();
      };
      const policy = extract("===POLICY START===", "===POLICY END===");
      const code = extract("===CODE START===", "===CODE END===");
      let text = reply
        .replace(/===POLICY START===[\s\S]*?===POLICY END===/g, "")
        .replace(/===CODE START===[\s\S]*?===CODE END===/g, "")
        .trim();
      if (!text) text = policy || code ? "(proposed updates below — review and apply)" : "";
      return { text, policy, code };
    }
    async function sendAssist() {
      if (assistLoading.value) return;
      const content =
        assistInput.value.trim() ||
        (assistMessages.value.length === 0 ? "Help me set up my helpdesk integration." : "");
      if (!content) return;
      assistMessages.value.push({ role: "user", text: content, raw: content });
      assistInput.value = "";
      assistLoading.value = true;
      try {
        const convo = assistMessages.value.map((m) => ({
          role: m.role,
          content: m.raw || m.text,
        }));
        const { reply } = await helpdeskAssist(convo);
        const parsed = parseProposal(reply || "");
        assistMessages.value.push({
          role: "assistant",
          text: parsed.text || reply || "(no response)",
          raw: reply,
          policy: parsed.policy,
          code: parsed.code,
        });
      } catch (e) {
        notifyError("Assistant request failed");
      } finally {
        assistLoading.value = false;
      }
    }
    function applyPolicy(p) {
      emit("update", { key: "ai_helpdesk_prompt", val: p });
      notifySuccess("Applied to Policy box — click Save to persist");
    }
    function applyCode(c) {
      emit("update", { key: "ai_helpdesk_code", val: c });
      notifySuccess("Applied to Code box — click Save to persist");
    }
    const models = ref([]);

    const providerColumns = [
      { name: "name", label: "Provider", field: "name", align: "left" },
      { name: "base_url", label: "Base URL", field: "base_url", align: "left" },
      { name: "api_key_set", label: "Key set", field: "api_key_set", align: "center" },
      { name: "enabled", label: "Enabled", field: "enabled", align: "center" },
      { name: "actions", label: "", field: "actions", align: "right" },
    ];
    const modelColumns = [
      { name: "display_name", label: "Name", field: "display_name", align: "left" },
      { name: "provider_name", label: "Provider", field: "provider_name", align: "left" },
      { name: "model_id", label: "Model ID", field: "model_id", align: "left" },
      { name: "thinking_level", label: "Thinking", field: "thinking_level", align: "left" },
      { name: "enabled", label: "Enabled", field: "enabled", align: "center" },
      { name: "is_default", label: "Default", field: "is_default", align: "center" },
      { name: "actions", label: "", field: "actions", align: "right" },
    ];

    const providerNameOptions = [
      { label: "Anthropic", value: "anthropic" },
      { label: "OpenAI", value: "openai" },
      { label: "Google", value: "google" },
      { label: "xAI", value: "xai" },
      { label: "OpenRouter", value: "openrouter" },
      { label: "Custom (OpenAI-compatible)", value: "custom" },
    ];

    const providerOptions = ref([]);

    // available models (from bridge, for configured keys)
    const availableModels = ref([]);
    const loadingAvailable = ref(false);
    const availableFilter = ref("");

    function providerNameById(id) {
      const p = providers.value.find((x) => x.id === id);
      return p ? p.name : null;
    }

    const availableForProvider = computed(() => {
      const pname = providerNameById(modelForm.value.provider);
      let list = availableModels.value.filter((m) => m.provider === pname);
      if (availableFilter.value) {
        const f = availableFilter.value.toLowerCase();
        list = list.filter(
          (m) =>
            m.model_id.toLowerCase().includes(f) ||
            (m.display_name || "").toLowerCase().includes(f),
        );
      }
      return list.map((m) => ({
        label: `${m.display_name} (${m.model_id})`,
        value: m.model_id,
      }));
    });

    function filterAvailable(val, update) {
      update(() => {
        availableFilter.value = val;
      });
    }

    function onProviderChange() {
      modelForm.value.model_id = "";
    }

    function onModelPick(val) {
      const pname = providerNameById(modelForm.value.provider);
      const found = availableModels.value.find(
        (m) => m.provider === pname && m.model_id === val,
      );
      if (found && !modelForm.value.display_name) {
        modelForm.value.display_name = found.display_name;
      }
    }

    async function loadAvailable() {
      loadingAvailable.value = true;
      try {
        const data = await fetchAvailableAIModels();
        availableModels.value = data.models || [];
      } catch (e) {
        availableModels.value = [];
      } finally {
        loadingAvailable.value = false;
      }
    }

    async function loadAll() {
      providers.value = await fetchAIProviders();
      models.value = await fetchAIModels();
      providerOptions.value = providers.value.map((p) => ({
        label: p.name,
        value: p.id,
      }));
      loadAvailable();
    }

    function update(key, val) {
      emit("update", { key, val });
    }

    // ---- Friendly ticket-scope controls (read/write the ai_ticket_scope JSON) ----
    function parseScope() {
      try {
        return JSON.parse(props.settings.ai_ticket_scope || "{}") || {};
      } catch {
        return {};
      }
    }
    function writeScope(obj) {
      update("ai_ticket_scope", JSON.stringify(obj, null, 2));
    }
    function cleanList(v) {
      return (v || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    }
    function scopeBool(key, dflt) {
      const v = parseScope()[key];
      return v === undefined ? dflt : !!v;
    }
    function setScopeBool(key, val) {
      const o = parseScope();
      o[key] = !!val;
      writeScope(o);
    }
    function scopeList(key) {
      const v = parseScope()[key];
      return Array.isArray(v) ? v : [];
    }
    function setScopeList(key, val) {
      const o = parseScope();
      o[key] = key === "auto_action_clients" ? (val || []).map((s) => String(s).trim()).filter(Boolean) : cleanList(val);
      writeScope(o);
    }
    function alertList(sub) {
      const m = parseScope().alert_ticket_match || {};
      return Array.isArray(m[sub]) ? m[sub] : [];
    }
    function setAlertList(sub, val) {
      const o = parseScope();
      o.alert_ticket_match = o.alert_ticket_match || {};
      o.alert_ticket_match[sub] = sub === "subject_starts_with"
        ? (val || []).map((s) => String(s).trim()).filter(Boolean)
        : cleanList(val);
      writeScope(o);
    }

    // provider dialog
    const providerDialog = ref(false);
    const providerForm = ref({});
    function addProvider() {
      providerForm.value = { name: "anthropic", api_key: "", base_url: "", enabled: true };
      providerDialog.value = true;
    }
    function editProvider(row) {
      providerForm.value = { id: row.id, name: row.name, api_key: "", base_url: row.base_url, enabled: row.enabled };
      providerDialog.value = true;
    }
    async function saveProviderForm() {
      try {
        const f = providerForm.value;
        if (f.id) await editAIProvider(f.id, f);
        else await saveAIProvider(f);
        notifySuccess("Provider saved");
        providerDialog.value = false;
        await loadAll();
      } catch (e) {
        notifyError(e?.response?.data || "Failed to save provider");
      }
    }
    async function removeProvider(row) {
      try {
        await deleteAIProvider(row.id);
        await loadAll();
      } catch (e) {
        notifyError("Failed to delete provider");
      }
    }

    // model dialog
    const modelDialog = ref(false);
    const modelForm = ref({});
    function addModel() {
      modelForm.value = {
        provider: providerOptions.value[0]?.value,
        model_id: "",
        display_name: "",
        thinking_level: "medium",
        enabled: true,
        is_default: false,
      };
      modelDialog.value = true;
    }
    function editModel(row) {
      modelForm.value = { ...row };
      modelDialog.value = true;
    }
    async function saveModelForm() {
      try {
        const f = modelForm.value;
        if (f.id) await editAIModel(f.id, f);
        else await saveAIModel(f);
        notifySuccess("Model saved");
        modelDialog.value = false;
        await loadAll();
      } catch (e) {
        notifyError(e?.response?.data || "Failed to save model");
      }
    }
    async function removeModel(row) {
      try {
        await deleteAIModel(row.id);
        await loadAll();
      } catch (e) {
        notifyError("Failed to delete model");
      }
    }

    onMounted(loadAll);

    return {
      apiKeyPlaceholder,
      assistDialog,
      assistMessages,
      assistInput,
      assistLoading,
      openAssist,
      sendAssist,
      applyPolicy,
      applyCode,
      providers,
      models,
      providerColumns,
      modelColumns,
      providerNameOptions,
      providerOptions,
      availableForProvider,
      loadingAvailable,
      filterAvailable,
      onProviderChange,
      onModelPick,
      update,
      scopeBool,
      setScopeBool,
      scopeList,
      setScopeList,
      alertList,
      setAlertList,
      providerDialog,
      providerForm,
      addProvider,
      editProvider,
      saveProviderForm,
      removeProvider,
      modelDialog,
      modelForm,
      addModel,
      editModel,
      saveModelForm,
      removeModel,
    };
  },
};
</script>
