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
    </q-card-section>
    <div class="text-caption text-grey q-mb-md">
      Remember to click <strong>Save</strong> below after changing these toggles.
      Providers and models are saved immediately.
    </div>

    <!-- helpdesk ticket policy prompt -->
    <div class="text-subtitle2 q-mt-md">Helpdesk Ticket Policy</div>
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
    <q-input
      :model-value="settings.ai_helpdesk_prompt"
      type="textarea"
      outlined
      autogrow
      input-style="min-height: 120px"
      label="Helpdesk prompt (injected into every AI session and scheduled run)"
      placeholder="Document BOTH when to open tickets AND how: the exact API calls (endpoints, payloads) the AI must make via the helpdesk_api_request tool. Write {{HELPDESK_API_KEY}} wherever the key belongs in request bodies."
      @update:model-value="update('ai_helpdesk_prompt', $event)"
    />
    <div class="text-caption text-grey q-mb-md">
      This text fully defines the ticketing integration: <em>when</em> to open tickets and
      <em>how</em> (the exact API flow), executed via the generic
      <code>helpdesk_api_request</code> tool against the base URL above. The API key is
      substituted server-side for <code>{{ apiKeyPlaceholder }}</code> in request bodies and is
      never placed in the AI's context. Requests can only go to the configured base URL.
      Switching ticketing systems = change URL, key and this text. Saved with the main
      <strong>Save</strong> button.
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
