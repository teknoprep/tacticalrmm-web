<template>
  <div class="q-pa-md flex flex-center" style="min-height: 100vh; background: #f5f5f5">
    <q-card style="width: 800px; max-width: 95vw" flat bordered>
      <q-card-section class="bg-primary text-white row items-center q-py-sm">
        <q-icon name="smart_toy" size="sm" class="q-mr-sm" />
        <div>
          <div class="text-subtitle1">Johnny 5 Need Input!</div>
          <div class="text-caption">
            {{ ticketRef }}<span v-if="ctx.client"> · {{ ctx.client }}</span>
            <span v-if="ctx.affected_device"> · {{ ctx.affected_device }}</span>
          </div>
        </div>
        <q-space />
        <q-badge :color="statusColor" :label="status" />
      </q-card-section>

      <q-separator />

      <q-card-section v-if="loading" class="flex flex-center q-pa-lg">
        <q-spinner color="primary" size="32px" />
      </q-card-section>

      <template v-else>
        <q-card-section
          ref="scrollArea"
          class="q-gutter-y-sm"
          style="max-height: 55vh; overflow-y: auto"
        >
          <div
            v-for="(m, i) in messages"
            :key="i"
            :class="m.role === 'assistant' ? 'row justify-start' : 'row justify-end'"
          >
            <div
              :class="[
                'q-pa-sm rounded-borders',
                m.role === 'assistant' ? 'bg-grey-3 text-black' : 'bg-blue-1 text-black',
              ]"
              style="max-width: 82%; white-space: pre-wrap; word-break: break-word"
            >
              <div class="text-caption text-weight-medium q-mb-xs">
                {{ m.role === "assistant" ? "🤖 Pi.dev AI" : "You" }}
              </div>
              {{ m.content }}
            </div>
          </div>
          <div v-if="sending" class="row justify-start">
            <div class="q-pa-sm bg-grey-3 rounded-borders" style="min-width:260px">
              <div class="row items-center q-mb-xs">
                <q-spinner-dots color="primary" size="20px" class="q-mr-sm" />
                <span class="text-weight-medium">{{ liveSteps.length ? "Pi is working…" : "Pi is thinking…" }}</span>
              </div>
              <div
                v-for="(s, i) in liveSteps"
                :key="i"
                class="text-caption"
                :class="i === liveSteps.length - 1 ? 'text-primary text-weight-medium' : 'text-grey-7'"
              >
                <q-icon :name="i === liveSteps.length - 1 ? 'sync' : 'check'" size="12px" class="q-mr-xs" />{{ s }}
              </div>
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section class="q-pt-sm">
          <q-input
            v-model="draft"
            type="textarea"
            outlined
            autogrow
            dense
            :disable="sending"
            placeholder="Answer Pi's question (e.g. 'It's RKarrer-LT1' or 'Cancel it, that's a duplicate')…"
            @keydown.enter.exact.prevent="send"
          />
          <div class="row items-center q-gutter-md q-mt-xs">
            <q-toggle
              v-model="allowDeviceChanges"
              dense
              color="deep-orange"
              label="Allow disruptive changes (reboots/service stops/deletes)"
            />
            <q-toggle
              v-model="allowCustomerReply"
              dense
              color="blue"
              label="Allow sending customer email"
            />
          </div>
          <div class="row items-center q-mt-sm">
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="check"
              label="Mark resolved"
              :disable="sending"
              @click="closeDecision"
            />
            <q-space />
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="send"
              label="Send"
              :loading="sending"
              :disable="!draft.trim()"
              @click="send"
            />
          </div>
          <div class="text-caption text-grey q-mt-xs">
            Pi can act on this ticket (reply to the customer, add notes, close/cancel, clear the
            tag). It cannot change devices yet. Enter sends; Shift+Enter for a new line.
          </div>
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import { getAIDecision, replyAIDecision, closeAIDecision, getAIDecisionStatus } from "@/api/core";
import { notifyError, notifySuccess } from "@/utils/notify";

export default {
  name: "AIDecision",
  setup() {
    const route = useRoute();
    const token = route.params.token;
    const loading = ref(true);
    const sending = ref(false);
    const ticketRef = ref("");
    const ctx = ref({});
    const messages = ref([]);
    const status = ref("open");
    const draft = ref("");
    const scrollArea = ref(null);
    const allowDeviceChanges = ref(false);
    const allowCustomerReply = ref(true);
    const liveSteps = ref([]);
    let pollTimer = null;

    async function pollStatus() {
      try {
        const s = await getAIDecisionStatus(token);
        liveSteps.value = (s.events || [])
          .filter((e) => e.label)
          .map((e) => e.label + (e.isError ? " (error)" : ""));
      } catch (e) {
        /* ignore transient poll errors */
      }
    }
    function startPolling() {
      liveSteps.value = [];
      stopPolling();
      pollTimer = setInterval(pollStatus, 1200);
    }
    function stopPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    const statusColor = computed(
      () => ({ open: "orange", answered: "blue", closed: "green" }[status.value] || "grey"),
    );

    async function scrollDown() {
      await nextTick();
      const el = scrollArea.value?.$el;
      if (el) el.scrollTop = el.scrollHeight;
    }

    async function load() {
      loading.value = true;
      try {
        const d = await getAIDecision(token);
        ticketRef.value = d.ticket_ref;
        ctx.value = d.context || {};
        messages.value = d.messages || [];
        status.value = d.status;
      } catch (e) {
        notifyError("Could not load this decision (link may be invalid or expired).");
      }
      loading.value = false;
      scrollDown();
    }

    async function send() {
      const msg = draft.value.trim();
      if (!msg || sending.value) return;
      messages.value.push({ role: "user", content: msg });
      draft.value = "";
      sending.value = true;
      startPolling();
      scrollDown();
      try {
        const r = await replyAIDecision(token, msg, {
          allow_device_changes: allowDeviceChanges.value,
          allow_customer_reply: allowCustomerReply.value,
        });
        messages.value = r.messages;
        status.value = r.status;
      } catch (e) {
        notifyError("Pi could not respond. Try again.");
      }
      stopPolling();
      liveSteps.value = [];
      sending.value = false;
      scrollDown();
    }

    async function closeDecision() {
      try {
        await closeAIDecision(token);
        status.value = "closed";
        notifySuccess("Marked resolved");
      } catch (e) {
        notifyError("Could not update status");
      }
    }

    onMounted(load);
    return {
      loading, sending, ticketRef, ctx, messages, status, draft, scrollArea,
      allowDeviceChanges, allowCustomerReply, liveSteps,
      statusColor, send, closeDecision,
    };
  },
};
</script>
