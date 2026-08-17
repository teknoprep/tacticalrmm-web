<template>
  <div class="pichat bg-grey-10 text-white">
    <!-- toolbar -->
    <q-toolbar class="bg-grey-9 text-white q-px-sm">
      <q-icon name="smart_toy" size="sm" class="q-mr-sm" />
      <div class="column">
        <div class="text-subtitle2">
          Pi.dev &mdash; {{ hostname || (isMulti ? "multi-machine" : agentId) }}
        </div>
        <div class="text-caption text-grey-5">
          {{ clientSite }}
        </div>
      </div>
      <q-space />
      <!-- SESSION LABEL. The technician's own name for this conversation, so AI History
           can be searched by what the work WAS. The generated name ("Chat about PBX3")
           and the last-message snippet are enough to find a session from ten minutes ago
           and useless for finding the one from Tuesday. Saved on blur/Enter, not on every
           keystroke, so typing does not chatter over the socket. -->
      <q-input
        v-model="sessionLabel"
        dense
        dark
        outlined
        clearable
        placeholder="Label this chat"
        class="q-mr-sm"
        style="min-width: 190px; max-width: 260px"
        :maxlength="120"
        data-test="ai-session-label"
        @blur="sendLabel"
        @keyup.enter="sendLabel"
        @clear="sendLabel"
      >
        <template #prepend>
          <q-icon name="label" size="xs" />
        </template>
        <q-tooltip>
          Your own name for this conversation (e.g. "ACD clone UI", "Jeremy archive").
          It shows in the AI History tab and in this window's title, so you can find
          this chat later. Saved when you press Enter or click away; clear it to go
          back to the generated name.
        </q-tooltip>
      </q-input>
      <!-- Running cost meter. Rendered only when the role carries can_view_ai_cost
           (or superuser); the server withholds the data entirely otherwise. -->
      <q-chip
        v-if="costVisible"
        dense
        square
        :color="costColor"
        text-color="white"
        icon="payments"
        class="q-mr-sm"
        data-test="ai-cost-meter"
      >
        <span v-if="pricingKnown">{{ fmtMoney(sessionCost) }}</span>
        <span v-else>&mdash;</span>
        <span v-if="contextWindow" class="q-ml-xs text-caption">
          &middot; {{ contextPct }}%
        </span>
        <q-tooltip anchor="bottom middle" self="top middle" max-width="420px">
          <div class="text-weight-bold q-mb-xs">This conversation</div>
          <div v-if="!pricingKnown" class="text-orange-4 q-mb-xs">
            One of the models in use has no published pricing, so cost cannot be
            calculated. Totals below are incomplete.
          </div>
          <div>
            Total: <b>{{ fmtMoney(sessionCost) }}</b>
            &middot; {{ costTurns }} turns
            &middot; <b>{{ fmtMoney(costPerTurn) }}/turn</b>
          </div>
          <div>Last turn: {{ fmtMoney(lastTurnCost) }}</div>

          <!-- Where the money went. cacheWrite/cacheRead usually dominate, which is
               invisible in a single total. -->
          <template v-if="costSpend">
            <div class="text-weight-bold q-mt-sm">Where it went</div>
            <div>Cache write: {{ fmtMoney(costSpend.cacheWrite) }}</div>
            <div>Cache read: {{ fmtMoney(costSpend.cacheRead) }}</div>
            <div>Output: {{ fmtMoney(costSpend.output) }}</div>
            <div>Input: {{ fmtMoney(costSpend.input) }}</div>
          </template>

          <template v-if="costByModel.length > 1">
            <div class="text-weight-bold q-mt-sm">By model</div>
            <div v-for="bm in costByModel" :key="bm.model">
              {{ bm.model }} &middot; {{ bm.turns }} turns &middot;
              {{ fmtMoney(bm.cost) }} ({{ fmtMoney(bm.cost_per_turn) }}/turn)
            </div>
            <div v-if="modelSwitches > 0" class="text-orange-4 q-mt-xs">
              {{ modelSwitches }} model switch{{ modelSwitches === 1 ? "" : "es" }} &mdash;
              {{ fmtMoney(switchSpend) }} of that was re-caching this conversation into
              another model. Prefer a new chat over switching mid-conversation.
            </div>
          </template>

          <div class="text-weight-bold q-mt-sm">Tokens</div>
          <div>
            in {{ fmtTokens(costTokens.input) }} &middot; out
            {{ fmtTokens(costTokens.output) }} &middot; cache-read
            {{ fmtTokens(costTokens.cacheRead) }} &middot; cache-write
            {{ fmtTokens(costTokens.cacheWrite) }}
          </div>
          <div v-if="contextWindow">
            Context: {{ fmtTokens(contextTokens) }} / {{ fmtTokens(contextWindow) }}
            ({{ contextPct }}%)
          </div>
          <div v-if="contextPct >= 80" class="text-orange-4 q-mt-xs">
            Context is nearly full &mdash; start a new chat soon.
          </div>
        </q-tooltip>
      </q-chip>
      <q-btn
        v-if="!isDecision"
        flat
        dense
        no-caps
        icon="lan"
        :label="isMulti ? 'Machines' : 'Multi-machine'"
        class="q-mr-sm"
        @click="openMachinesDialog"
      >
        <q-tooltip>
          Work on several machines in one conversation (e.g. cluster two
          Proxmox nodes, or pair a Proxmox server with its Backup Server)
        </q-tooltip>
      </q-btn>
      <q-select
        v-model="selectedModel"
        :options="modelOptions"
        emit-value
        map-options
        dense
        dark
        options-dense
        outlined
        style="min-width: 200px"
        label="Model"
        class="q-mr-sm"
        @update:model-value="onModelChange"
      />
      <q-toggle
        v-if="autoapproveAllowed"
        v-model="autoApprove"
        dense
        color="orange"
        label="Auto-approve"
        class="q-mr-sm"
        @update:model-value="sendAutoApprove"
      />
      <q-toggle
        v-if="isDecision && autocredentialAllowed"
        v-model="autoCredential"
        dense
        color="purple"
        label="Auto-credential"
        class="q-mr-sm"
        @update:model-value="sendAutoCredential"
      >
        <q-tooltip>
          Let Pi look up a stored IT Notebook login (username/password) for this
          customer without stopping to ask you each time. Separate from Auto-approve
          on purpose. PRIVILEGED rows still ask you every time, and every automatic
          lookup is written to the audit log.
        </q-tooltip>
      </q-toggle>
      <q-toggle
        v-if="isDecision"
        v-model="allowEmail"
        dense
        color="teal"
        label="Allow customer email"
        class="q-mr-sm"
        @update:model-value="sendAllowEmail"
      >
        <q-tooltip>Let Pi send replies to the customer on this ticket. Off = drafts only.</q-tooltip>
      </q-toggle>
      <q-btn
        v-if="!isDecision"
        flat
        dense
        no-caps
        icon="add"
        label="New chat"
        class="q-mr-sm"
        @click="startNewChat"
      />
      <!-- toggle when the role can write; static badge when it can't -->
      <q-toggle
        v-if="mutateAllowed"
        :model-value="!readOnly"
        dense
        color="deep-orange"
        :label="readOnly ? 'Read-only (devices)' : 'Write mode (devices)'"
        class="q-mr-sm"
        @update:model-value="(v) => setReadonly(!v)"
      >
        <q-tooltip>
          Read-only gathers info and proposes fixes without changing the DEVICES in
          this session. Switch to Write mode to let Pi apply changes on the machines.
          Ticket actions (reply to the customer, internal note, create a ticket, KB)
          do not need Write mode — they are approved per call.
        </q-tooltip>
      </q-toggle>
      <q-badge
        v-else-if="readOnly"
        color="blue-grey"
        label="read-only (devices)"
        class="q-mr-sm"
      >
        <q-tooltip>
          This session can only inspect devices. DEVICE changes require an account
          with AI write (mutate) rights. Ticket actions (reply, note, create, KB) are
          unaffected and still available, with approval.
        </q-tooltip>
      </q-badge>
      <q-btn
        flat
        round
        dense
        :icon="soundEnabled || desktopEnabled ? 'notifications_active' : 'notifications_off'"
        class="q-mr-sm"
        aria-label="AI completion alerts"
        @click="primeCompletionAudio"
      >
        <q-tooltip>AI sound &amp; desktop alerts</q-tooltip>
        <q-menu dark>
          <div class="q-pa-md" style="width: 320px; max-width: 90vw">
            <div class="text-subtitle2 q-mb-sm">AI sound &amp; desktop alerts</div>
            <q-toggle
              :model-value="soundEnabled"
              color="primary"
              label="Sounds: ding when done, bong when approval needed"
              @update:model-value="setSoundAlert"
            />
            <q-toggle
              :model-value="desktopEnabled"
              :disable="!notificationSupported || notificationPermission === 'denied'"
              color="primary"
              label="Show a desktop notification"
              @update:model-value="setDesktopNotifications"
            />
            <q-toggle
              v-model="onlyWhenUnfocused"
              :disable="!desktopEnabled"
              color="primary"
              label="Desktop notification only when unfocused"
            />
            <div class="text-caption text-grey-5 q-mt-xs">
              {{ desktopStatus }}
            </div>
            <q-separator dark class="q-my-sm" />
            <q-btn
              outline
              dense
              no-caps
              icon="notifications"
              label="Test alerts"
              @click="testCompletionAlerts"
            />
          </div>
        </q-menu>
      </q-btn>
      <q-badge
        :color="connected ? 'green' : 'red'"
        :label="connected ? 'connected' : 'disconnected'"
      />
    </q-toolbar>

    <!-- messages -->
    <div ref="scrollArea" class="pi-messages q-pa-md">
      <div v-for="(msg, i) in messages" :key="i" class="q-mb-md">
        <!-- user -->
        <div v-if="msg.role === 'user'" class="row justify-end">
          <!-- pi-text carries `white-space: pre-wrap`. Without it the browser collapses every
               run of whitespace and drops newlines, so anything pasted in - a log extract, a
               command, a list, an indented block - rendered as one unreadable paragraph the
               instant it was sent, even though it looked right in the textarea. The assistant
               bubble always had it; the user's own message did not. -->
          <div class="pi-bubble pi-user pi-text">{{ msg.text }}</div>
        </div>
        <!-- assistant -->
        <div v-else-if="msg.role === 'assistant'" class="row justify-start">
          <div class="pi-bubble pi-assistant">
            <div v-if="msg.text" class="pi-text">{{ msg.text }}</div>
            <!-- tool cards -->
            <div
              v-for="(tool, ti) in msg.tools"
              :key="ti"
              class="pi-tool q-mt-sm"
            >
              <div class="row items-center">
                <q-icon
                  :name="tool.isError ? 'error' : tool.done ? 'check_circle' : 'play_circle'"
                  :color="tool.isError ? 'red' : tool.done ? 'green' : 'blue'"
                  size="xs"
                  class="q-mr-xs"
                />
                <span class="text-weight-medium">{{ tool.name }}</span>
              </div>
              <pre v-if="tool.args" class="pi-args">{{ tool.args }}</pre>
              <pre v-if="tool.result" class="pi-result">{{ tool.result }}</pre>
            </div>
          </div>
        </div>
        <!-- system/info -->
        <div v-else class="row justify-center">
          <div class="text-caption text-grey-5 pi-text">{{ msg.text }}</div>
        </div>
      </div>
      <div v-if="streaming" class="row items-center q-gutter-xs q-mt-xs">
        <q-spinner-dots color="primary" />
        <span class="text-caption" :class="stalled ? 'text-orange' : 'text-grey-5'">
          {{ workingText }}
        </span>
        <q-btn
          v-if="stalled"
          dense
          flat
          size="sm"
          color="negative"
          icon="stop"
          label="Stop"
          no-caps
          @click="abort"
        />
      </div>
    </div>

    <!-- multi-machine setup dialog -->
    <q-dialog v-model="machinesDialog">
      <q-card dark class="bg-grey-9" style="width: 700px; max-width: 95vw">
        <q-card-section class="row items-center q-pb-none">
          <q-icon name="lan" size="sm" class="q-mr-sm" />
          <div class="text-h6">Multi-machine mode</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section>
          <div class="text-caption text-grey-5 q-mb-md">
            Pick the machines for this session and tell Pi what each one is,
            so it knows which machine each step belongs on &mdash; e.g.
            "primary Proxmox node", "second cluster node", "Proxmox Backup
            Server".
          </div>
          <div
            v-for="(row, i) in machineRows"
            :key="i"
            class="row q-col-gutter-sm items-start q-mb-sm"
          >
            <div class="col-5">
              <tactical-dropdown
                v-model="row.agent_id"
                :options="agentOptions"
                label="Machine"
                outlined
                dense
                dark
                mapOptions
                filterable
              />
            </div>
            <div class="col-6">
              <q-input
                v-model="row.role"
                dense
                dark
                outlined
                label="What is this machine? (its role in the job)"
                maxlength="400"
              />
            </div>
            <div class="col-1 row justify-center">
              <q-btn
                flat
                dense
                round
                icon="remove"
                color="red"
                :disable="machineRows.length <= 1"
                @click="removeMachineRow(i)"
              >
                <q-tooltip>Remove this machine</q-tooltip>
              </q-btn>
            </div>
          </div>
          <q-btn
            flat
            dense
            no-caps
            icon="add"
            label="Add machine"
            color="primary"
            :disable="machineRows.length >= 8"
            @click="addMachineRow"
          />
          <div v-if="machinesError" class="text-caption text-red q-mt-sm">
            {{ machinesError }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            no-caps
            :label="isMulti ? 'Apply machines (new chat)' : 'Start multi-machine chat'"
            @click="launchMulti"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- connection lost banner -->
    <q-banner v-if="connectionLost" class="bg-red-9 text-white">
      <template #avatar><q-icon name="wifi_off" /></template>
      Connection to the assistant was lost.
      <template #action>
        <q-btn flat label="Reconnect" @click="reconnect" />
      </template>
    </q-banner>

    <!-- approval banner (queued: parallel/multi-machine turns can raise several) -->
    <q-banner v-if="pendingApproval" class="bg-orange-9 text-white">
      <template #avatar><q-icon name="warning" /></template>
      <span v-if="approvalQueue.length > 1" class="text-weight-bold q-mr-xs">
        ({{ approvalQueue.length }} pending)
      </span>
      Pi wants to run: <strong>{{ pendingApproval.summary }}</strong>
      <template #action>
        <q-btn
          v-if="approvalQueue.length > 1"
          flat
          label="Approve all"
          @click="respondApprovalAll(true)"
        />
        <q-btn flat label="Deny" @click="respondApproval(false)" />
        <q-btn
          flat
          color="white"
          label="Approve"
          @click="respondApproval(true)"
        />
      </template>
    </q-banner>

    <!-- input -->
    <div class="bg-grey-9 q-pa-sm row items-end">
      <q-input
        v-model="input"
        type="textarea"
        autogrow
        dark
        dense
        outlined
        :placeholder="isMulti
          ? 'Tell Pi what to do across these machines...'
          : 'Ask about this device, or tell Pi what to do...'"
        class="col"
        :disable="!connected"
        @keydown.enter.exact.prevent="send"
      />
      <q-btn
        v-if="!streaming"
        color="primary"
        icon="send"
        class="q-ml-sm"
        :disable="!connected || !input.trim()"
        @click="send"
      />
      <q-btn
        v-else
        color="negative"
        icon="stop"
        label="Stop"
        no-caps
        class="q-ml-sm"
        @click="abort"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getBaseUrl } from "@/boot/axios";
import {
  createPiSession,
  saveAIAutoApprove,
  saveAIAutoCredential,
  createPiMultiSession,
  decodePiMachines,
  encodePiMachines,
} from "@/api/agents";
import { fetchAITaskRunLive, createDecisionSession } from "@/api/core";
import { useAgentDropdown } from "@/composables/agents";
import { useAICompletionAlerts } from "@/composables/aiCompletionAlerts";
import { notifyError } from "@/utils/notify";
import TacticalDropdown from "@/components/ui/TacticalDropdown.vue";

export default {
  name: "PiChat",
  components: { TacticalDropdown },
  setup() {
    const route = useRoute();
    const router = useRouter();
    // Decision (ticket) chat reuses this exact component; it just mints its session
    // from the decision endpoint instead of an agent.
    const decisionToken = route.params.token || null;
    const isDecision = !!decisionToken;
    const agentId = route.params.agent_id;
    const isMulti = agentId === "multi";
    const {
      soundEnabled,
      desktopEnabled,
      onlyWhenUnfocused,
      notificationSupported,
      notificationPermission,
      desktopStatus,
      primeAudio: primeCompletionAudio,
      setDesktopEnabled,
      finished: announceCompletion,
      needsApproval: announceApprovalNeeded,
      test: testCompletionAlerts,
    } = useAICompletionAlerts();

    function setSoundAlert(value) {
      soundEnabled.value = !!value;
      if (soundEnabled.value) primeCompletionAudio();
    }

    async function setDesktopNotifications(value) {
      const enabled = await setDesktopEnabled(value);
      if (value && !enabled) {
        notifyError(
          "Desktop notifications could not be enabled. Check this site's browser notification permission.",
          5000,
        );
      }
    }

    // machines for a multi session, decoded from the ?m= query param
    let multiMachines = [];
    if (isMulti) {
      try {
        multiMachines = decodePiMachines(route.query.m || "");
      } catch (e) {
        multiMachines = [];
      }
    }

    const hostname = ref("");
    const clientSite = ref("");
    const connected = ref(false);
    const streaming = ref(false);
    const messages = ref([]);
    const input = ref("");
    const modelOptions = ref([]);
    const selectedModel = ref(null);
    const autoApprove = ref(false);
    const autoapproveAllowed = ref(false);
    // --- live cost meter -----------------------------------------------------
    // Only populated when the server says this operator's role may see spend
    // (can_view_ai_cost, or superuser). The bridge sends nothing otherwise, so an
    // unprivileged operator cannot infer cost from traffic either.
    const costVisible = ref(false);
    const sessionCost = ref(0);
    const lastTurnCost = ref(0);
    const costTurns = ref(0);
    const contextTokens = ref(0);
    const contextWindow = ref(0);
    const costTokens = ref({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 });
    // Dollar split per token class + per model. This is what explains a bill: one real
    // session spent $2.25 on cacheWrite and $1.73 on cacheRead to deliver $0.61 of output.
    const costSpend = ref(null);
    const costPerTurn = ref(0);
    const costByModel = ref([]);
    const modelSwitches = ref(0);
    const switchSpend = ref(0);
    const pricingKnown = ref(true);
    const contextPct = computed(() =>
      contextWindow.value > 0
        ? Math.min(100, Math.round((contextTokens.value / contextWindow.value) * 100))
        : 0,
    );
    // Green while cheap, amber past $1, red past $5 - matches the bridge's warn bands.
    const costColor = computed(() =>
      sessionCost.value >= 5 ? "red-5" : sessionCost.value >= 1 ? "orange-5" : "green-5",
    );
    const fmtMoney = (n) =>
      `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtTokens = (n) => {
      const v = Number(n || 0);
      if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
      if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
      return String(v);
    };
    const readOnly = ref(false);
    const allowEmail = ref(true);
    function sendAllowEmail(val) {
      if (ws && connected.value) ws.send(JSON.stringify({ type: "set_allow_email", value: !!val }));
    }
    // Auto-credential: shown only when the role carries the permission, and re-checked
    // server-side on every toggle and every credential read.
    const autocredentialAllowed = ref(false);
    const autoCredential = ref(false);
    // Technician's own name for this conversation. Mirrored into the window title so a
    // desktop full of Pi popups is navigable, and into AI History so it is findable later.
    const sessionLabel = ref("");
    let lastSentLabel = "";
    function sendLabel() {
      const val = (sessionLabel.value || "").replace(/\s+/g, " ").trim().slice(0, 120);
      sessionLabel.value = val;
      // Only talk to the server when it actually changed: blur fires on every click away.
      if (val === lastSentLabel) return;
      lastSentLabel = val;
      if (ws && connected.value) ws.send(JSON.stringify({ type: "set_label", value: val }));
      applyWindowTitle();
    }
    function applyWindowTitle() {
      const who = hostname.value || (isMulti ? "multi-machine" : agentId || "");
      const base = `Pi.dev - ${who}`;
      try {
        document.title = sessionLabel.value ? `${sessionLabel.value} - ${base}` : base;
      } catch (e) { /* title is a nicety, never a failure */ }
    }
    const mutateAllowed = ref(false);
    const resolveRun = route.query.resolve_run || null;
    let resolveSeeded = false;
    function setReadonly(val) {
      if (ws && connected.value) {
        ws.send(JSON.stringify({ type: "set_readonly", value: !!val }));
      }
    }
    // For an "AI Resolve" session: once ready, pull the run's finding and send a
    // seed prompt asking for read-only fix OPTIONS.
    async function maybeSeedResolve() {
      if (!resolveRun || resolveSeeded) return;
      resolveSeeded = true;
      let finding = "";
      try {
        const data = await fetchAITaskRunLive(resolveRun);
        const r = data?.run || {};
        finding =
          `Summary: ${r.summary || "(none)"}\n\n` +
          `Details / transcript:\n${(r.output || "").slice(0, 8000)}`;
      } catch (e) {
        finding = "(could not load the original finding)";
      }
      const seed =
        "A scheduled AI check on this device reported an issue. DO NOT change " +
        "anything on the device right now — this is a read-only diagnostic. " +
        "Investigate read-only as needed, then give me a few concrete OPTIONS to " +
        "fix it, each with exact steps and pros/cons, so I can choose. " +
        "If you need to apply a fix, tell me and I'll enable write mode.\n\n" +
        "=== FINDING ===\n" +
        finding;
      if (!connected.value) return;
      messages.value.push({ role: "user", text: seed });
      currentIdx = -1;
      streaming.value = true;
      streamStartAt.value = Date.now();
      markActivity();
      ws.send(JSON.stringify({ type: "prompt", message: seed }));
      scrollToBottom();
    }
    // Queue of approval requests. A single turn (especially multi-machine) can
    // fire several gated tool calls in parallel; the bridge sends one
    // approval_request per call, so we must queue them, not overwrite - else
    // the un-shown ones hang forever waiting on approval.
    const approvalQueue = ref([]);
    const pendingApproval = computed(() => approvalQueue.value[0] || null);
    const scrollArea = ref(null);
    const connectionLost = ref(false);

    let ws = null;
    let currentIdx = -1; // index into messages.value for the streaming assistant msg
    let curSessionId = null;

    // --- working/stall watchdog ---------------------------------------------
    const streamStartAt = ref(0);
    const lastActivityAt = ref(0);
    const nowTick = ref(Date.now());
    let tickTimer = null;
    function markActivity() {
      lastActivityAt.value = Date.now();
    }
    const elapsedSec = computed(() =>
      streaming.value && streamStartAt.value
        ? Math.floor((nowTick.value - streamStartAt.value) / 1000)
        : 0,
    );
    const staleSec = computed(() =>
      streaming.value && lastActivityAt.value
        ? Math.floor((nowTick.value - lastActivityAt.value) / 1000)
        : 0,
    );
    // "stalled" = no events at all for 45s while supposedly working
    const stalled = computed(() => staleSec.value >= 45);
    const workingText = computed(() => {
      if (stalled.value)
        return `No response for ${staleSec.value}s — it may be stuck or the provider/device is slow. You can keep waiting or Stop.`;
      return `working… (${elapsedSec.value}s)`;
    });

    function wsBase() {
      const base = getBaseUrl(); // https://api.example.com
      return base.replace(/^http/, "ws");
    }

    async function scrollToBottom() {
      await nextTick();
      const el = scrollArea.value;
      if (el) el.scrollTop = el.scrollHeight;
    }

    // Always return the reactive proxy element (mutating it triggers re-render).
    function ensureAssistant() {
      if (currentIdx < 0 || messages.value[currentIdx]?.done !== false) {
        messages.value.push({ role: "assistant", text: "", tools: [], done: false });
        currentIdx = messages.value.length - 1;
      }
      return messages.value[currentIdx];
    }

    function handleAgentEvent(e) {
      switch (e.type) {
        case "message_start":
          if (e.message?.role === "assistant") {
            messages.value.push({ role: "assistant", text: "", tools: [], done: false });
            currentIdx = messages.value.length - 1;
          }
          break;
        case "message_update": {
          const ev = e.assistantMessageEvent;
          if (!ev) break;
          if (ev.type === "text_delta") {
            const a = ensureAssistant();
            a.text += ev.delta;
            scrollToBottom();
          }
          break;
        }
        case "tool_execution_start": {
          const a = ensureAssistant();
          a.tools.push({
            id: e.toolCallId,
            name: e.toolName,
            args: e.args ? JSON.stringify(e.args, null, 2) : "",
            result: "",
            done: false,
            isError: false,
          });
          scrollToBottom();
          break;
        }
        case "tool_execution_end": {
          const a = currentIdx >= 0 ? messages.value[currentIdx] : null;
          if (a) {
            const t = a.tools.find((x) => x.id === e.toolCallId);
            if (t) {
              t.done = true;
              t.isError = !!e.isError;
              const txt = (e.result?.content || [])
                .filter((c) => c.type === "text")
                .map((c) => c.text)
                .join("\n");
              t.result = txt.length > 4000 ? txt.slice(0, 4000) + "\n...(truncated)" : txt;
            }
          }
          scrollToBottom();
          break;
        }
        case "agent_end": {
          // Only announce a turn that was genuinely in progress. This suppresses
          // reconnect/history hydration, duplicate agent_end events, and an
          // agent_end that arrives after the operator pressed Stop.
          const completedActiveTurn = streaming.value;
          if (currentIdx >= 0 && messages.value[currentIdx]) {
            messages.value[currentIdx].done = true;
          }
          streaming.value = false;
          scrollToBottom();
          if (completedActiveTurn) {
            announceCompletion({
              kind: isDecision ? "decision" : "chat",
              hostname: hostname.value,
              key: `${curSessionId || "session"}:${streamStartAt.value}`,
            });
          }
          break;
        }
        case "agent_start":
          streaming.value = true;
          streamStartAt.value = Date.now();
          markActivity();
          break;
        case "auto_retry_start":
          messages.value.push({
            role: "system",
            text: `Provider was busy; retrying (attempt ${e.attempt}/${e.maxAttempts})…`,
          });
          markActivity();
          scrollToBottom();
          break;
        case "auto_retry_end":
          markActivity();
          break;
      }
    }

    function connect({ model_id, resume } = {}) {
      // close any existing
      if (ws) {
        try { ws.close(); } catch (e) { /* noop */ }
        ws = null;
      }
      const create = isDecision
        ? createDecisionSession(decisionToken, { ...(model_id ? { model_id } : {}) })
        : isMulti
        ? createPiMultiSession({
            machines: multiMachines,
            ...(model_id ? { model_id } : {}),
            ...(resume ? { resume_session: resume } : {}),
          })
        : createPiSession(agentId, {
            ...(model_id ? { model_id } : {}),
            ...(resume ? { resume_session: resume } : {}),
            ...(resolveRun ? { read_only: true } : {}),
          });
      create
        .then((data) => {
          hostname.value = data.hostname;
          clientSite.value = `${data.client} / ${data.site}`;
          modelOptions.value = (data.allowed_models || []).map((m) => ({
            label: m.display_name,
            value: m.model_id,
          }));
          selectedModel.value = data.model_id;
          autoapproveAllowed.value = !!data.autoapprove_allowed;
          // The server remembers the operator's Auto-approve choice; render THAT rather
          // than defaulting to off, or a refresh looks like the setting silently died.
          if (data.auto_approve !== undefined) autoApprove.value = !!data.auto_approve;
          autocredentialAllowed.value = !!data.autocredential_allowed;
          if (data.auto_credential !== undefined) autoCredential.value = !!data.auto_credential;

          const url = `${wsBase()}/pi/ws/${data.token}/`;
          ws = new WebSocket(url);
          ws.onopen = () => {
            connected.value = true;
            connectionLost.value = false;
          };
          ws.onclose = () => {
            connected.value = false;
            // if we were mid-response, surface it instead of silently stopping
            if (streaming.value) {
              connectionLost.value = true;
              messages.value.push({
                role: "system",
                text: "⚠ Connection lost while the assistant was working. Click Reconnect to resume this conversation.",
              });
            }
            streaming.value = false;
          };
          ws.onerror = () => {
            connected.value = false;
          };
          ws.onmessage = (evt) => {
            let m;
            try { m = JSON.parse(evt.data); } catch (e) { return; }
            markActivity();
            if (m.type === "ready") {
              if (m.auto_approve !== undefined) autoApprove.value = !!m.auto_approve;
              curSessionId = m.session_id || curSessionId;
              readOnly.value = !!m.read_only;
              if (m.allow_email !== undefined) allowEmail.value = !!m.allow_email;
              if (m.autocredential_allowed !== undefined) autocredentialAllowed.value = !!m.autocredential_allowed;
              if (m.auto_credential !== undefined) autoCredential.value = !!m.auto_credential;
              // A resumed chat keeps the label it was given, so "Continue" from AI History
              // lands in a window that still knows what it is.
              if (m.label !== undefined) {
                sessionLabel.value = String(m.label || "");
                lastSentLabel = sessionLabel.value;
              }
              applyWindowTitle();
              mutateAllowed.value = !!m.mutate_allowed;
              costVisible.value = !!m.cost_visible;
              contextWindow.value = Number(m.context_window || 0);
              if (m.operator_enabled && Array.isArray(m.operator_machines) && m.operator_machines.length) {
                const names = m.operator_machines.map((x) => x.hostname || x.agent_id).filter(Boolean).join(", ");
                messages.value.push({
                  role: "system",
                  text: `Desktop Operator available on: ${names}. Just tell me what to open/click/fill on that workstation (no passwords, no save/delete).`,
                });
              }
              maybeSeedResolve();
              // hydrate history — reconstruct the full transcript INCLUDING the
              // command window (tool calls + their output), not just the text
              // typed by the user and assistant. toolCall blocks live on the
              // assistant message; their output arrives as separate
              // {role:"toolResult", toolCallId, ...} messages that we match back.
              messages.value = [];
              currentIdx = -1;
              const toolById = {};
              (m.history || []).forEach((hm) => {
                if (hm.role === "user") {
                  const txt = typeof hm.content === "string"
                    ? hm.content
                    : (hm.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
                  if (txt) messages.value.push({ role: "user", text: txt });
                } else if (hm.role === "assistant") {
                  const content = Array.isArray(hm.content) ? hm.content : [];
                  const txt = content.filter((c) => c.type === "text").map((c) => c.text).join("");
                  const tools = content
                    .filter((c) => c.type === "toolCall")
                    .map((c) => {
                      const tool = {
                        id: c.id,
                        name: c.name,
                        args: c.arguments ? JSON.stringify(c.arguments, null, 2) : "",
                        result: "",
                        done: true,
                        isError: false,
                      };
                      toolById[c.id] = tool;
                      return tool;
                    });
                  if (txt || tools.length) {
                    messages.value.push({ role: "assistant", text: txt, tools, done: true });
                  }
                } else if (hm.role === "system") {
                  // e.g. the "earlier turns were summarised" divider the bridge inserts
                  // at a compaction point, so a resumed chat explains its own gap.
                  const txt = typeof hm.content === "string"
                    ? hm.content
                    : (hm.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
                  if (txt) messages.value.push({ role: "system", text: txt });
                } else if (hm.role === "toolResult") {
                  const tool = toolById[hm.toolCallId];
                  if (tool) {
                    const txt = Array.isArray(hm.content)
                      ? hm.content.filter((c) => c.type === "text").map((c) => c.text).join("\n")
                      : (typeof hm.content === "string" ? hm.content : "");
                    tool.result = txt.length > 4000 ? txt.slice(0, 4000) + "\n...(truncated)" : txt;
                    tool.isError = !!hm.isError;
                  }
                }
              });
              scrollToBottom();
            } else if (m.type === "agent_event") {
              handleAgentEvent(m.event);
            } else if (m.type === "approval_request") {
              approvalQueue.value = [...approvalQueue.value, { id: m.id, summary: m.summary }];
              markActivity();
              // Low bong — distinct from the bright "finished" ding — so techs notice
              // a pending Approve without staring at the orange banner.
              announceApprovalNeeded({
                summary: m.summary,
                kind: isDecision ? "decision" : "chat",
                hostname: hostname.value,
                key: `${curSessionId || "session"}:approval:${m.id}`,
              });
            } else if (m.type === "autoapprove_state") {
              autoApprove.value = m.value;
            } else if (m.type === "label_state") {
              sessionLabel.value = String(m.value || "");
              lastSentLabel = sessionLabel.value;
              applyWindowTitle();
            } else if (m.type === "autocredential_state") {
              // The server is authoritative: if the role does not carry the permission it
              // comes back false, and the switch snaps back rather than lying to the tech.
              autoCredential.value = !!m.value;
              messages.value.push({
                role: "system",
                text: m.value
                  ? "Auto-credential ON — Pi may use stored IT Notebook logins for this customer without asking each time. Privileged rows still ask you every time, and every lookup is audited."
                  : "Auto-credential OFF — Pi must ask you before reading any stored credential.",
              });
              scrollToBottom();
            } else if (m.type === "readonly_state") {
              readOnly.value = m.value;
            } else if (m.type === "allow_email_state") {
              allowEmail.value = m.value;
              messages.value.push({
                role: "system",
                text: m.value
                  ? "Switched to READ-ONLY mode."
                  : "Switched to WRITE mode — Pi can now apply changes (with approval).",
              });
              scrollToBottom();
            } else if (m.type === "model_changed") {
              selectedModel.value = m.model_id;
              messages.value.push({
                role: "system",
                text: `Switched model to ${m.display}`,
              });
              scrollToBottom();
            } else if (m.type === "cost_update") {
              // Running spend for this conversation (server is the only source of
              // truth; we never compute cost in the browser).
              sessionCost.value = Number(m.session_cost || 0);
              lastTurnCost.value = Number(m.turn_cost || 0);
              costTurns.value = Number(m.turns || 0);
              contextTokens.value = Number(m.context_tokens || 0);
              if (m.context_window) contextWindow.value = Number(m.context_window);
              if (m.tokens) costTokens.value = m.tokens;
              costSpend.value = m.spend || null;
              costPerTurn.value = Number(m.cost_per_turn || 0);
              costByModel.value = Array.isArray(m.by_model) ? m.by_model : [];
              modelSwitches.value = Number(m.model_switches || 0);
              switchSpend.value = Number(m.switch_spend || 0);
              pricingKnown.value = m.pricing_known !== false;
            } else if (m.type === "cost_warning") {
              // An expensive turn / filling context: show it in the transcript so it
              // is on the record, not just a toast that disappears.
              messages.value.push({ role: "system", text: `\u26a0 ${m.message}` });
              scrollToBottom();
            } else if (m.type === "error") {
              notifyError(m.message);
              messages.value.push({ role: "system", text: `\u26a0 ${m.message}` });
              scrollToBottom();
              streaming.value = false;
            }
          };
        })
        .catch((err) => {
          notifyError(
            err?.response?.data?.detail ||
              err?.response?.data ||
              "Failed to start Pi session",
          );
        });
    }

    function reconnect() {
      connectionLost.value = false;
      connect({ resume: curSessionId, model_id: selectedModel.value });
    }

    function send() {
      const text = input.value.trim();
      if (!text || !connected.value) return;
      // Prime Web Audio while this click/keypress still counts as a user gesture.
      // Managed Chromium browsers otherwise may block the later completion ding.
      primeCompletionAudio();
      messages.value.push({ role: "user", text });
      currentIdx = -1;
      streaming.value = true;
      streamStartAt.value = Date.now();
      markActivity();
      ws.send(JSON.stringify({ type: "prompt", message: text }));
      input.value = "";
      scrollToBottom();
    }

    function abort() {
      if (ws) ws.send(JSON.stringify({ type: "abort" }));
      streaming.value = false;
    }

    function respondApproval(ok) {
      const cur = approvalQueue.value[0];
      if (cur && ws) {
        ws.send(
          JSON.stringify({
            type: ok ? "approve" : "deny",
            id: cur.id,
          }),
        );
      }
      // pop the one we just answered; the next (if any) shows automatically
      approvalQueue.value = approvalQueue.value.slice(1);
    }

    // Approve everything currently queued (handy for multi-machine turns).
    function respondApprovalAll(ok) {
      if (ws) {
        for (const a of approvalQueue.value) {
          ws.send(JSON.stringify({ type: ok ? "approve" : "deny", id: a.id }));
        }
      }
      approvalQueue.value = [];
    }

    function sendAutoCredential(val) {
      if (ws) ws.send(JSON.stringify({ type: "set_autocredential", value: !!val }));
      saveAIAutoCredential(!!val).catch(() => {
        notifyError("Auto-credential is set for this window, but could not be saved as your default.");
      });
    }

    function sendAutoApprove(val) {
      if (ws) ws.send(JSON.stringify({ type: "set_autoapprove", value: val }));
      // Remember it for next time. Without this the toggle is per-socket, so a refresh or a
      // second window starts over - the "sometimes auto-approve does not work" bug.
      saveAIAutoApprove(!!val).catch(() => {
        notifyError("Auto-approve is on for this window, but could not be saved as your default.");
      });
    }

    function onModelChange(val) {
      // switch model on the SAME session (keeps history); only reconnect if the
      // socket is somehow closed.
      if (ws && connected.value) {
        ws.send(JSON.stringify({ type: "set_model", model_id: val }));
      } else {
        connect({ model_id: val });
      }
    }

    function startNewChat() {
      connect({ model_id: selectedModel.value });
    }

    // --- multi-machine setup dialog ----------------------------------------
    const machinesDialog = ref(false);
    const machineRows = ref([]);
    const machinesError = ref("");
    const { agentOptions, getAgentOptions } = useAgentDropdown();

    function openMachinesDialog() {
      machinesError.value = "";
      if (agentOptions.value.length === 0) getAgentOptions();
      if (isMulti && multiMachines.length) {
        machineRows.value = multiMachines.map((m) => ({ ...m }));
      } else if (machineRows.value.length === 0) {
        // seed with the machine we were opened on, plus an empty row to add
        machineRows.value = [
          { agent_id: isMulti ? null : agentId, role: "" },
          { agent_id: null, role: "" },
        ];
      }
      machinesDialog.value = true;
    }

    function addMachineRow() {
      if (machineRows.value.length < 8)
        machineRows.value.push({ agent_id: null, role: "" });
    }

    function removeMachineRow(i) {
      machineRows.value.splice(i, 1);
    }

    function launchMulti() {
      const rows = machineRows.value.filter((r) => r.agent_id);
      if (rows.length < 2) {
        machinesError.value = "Select at least 2 machines (use + to add more).";
        return;
      }
      const ids = rows.map((r) => r.agent_id);
      if (new Set(ids).size !== ids.length) {
        machinesError.value = "The same machine is selected more than once.";
        return;
      }
      const machines = rows.map((r) => ({
        agent_id: r.agent_id,
        role: (r.role || "").trim(),
      }));
      // reload this popup as a fresh multi-machine chat
      const href = router.resolve({
        path: "/pichat/multi",
        query: { m: encodePiMachines(machines) },
      }).href;
      window.location.assign(href);
    }

    onMounted(() => {
      connect({ resume: route.query.resume, model_id: route.query.model });
      tickTimer = setInterval(() => {
        nowTick.value = Date.now();
      }, 1000);
    });
    onBeforeUnmount(() => {
      if (tickTimer) clearInterval(tickTimer);
      if (ws) try { ws.close(); } catch (e) { /* noop */ }
    });

    return {
      agentId,
      isDecision,
      hostname,
      clientSite,
      costVisible,
      sessionCost,
      lastTurnCost,
      costTurns,
      contextTokens,
      contextWindow,
      costTokens,
      costSpend,
      costPerTurn,
      costByModel,
      modelSwitches,
      switchSpend,
      pricingKnown,
      contextPct,
      costColor,
      fmtMoney,
      fmtTokens,
      connectionLost,
      stalled,
      workingText,
      reconnect,
      connected,
      streaming,
      soundEnabled,
      desktopEnabled,
      onlyWhenUnfocused,
      notificationSupported,
      notificationPermission,
      desktopStatus,
      primeCompletionAudio,
      setSoundAlert,
      setDesktopNotifications,
      testCompletionAlerts,
      messages,
      input,
      modelOptions,
      selectedModel,
      autoApprove,
      autoapproveAllowed,
      readOnly,
      allowEmail,
      sendAllowEmail,
      autocredentialAllowed,
      autoCredential,
      sendAutoCredential,
      sessionLabel,
      sendLabel,
      mutateAllowed,
      setReadonly,
      pendingApproval,
      approvalQueue,
      respondApprovalAll,
      scrollArea,
      isMulti,
      machinesDialog,
      machineRows,
      machinesError,
      agentOptions,
      openMachinesDialog,
      addMachineRow,
      removeMachineRow,
      launchMulti,
      send,
      abort,
      respondApproval,
      sendAutoApprove,
      onModelChange,
      startNewChat,
    };
  },
};
</script>

<style scoped>
.pichat {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.pi-messages {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}
.pi-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  word-break: break-word;
}
.pi-user {
  background: #1976d2;
  color: #fff;
}
.pi-assistant {
  background: #37474f;
  color: #fff;
}
.pi-text {
  white-space: pre-wrap;
}
.pi-tool {
  background: #263238;
  border-left: 3px solid #42a5f5;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
}
.pi-args,
.pi-result {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 4px 0 0;
  font-family: monospace;
  font-size: 11px;
  color: #cfd8dc;
  max-height: 320px;
  overflow: auto;
}
</style>
