<template>
  <div class="pichat bg-grey-10 text-white">
    <!-- toolbar -->
    <q-toolbar class="bg-grey-9 text-white q-px-sm">
      <!-- ☰ Options menu. Every switch and session action lives HERE now - the bar keeps
           only what you read at a glance (label, cost, model, alerts, connection). -->
      <q-btn
        flat
        dense
        round
        icon="menu"
        class="q-mr-sm"
        aria-label="Chat options"
        data-test="pi-options-menu"
      >
        <q-tooltip>Options &amp; switches</q-tooltip>
        <q-menu dark>
          <q-list dense dark class="q-py-sm" style="min-width: 320px; max-width: 90vw">
            <q-item-label header class="text-grey-5">Automation</q-item-label>
            <q-item v-if="autoapproveAllowed" tag="label" dense>
              <q-item-section>
                <q-item-label>Auto-approve</q-item-label>
                <q-item-label caption>Run device actions without asking each time</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="autoApprove"
                  dense
                  color="orange"
                  @update:model-value="sendAutoApprove"
                />
              </q-item-section>
            </q-item>
            <q-item v-if="autocredentialAllowed" tag="label" dense>
              <q-item-section>
                <q-item-label>Auto-credential</q-item-label>
                <q-item-label caption>
                  Read ordinary stored logins without asking. Privileged rows still ask;
                  every lookup is audited.
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="autoCredential"
                  dense
                  color="purple"
                  @update:model-value="sendAutoCredential"
                />
              </q-item-section>
            </q-item>
            <q-item v-if="isDecision" tag="label" dense>
              <q-item-section>
                <q-item-label>Allow customer email</q-item-label>
                <q-item-label caption>Off = Pi drafts replies for you instead of sending</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="allowEmail"
                  dense
                  color="teal"
                  @update:model-value="sendAllowEmail"
                />
              </q-item-section>
            </q-item>
            <q-item v-if="mutateAllowed" tag="label" dense>
              <q-item-section>
                <q-item-label>{{ readOnly ? "Read-only (devices)" : "Write mode (devices)" }}</q-item-label>
                <q-item-label caption>
                  Write mode lets Pi apply changes on the machines; each action still asks
                  unless Auto-approve is on
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  :model-value="!readOnly"
                  dense
                  color="deep-orange"
                  @update:model-value="(v) => setReadonly(!v)"
                />
              </q-item-section>
            </q-item>
            <q-item v-else-if="readOnly" dense>
              <q-item-section>
                <q-item-label class="text-blue-grey-3">Read-only (devices)</q-item-label>
                <q-item-label caption>Your role cannot enable Write mode</q-item-label>
              </q-item-section>
            </q-item>

            <q-separator dark class="q-my-sm" />
            <q-item-label header class="text-grey-5">Session</q-item-label>
            <q-item
              v-if="remoteAllowed"
              clickable
              v-close-popup
              :disable="remoteBusy"
              @click="toggleRemote"
            >
              <q-item-section avatar>
                <q-icon
                  :name="remoteState === 'paired' ? 'phonelink' : 'phonelink_off'"
                  :color="remoteState === 'paired' ? 'light-green' : remoteEnabled ? 'amber' : 'grey-5'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ remoteLabel }}</q-item-label>
                <q-item-label caption>
                  <span v-if="remoteState === 'paired'">Paired with {{ remoteDevice }} &mdash; live on that phone</span>
                  <span v-else-if="remoteEnabled">Waiting for a phone &mdash; click to show the code</span>
                  <span v-else>Work this same conversation from your phone</span>
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="!isDecision" clickable v-close-popup @click="openMachinesDialog">
              <q-item-section avatar>
                <q-icon name="lan" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ isMulti ? "Machines" : "Multi-machine" }}</q-item-label>
                <q-item-label caption>Work several machines in one conversation</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="!isDecision" clickable v-close-popup @click="startNewChat">
              <q-item-section avatar>
                <q-icon name="add" />
              </q-item-section>
              <q-item-section>
                <q-item-label>New chat</q-item-label>
                <q-item-label caption>Fresh conversation on this machine</q-item-label>
              </q-item-section>
            </q-item>

            <q-separator dark class="q-my-sm" />
            <q-item-label header class="text-grey-5">History &amp; cost</q-item-label>
            <q-item
              clickable
              v-close-popup
              :disable="streaming || compacting"
              @click="compactWindow"
            >
              <q-item-section avatar>
                <q-icon name="compress" :color="contextPct >= 80 ? 'orange' : undefined" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Summarize (compact)</q-item-label>
                <q-item-label caption>
                  Shrink what the AI re-reads every turn; the transcript above stays readable
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              clickable
              v-close-popup
              :disable="streaming || compacting"
              data-test="pi-summarize-clear"
              @click="clearConfirm = true"
            >
              <q-item-section avatar>
                <q-icon name="delete_sweep" color="orange" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Summarize &amp; clear history</q-item-label>
                <q-item-label caption>
                  Same, plus wipe the transcript from this window &mdash; keep working in the
                  same chat without paying for the old history
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <div class="column pi-title q-mr-sm">
        <div class="text-subtitle2 ellipsis">
          Pi.dev &mdash; {{ hostname || (isMulti ? "multi-machine" : agentId) }}
        </div>
        <div class="text-caption text-grey-5 ellipsis">
          {{ clientSite }}
        </div>
      </div>
      <q-space />
      <!-- Summarizing progress. The action lives in the ☰ menu, which closes on click -
           without this chip there is NOTHING on screen saying a billable, minute-long
           LLM call is running. Toolbar chip = visible even when scrolled up. -->
      <q-chip
        v-if="compacting"
        dense
        square
        color="amber-9"
        text-color="white"
        class="q-mr-sm"
      >
        <q-spinner-hourglass size="14px" class="q-mr-xs" />
        Summarizing…
        <q-tooltip>
          The AI is writing a summary of this conversation. Takes up to a minute or two
          on a long chat. The window updates by itself when it finishes.
        </q-tooltip>
      </q-chip>
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
        class="q-mr-sm pi-label-input"
        style="min-width: 140px; max-width: 220px"
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

          <!-- The meter above is THIS conversation only: a new chat starts at $0.00 even
               on a device that has spent hundreds. The lifetime figure is what billing
               cares about, so it is kept here rather than dropped. -->
          <div v-if="windowCost !== null" class="text-grey-4 q-mt-xs">
            {{ windowScope === "ticket" ? "This ticket" : "This device" }}, all chats:
            <b>{{ fmtMoney(windowCost) }}</b>
            &middot; {{ windowTurns }} turns
          </div>

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
            Context is nearly full &mdash; Compact to keep working in this chat.
          </div>
        </q-tooltip>
      </q-chip>
      <q-select
        v-model="selectedTarget"
        :options="targetOptions"
        emit-value
        map-options
        dense
        dark
        options-dense
        outlined
        hide-bottom-space
        label="Model / group"
        class="q-mr-sm pi-target-select"
        @update:model-value="onTargetChange"
      >
        <q-tooltip>
          Pick a team (orchestrator + cheap specialists) or a single model. Not both.
        </q-tooltip>
      </q-select>
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
      <!-- PROMPT QUEUE toggle. The panel itself (right of the chat, or over it on a narrow
           window) holds every queue control; this button only opens and closes it. -->
      <q-btn
        flat
        dense
        no-caps
        :color="queueOpen ? 'primary' : 'white'"
        icon="playlist_add_check"
        label="Queue"
        class="q-mr-sm"
        data-test="pi-queue-toggle"
        @click="queueOpen = !queueOpen"
      >
        <q-badge
          v-if="queuePending > 0"
          floating
          :color="queuePaused ? 'orange-8' : queueAuto ? 'green-8' : 'blue-grey-7'"
          :label="queuePending"
        />
        <q-tooltip>
          Prompt queue: write down what to do next; with Auto-Next on each one is sent as
          soon as the assistant finishes.
        </q-tooltip>
      </q-btn>
      <q-badge
        :color="connected ? 'green' : 'red'"
        :label="connected ? 'connected' : 'disconnected'"
      />
    </q-toolbar>

    <!-- body: the chat column, plus the queue panel to its right (over it when narrow) -->
    <div class="pi-body">
    <div class="pi-main">
    <!-- messages -->
    <div ref="scrollArea" class="pi-messages q-pa-md">
      <div v-for="(msg, i) in messages" :key="i" class="q-mb-md">
        <!-- user -->
        <div v-if="msg.role === 'user'" class="pi-user-row">
          <!-- pi-text carries `white-space: pre-wrap`. Without it the browser collapses every
               run of whitespace and drops newlines, so anything pasted in - a log extract, a
               command, a list, an indented block - rendered as one unreadable paragraph the
               instant it was sent, even though it looked right in the textarea. The assistant
               bubble always had it; the user's own message did not. -->
          <div class="pi-user-wrap">
            <!-- Where it was typed matters when two surfaces drive one session: a message
                 that arrived from a phone should not read as if the person at the desk
                 sent it. -->
            <div v-if="msg.via" class="text-caption text-grey-5 text-right q-mb-xs">
              <q-icon name="smartphone" size="14px" /> from {{ msg.via }}
            </div>
            <div v-else-if="msg.queued" class="text-caption text-grey-5 text-right q-mb-xs">
              <q-icon name="playlist_play" size="14px" /> from the queue
            </div>
            <div class="pi-bubble pi-user pi-text">{{ msg.text }}</div>
          </div>
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
      <!-- Compacting indicator in the transcript flow, where eyes already are. Separate
           from the streaming row because compaction is not a turn - no stall watchdog,
           no Stop button, just an honest "this is running". -->
      <div v-if="compacting && !streaming" class="row items-center q-gutter-xs q-mt-xs">
        <q-spinner-hourglass color="amber" />
        <span class="text-caption text-amber-4">
          Summarizing the conversation&hellip; this is an AI call and can take a minute or
          two on a long chat. The result will appear here when it is done.
        </span>
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

    <!-- Summarize & clear history: confirm before wiping the window. -->
    <q-dialog v-model="clearConfirm">
      <q-card dark style="min-width: 480px; max-width: 90vw">
        <q-card-section class="text-subtitle1">Summarize &amp; clear history?</q-card-section>
        <q-card-section class="text-grey-4 q-pt-none">
          Pi writes a short summary of everything so far, keeps working from it in this
          same window, and clears the transcript above. Following turns stop paying to
          re-read the old history. The full record stays on disk (AI History / the
          ticket), so nothing is lost for audit.
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            v-model="clearNote"
            type="textarea"
            outlined
            dark
            autogrow
            autofocus
            :input-style="{ minHeight: '88px' }"
            label="Note for the summary (optional)"
            hint="e.g. done with the extension edit UI — next is the dialplan. What to keep, what this chapter was."
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cancel" />
          <q-btn
            v-close-popup
            unelevated
            no-caps
            color="primary"
            label="Summarize &amp; clear"
            data-test="pi-summarize-clear-confirm"
            @click="summarizeClear"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Remote (mobile) pairing -->
    <q-dialog v-model="remoteDialog">
      <q-card dark class="bg-grey-9" style="width: 420px; max-width: 95vw">
        <q-card-section class="row items-center q-pb-none">
          <q-icon name="phonelink" size="sm" class="q-mr-sm" />
          <div class="text-h6">Pair a phone</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="text-center">
          <div v-if="remotePairingUri">
            <div class="bg-white q-pa-md inline-block" style="border-radius: 6px">
              <img :src="remoteQr" alt="Pairing QR code" style="width: 240px; height: 240px" />
            </div>
            <div class="text-caption text-grey-5 q-mt-md">
              Scan with the <strong>Remote Pi</strong> app. The code is valid for about a
              minute and can only be used once &mdash; press Remote again for a fresh one.
            </div>
            <q-input
              dense
              dark
              outlined
              readonly
              class="q-mt-sm"
              :model-value="remotePairingUri"
              label="Or paste this into the app"
            >
              <template #append>
                <q-btn flat dense round icon="content_copy" @click="copyPairingUri" />
              </template>
            </q-input>
          </div>
          <div v-else class="q-py-lg">
            <q-spinner size="32px" />
            <div class="text-caption text-grey-5 q-mt-sm">Opening the relay&hellip;</div>
          </div>
        </q-card-section>
        <q-card-section v-if="remoteDevices.length" class="q-pt-none">
          <div class="text-caption text-grey-5">
            Already paired: {{ remoteDevices.map((d) => d.name).join(", ") }}. A phone you
            have paired before reconnects on its own &mdash; no scan needed.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Turn Remote off" color="grey-5" @click="disableRemote" />
          <q-btn flat no-caps label="Done" v-close-popup />
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
    <div class="bg-grey-9 q-pa-sm row items-end relative-position">
      <!-- SLASH COMMANDS. The list comes from the bridge (`ready.commands`), never from
           here, so it can only offer what this role may actually use. A switch the role
           does not carry is still listed, greyed, with the reason - hiding it makes a
           permission look like a missing feature, and the tech asks the wrong question. -->
      <div v-if="cmdMatches.length" class="pi-cmd-menu bg-grey-10">
        <div
          v-for="(c, i) in cmdMatches"
          :key="c.name"
          class="pi-cmd-item"
          :class="{ 'pi-cmd-active': i === cmdIndex }"
          @mousedown.prevent="applyCommand(c)"
          @mouseover="cmdIndex = i"
        >
          <div class="row items-center no-wrap">
            <span :class="c.allowed ? 'text-white' : 'text-grey-6'">{{ c.usage }}</span>
            <q-badge
              v-if="cmdState(c)"
              class="q-ml-sm"
              :color="cmdState(c) === 'ON' ? 'light-green-8' : 'blue-grey-7'"
              :label="cmdState(c)"
            />
            <q-icon v-if="!c.allowed" name="lock" size="14px" class="q-ml-sm text-grey-6" />
          </div>
          <div class="text-caption" :class="c.allowed ? 'text-grey-5' : 'text-orange-8'">
            {{ c.allowed ? c.desc : c.denied }}
          </div>
        </div>
        <div class="text-caption text-grey-6 q-px-sm q-py-xs">
          Tab or Enter completes &mdash; Esc dismisses
        </div>
      </div>
      <q-input
        v-model="input"
        type="textarea"
        autogrow
        dark
        dense
        outlined
        :placeholder="isMulti
          ? 'Tell Pi what to do across these machines...'
          : 'Ask about this device, or type / for commands...'"
        class="col"
        :disable="!connected"
        @keydown.enter.exact.prevent="onEnter"
        @keydown.tab="onCmdTab"
        @keydown.down="onCmdArrow(1, $event)"
        @keydown.up="onCmdArrow(-1, $event)"
        @keydown.esc="cmdDismissed = true"
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
    </div><!-- /pi-main -->

    <!-- PROMPT QUEUE PANEL. Per conversation: it survives refresh, reconnect and
         "Continue", and a new chat starts with an empty one. The bridge owns the state
         (queue_state frames); everything here is a request to it. -->
    <aside
      v-if="queueOpen"
      class="pi-queue bg-grey-9"
      :class="{ 'pi-queue--overlay': queueOverlay }"
      data-test="pi-queue-panel"
    >
      <div class="row items-center q-px-sm q-py-xs pi-queue-head">
        <q-icon name="playlist_add_check" size="sm" class="q-mr-sm" />
        <div class="text-subtitle2">Queue</div>
        <q-badge v-if="queuePending" class="q-ml-sm" color="blue-grey-7" :label="`${queuePending} pending`" />
        <q-space />
        <q-btn flat round dense icon="close" @click="queueOpen = false" />
      </div>

      <div class="q-px-sm q-pb-xs">
        <q-toggle
          :model-value="queueAuto"
          color="green"
          dense
          label="Auto-Next"
          :disable="!connected"
          data-test="pi-queue-auto"
          @update:model-value="queueSetAuto"
        >
          <q-tooltip max-width="320px">
            Send the next queued prompt automatically as soon as the assistant finishes a
            turn. The queue stops by itself when the assistant needs a decision from you,
            when a turn fails, or when you press Stop.
          </q-tooltip>
        </q-toggle>
        <q-toggle
          :model-value="queueAutoClear"
          color="blue-grey-4"
          dense
          label="Auto-clear done"
          :disable="!connected"
          data-test="pi-queue-auto-clear"
          @update:model-value="queueSetAutoClear"
        >
          <q-tooltip max-width="320px">
            Remove each prompt from the list as soon as it has run. Failed or skipped ones
            stay, so you can see what still needs you.
          </q-tooltip>
        </q-toggle>
        <div v-if="queuePaused" class="pi-queue-paused q-pa-sm q-mt-xs">
          <div class="row items-center no-wrap">
            <q-icon name="pause_circle" class="q-mr-xs" />
            <b>Paused</b>
            <span class="text-caption text-grey-4 q-ml-xs">
              &mdash; {{ queuePaused.by === "assistant" ? "the assistant asked:" : "" }}
            </span>
          </div>
          <div class="pi-text text-body2 q-mt-xs">{{ queuePaused.reason }}</div>
          <div class="text-caption text-grey-5 q-mt-xs" v-if="queuePaused.by === 'assistant'">
            Answer in the chat and the queue continues after that turn, or Resume to skip the question.
          </div>
          <q-btn dense no-caps outline color="orange-4" icon="play_arrow" label="Resume" class="q-mt-xs" @click="queueResume" />
        </div>
        <div v-else-if="queueRunningId" class="text-caption text-green-4 q-mt-xs">
          <q-spinner-dots size="14px" class="q-mr-xs" /> Running a queued prompt&hellip;
        </div>
      </div>

      <!-- add -->
      <div class="q-px-sm q-pb-sm">
        <q-input
          v-model="queueNew"
          type="textarea"
          autogrow
          dark
          dense
          outlined
          placeholder="What should happen next? One prompt per entry."
          :disable="!connected"
          data-test="pi-queue-new"
          @keydown.enter.ctrl.prevent="queueAdd"
        />
        <div class="row items-center q-mt-xs">
          <q-checkbox v-model="queueNewCompact" dense size="sm" label="Compact & clear first" :disable="!connected">
            <q-tooltip max-width="300px">
              Before this prompt is sent, summarise the conversation and clear the history so
              it starts from a short summary instead of the whole transcript.
            </q-tooltip>
          </q-checkbox>
          <q-space />
          <q-btn
            dense
            no-caps
            color="primary"
            icon="add"
            label="Add"
            :disable="!connected || !queueNew.trim()"
            data-test="pi-queue-add"
            @click="queueAdd"
          />
        </div>
      </div>

      <!-- actions -->
      <div class="row items-center q-px-sm q-pb-xs q-gutter-xs">
        <q-btn dense no-caps outline size="sm" icon="skip_next" label="Run next" :disable="!connected || streaming || !queuePending" @click="queueRunNext">
          <q-tooltip>Send the first pending prompt now, once, whatever Auto-Next is set to.</q-tooltip>
        </q-btn>
        <q-btn v-if="!queuePaused" dense no-caps outline size="sm" icon="pause" label="Pause" :disable="!connected" @click="queuePause" />
        <q-btn v-else dense no-caps outline size="sm" icon="play_arrow" label="Resume" :disable="!connected" @click="queueResume" />
        <q-space />
        <q-btn dense no-caps flat size="sm" icon="done_all" label="Clear done" :disable="!connected || !queueItems.some(i => i.status !== 'pending' && i.status !== 'running')" @click="queueClearDone" />
        <q-btn dense no-caps flat size="sm" color="negative" icon="delete_sweep" label="Clear all" :disable="!connected || !queueItems.length" @click="queueClearAll" />
      </div>

      <!-- list -->
      <div class="pi-queue-list q-px-sm q-pb-sm">
        <div v-if="!queueItems.length" class="text-caption text-grey-6 q-pa-sm">
          Nothing queued. Add the next things you want done; they stay with this conversation.
        </div>
        <div
          v-for="(it, idx) in queueItems"
          :key="it.id"
          class="pi-queue-item q-pa-xs q-mb-xs"
          :class="`pi-queue-item--${it.status}`"
        >
          <div class="row items-start no-wrap">
            <q-icon
              :name="queueStatusIcon(it)"
              :color="queueStatusColor(it)"
              size="18px"
              class="q-mr-xs q-mt-xs"
            >
              <q-tooltip>{{ it.status }}{{ it.note ? ` - ${it.note}` : "" }}</q-tooltip>
            </q-icon>
            <div class="col" style="min-width: 0">
              <q-input
                v-if="queueEditId === it.id"
                v-model="queueEditText"
                type="textarea"
                autogrow
                dark
                dense
                outlined
                autofocus
                @keydown.enter.ctrl.prevent="queueSaveEdit(it)"
                @keydown.esc="queueEditId = null"
              />
              <div
                v-else
                class="pi-text text-body2 pi-queue-text"
                :class="{ 'text-grey-5': it.status === 'done' || it.status === 'skipped' }"
                @dblclick="queueStartEdit(it)"
              >{{ it.text }}</div>
              <div class="text-caption text-grey-6">
                <q-icon v-if="it.compact_first" name="compress" size="12px" class="q-mr-xs">
                  <q-tooltip>Compact &amp; clear before this one</q-tooltip>
                </q-icon>
                <span v-if="it.note">{{ it.note }}</span>
              </div>
            </div>
          </div>
          <div class="row items-center justify-end no-wrap pi-queue-tools">
            <template v-if="queueEditId === it.id">
              <q-btn flat dense size="sm" icon="check" color="green-4" @click="queueSaveEdit(it)"><q-tooltip>Save (Ctrl+Enter)</q-tooltip></q-btn>
              <q-btn flat dense size="sm" icon="close" @click="queueEditId = null" />
            </template>
            <template v-else>
              <q-btn flat dense size="sm" icon="arrow_upward" :disable="idx === 0 || it.status === 'running'" @click="queueMove(it, -1)" />
              <q-btn flat dense size="sm" icon="arrow_downward" :disable="idx === queueItems.length - 1 || it.status === 'running'" @click="queueMove(it, 1)" />
              <q-btn flat dense size="sm" :icon="it.compact_first ? 'compress' : 'expand'" :color="it.compact_first ? 'primary' : 'grey-6'" :disable="it.status === 'running'" @click="queueToggleCompact(it)">
                <q-tooltip>{{ it.compact_first ? "Compact & clear first: ON" : "Compact & clear first: off" }}</q-tooltip>
              </q-btn>
              <q-btn flat dense size="sm" icon="edit" :disable="it.status === 'running'" @click="queueStartEdit(it)" />
              <q-btn v-if="it.status === 'pending'" flat dense size="sm" icon="remove_done" :disable="it.status === 'running'" @click="queueSetStatus(it, 'skipped')"><q-tooltip>Skip</q-tooltip></q-btn>
              <q-btn v-else-if="it.status !== 'running'" flat dense size="sm" icon="replay" @click="queueSetStatus(it, 'pending')"><q-tooltip>Queue it again</q-tooltip></q-btn>
              <q-btn flat dense size="sm" icon="delete" color="negative" :disable="it.status === 'running'" @click="queueRemove(it)" />
            </template>
          </div>
        </div>
      </div>
    </aside>
    </div><!-- /pi-body -->
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useQuasar } from "quasar";
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
import { useQRCode } from "@vueuse/integrations/useQRCode";
import { notifyError, notifySuccess } from "@/utils/notify";
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

    function targetStorageKey() {
      if (isDecision) return `pi-target:decision:${decisionToken}`;
      if (isMulti) return "pi-target:multi";
      return `pi-target:agent:${agentId}`;
    }
    function loadSavedTarget() {
      try {
        const raw = JSON.parse(localStorage.getItem(targetStorageKey()) || "null");
        return raw && typeof raw === "object" ? raw : null;
      } catch {
        return null;
      }
    }
    function saveTarget(groupId, modelId) {
      try {
        localStorage.setItem(
          targetStorageKey(),
          JSON.stringify({ group_id: groupId ?? null, model_id: modelId || null }),
        );
      } catch {
        /* preference only */
      }
    }
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
    const selectedGroup = ref(null);
    const selectedTarget = ref(null);
    const targetOptions = ref([]);

    function targetValue(groupId, modelId) {
      if (groupId != null) return `group:${groupId}`;
      if (modelId) return `model:${modelId}`;
      return null;
    }

    function buildTargetOptions(groups, models, activeGroup, activeModel) {
      const opts = [];
      if (groups.length) {
        opts.push({ label: "Agent groups", value: "_hdr_groups", disable: true });
        for (const g of groups) {
          opts.push({
            label: g.is_default ? `${g.name} (default)` : g.name,
            value: `group:${g.id}`,
          });
        }
      }
      if (models.length) {
        opts.push({ label: "Single models", value: "_hdr_models", disable: true });
        for (const m of models) {
          opts.push({
            label: m.display_name || m.model_id,
            value: `model:${m.model_id}`,
          });
        }
      }
      const sel = targetValue(activeGroup?.id ?? null, activeGroup ? null : activeModel);
      if (sel && !opts.some((o) => o.value === sel)) {
        opts.push({
          label: activeGroup?.name || activeModel || sel,
          value: sel,
        });
      }
      targetOptions.value = opts;
      selectedTarget.value = sel;
    }
    const autoApprove = ref(false);
    const autoapproveAllowed = ref(false);
    // --- slash commands ------------------------------------------------------
    // The toolbar switches, typed. The point of them is the phone: the Remote Pi app
    // renders a chat and nothing else, so "/write on" is the only way to reach Write
    // mode from a car park. The browser gets the same commands with autocomplete, and
    // the list is whatever the BRIDGE said this role may use - see `ready.commands`.
    const commands = ref([]);
    const cmdIndex = ref(0);
    const cmdDismissed = ref(false);

    /** Live state for the badge, so the list never shows a stale ON/OFF. */
    function cmdState(c) {
      if (!c.allowed) return "";
      if (c.name === "write") return readOnly.value ? "OFF" : "ON";
      if (c.name === "approve") return autoApprove.value ? "ON" : "OFF";
      if (c.name === "credentials") return autoCredential.value ? "ON" : "OFF";
      if (c.name === "email") return allowEmail.value ? "ON" : "OFF";
      return "";
    }

    /** Matches only while the NAME is still being typed - a space means args now. */
    const cmdMatches = computed(() => {
      if (cmdDismissed.value || !commands.value.length) return [];
      const m = /^\/([A-Za-z?][A-Za-z0-9?_-]*)?$/.exec(input.value);
      if (!m) return [];
      const q = (m[1] || "").toLowerCase();
      return commands.value
        .filter((c) => !q || c.name.startsWith(q) || (c.aliases || []).some((a) => a.startsWith(q)))
        .slice(0, 8);
    });

    watch(input, () => { cmdDismissed.value = false; cmdIndex.value = 0; });

    function applyCommand(c) {
      input.value = `/${c.name} `;
      cmdIndex.value = 0;
    }

    function onEnter() {
      const list = cmdMatches.value;
      if (list.length) { applyCommand(list[Math.min(cmdIndex.value, list.length - 1)]); return; }
      send();
    }

    function onCmdTab(e) {
      const list = cmdMatches.value;
      if (!list.length) return;
      e.preventDefault();
      applyCommand(list[Math.min(cmdIndex.value, list.length - 1)]);
    }

    function onCmdArrow(dir, e) {
      const list = cmdMatches.value;
      if (!list.length) return;
      e.preventDefault();
      cmdIndex.value = (cmdIndex.value + dir + list.length) % list.length;
    }

    /** A window command answers instantly; it must not raise the streaming spinner. */
    function looksLikeCommand(text) {
      const m = /^\/([A-Za-z?][A-Za-z0-9?_-]*)/.exec(text.trim());
      if (!m) return false;
      const w = m[1].toLowerCase();
      return commands.value.some((c) => c.name === w || (c.aliases || []).includes(w));
    }
    // --- live cost meter -----------------------------------------------------
    // Only populated when the server says this operator's role may see spend
    // (can_view_ai_cost, or superuser). The bridge sends nothing otherwise, so an
    // unprivileged operator cannot infer cost from traffic either.
    // --- Remote (mobile) -----------------------------------------------------
    // Pair a phone to THIS window and carry on the same conversation from it. The server
    // is authoritative on every one of these: `remoteAllowed` comes from the minted
    // session blob (role + global switch + a configured relay), and every state change
    // arrives as a `remote_state` frame rather than being assumed locally - so the button
    // can never claim the conversation is on a phone when it is not.
    const remoteAllowed = ref(false);
    const remoteEnabled = ref(false);
    const remoteState = ref("off");
    const remoteDevice = ref("");
    const remoteDevices = ref([]);
    const remoteBusy = ref(false);
    const remoteDialog = ref(false);
    const remotePairingUri = ref("");
    const remoteQr = useQRCode(remotePairingUri, { width: 240, margin: 1 });
    const remoteLabel = computed(() => {
      if (remoteState.value === "paired") return `Remote: ${remoteDevice.value || "paired"}`;
      if (remoteEnabled.value) return "Remote: waiting";
      return "Remote";
    });

    // --- PROMPT QUEUE ---------------------------------------------------------
    // The bridge owns the queue (queue.js): everything below mirrors its `queue_state`
    // frames and sends requests back. Per CONVERSATION - it survives refresh/reconnect/
    // Continue and a new chat starts empty. The panel's open/closed state is the only
    // thing kept in this browser.
    const $q = useQuasar();
    const queueOpen = ref(localStorage.getItem("pi.queue.open") === "1");
    watch(queueOpen, (v) => localStorage.setItem("pi.queue.open", v ? "1" : "0"));
    // Narrow window: the panel floats over the chat instead of squeezing it.
    const queueOverlay = computed(() => $q.screen.lt.md);
    const queueItems = ref([]);
    const queueAuto = ref(false);
    const queueAutoClear = ref(false);
    const queuePaused = ref(null);
    const queueRunningId = ref(null);
    const queuePending = ref(0);
    const queueNew = ref("");
    const queueNewCompact = ref(false);
    const queueEditId = ref(null);
    const queueEditText = ref("");
    let queueLastPausedAt = null;

    const costVisible = ref(false);
    const sessionCost = ref(0);
    const lastTurnCost = ref(0);
    const costTurns = ref(0);
    // Lifetime spend of the wider window (this device, or this ticket) that the
    // conversation sits inside. Display only - the chip itself meters THIS chat, which
    // is what an operator can actually act on. `null` = the server could not read the
    // ledger, so we say nothing rather than showing a wrong $0.00.
    const windowCost = ref(null);
    const windowTurns = ref(0);
    const windowScope = ref("agent");
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
    const compacting = ref(false);
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

    function connect({ model_id, resume, group_id } = {}) {
      // close any existing
      if (ws) {
        try { ws.close(); } catch (e) { /* noop */ }
        ws = null;
      }
      let sendGroup = group_id;
      let sendModel = model_id;
      // A refresh / new window must reopen on what THIS person last picked, not the
      // global default — as long as they still have access (server re-checks).
      if (group_id === undefined && model_id === undefined && !resume) {
        const saved = loadSavedTarget();
        if (saved && saved.group_id != null) {
          sendGroup = saved.group_id;
        } else if (saved && Object.prototype.hasOwnProperty.call(saved, "group_id") && saved.model_id) {
          sendGroup = null;
          sendModel = saved.model_id;
        } else if (selectedGroup.value != null) {
          sendGroup = selectedGroup.value;
        }
      } else if (group_id === undefined && selectedGroup.value != null) {
        sendGroup = selectedGroup.value;
      }
      const groupPayload = sendGroup !== undefined ? { group_id: sendGroup } : {};
      const create = isDecision
        ? createDecisionSession(decisionToken, { ...(sendModel ? { model_id: sendModel } : {}), ...groupPayload })
        : isMulti
        ? createPiMultiSession({
            machines: multiMachines,
            ...(sendModel ? { model_id: sendModel } : {}),
            ...(resume ? { resume_session: resume } : {}),
            ...groupPayload,
          })
        : createPiSession(agentId, {
            ...(sendModel ? { model_id: sendModel } : {}),
            ...(resume ? { resume_session: resume } : {}),
            ...(resolveRun ? { read_only: true } : {}),
            ...groupPayload,
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
          selectedGroup.value = data.agent_group?.id ?? null;
          buildTargetOptions(
            data.agent_groups || [],
            data.allowed_models || [],
            data.agent_group,
            data.agent_group ? null : data.model_id,
          );
          saveTarget(
            data.agent_group?.id ?? null,
            data.agent_group ? null : data.model_id,
          );
          autoapproveAllowed.value = !!data.autoapprove_allowed;
          // The server remembers the operator's Auto-approve choice; render THAT rather
          // than defaulting to off, or a refresh looks like the setting silently died.
          if (data.auto_approve !== undefined) autoApprove.value = !!data.auto_approve;
          autocredentialAllowed.value = !!data.autocredential_allowed;
          if (data.auto_credential !== undefined) autoCredential.value = !!data.auto_credential;
          remoteAllowed.value = !!data.remote_allowed;

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
              // The bridge decides which model this window actually opens on: it reopens
              // on whatever the conversation was last using, which is NOT necessarily the
              // global default the session endpoint handed us. Without this the picker
              // would sit on the default while the session ran on something else.
              if (m.model?.model_id) selectedModel.value = m.model.model_id;
              if (m.agent_group?.id) selectedGroup.value = m.agent_group.id;
              selectedTarget.value = targetValue(
                selectedGroup.value,
                selectedGroup.value ? null : selectedModel.value,
              );
              // What this window remembered from last time, and what it could not give
              // back. Both are stated: a technician who believes Write mode is still on
              // will not understand the refusals they start getting.
              if (m.model_source === "remembered") {
                messages.value.push({
                  role: "system",
                  text: `Resumed on ${m.model.display} \u2014 the model this chat was last using.`,
                });
              } else if (m.model_remembered_denied) {
                messages.value.push({
                  role: "system",
                  text:
                    `This chat was last using ${m.model_remembered_denied}, which is not available ` +
                    `to your role \u2014 opened on ${m.model.display} instead.`,
                });
              }
              if (m.switches_restored?.length) {
                messages.value.push({
                  role: "system",
                  text: `Restored from last time: ${m.switches_restored.join(", ")}.`,
                });
              }
              if (m.switches_denied?.length) {
                messages.value.push({
                  role: "system",
                  text:
                    `${m.switches_denied.join(", ")} was on when this window was last used, but ` +
                    `your role does not carry it \u2014 opened without it.`,
                });
              }
              mutateAllowed.value = !!m.mutate_allowed;
              costVisible.value = !!m.cost_visible;
              // Autocomplete is whatever the bridge says this role may use. Nothing is
              // inferred here, so the list cannot drift from what the server enforces.
              commands.value = Array.isArray(m.commands) ? m.commands : [];
              if (m.remote_allowed !== undefined) remoteAllowed.value = !!m.remote_allowed;
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
              // The transcript line comes from the bridge as a `system_note` (one place,
              // so the phone reads the same sentence) - don't write a second one here.
              autoCredential.value = !!m.value;
            } else if (m.type === "remote_state") {
              // The server decides. If it says not allowed, the button goes back to off
              // and the technician is told why, rather than being left with a control
              // that looks armed.
              remoteBusy.value = false;
              remoteAllowed.value = m.allowed !== undefined ? !!m.allowed : remoteAllowed.value;
              remoteEnabled.value = !!m.enabled;
              remoteState.value = m.state || (m.enabled ? "waiting" : "off");
              const wasPaired = remoteDevice.value;
              remoteDevice.value = m.device || "";
              remoteDevices.value = m.devices || [];
              if (m.error) {
                remoteDialog.value = false;
                notifyError(m.error);
              }
              if (!m.enabled) {
                remotePairingUri.value = "";
                remoteDialog.value = false;
              }
              if (remoteState.value === "paired" && remoteDevice.value !== wasPaired) {
                // Pairing succeeded - close the QR and put it in the transcript, because
                // "who else can drive this session" belongs in the record.
                remoteDialog.value = false;
                remotePairingUri.value = "";
                messages.value.push({
                  role: "system",
                  text: `\u{1F4F1} ${remoteDevice.value} paired \u2014 this conversation is now live on that phone. It closes when you close this window.`,
                });
                scrollToBottom();
              }
            } else if (m.type === "remote_pairing") {
              remoteBusy.value = false;
              remotePairingUri.value = m.uri || "";
              remoteDialog.value = true;
            } else if (m.type === "remote_user_message") {
              // Typed on the phone. It has to appear here too, or two people end up
              // giving the same machine contradictory instructions.
              messages.value.push({
                role: "user",
                text: m.text,
                via: m.device || "phone",
              });
              scrollToBottom();
            } else if (m.type === "approval_resolved") {
              // Answered from the phone - drop it from the on-screen queue so the banner
              // does not sit there asking for a decision that has already been made.
              approvalQueue.value = approvalQueue.value.filter((a) => a.id !== m.id);
              messages.value.push({
                role: "system",
                text: `\u{1F4F1} ${m.approved ? "Approved" : "Denied"} from the paired phone.`,
              });
              scrollToBottom();
            } else if (m.type === "compacted") {
              // Put the result in the transcript: it is a real, billable event and the
              // technician should be able to see later why the context suddenly shrank.
              compacting.value = false;
              // "Summarize & clear": the bridge kept the summary and marked the durable
              // cut; wipe the window so the technician gets the clean screen they asked for.
              if (m.cleared) messages.value = [];
              messages.value.push({ role: "system", text: `\u{1F5DC} ${m.message}` });
              // Show the summary itself - after a clear it is the only bearings left on
              // screen, and after a plain compact it tells you what the AI now works from.
              if (m.summary) {
                messages.value.push({
                  role: "assistant",
                  text: `\u{1F4CB} Where we are (summary):\n\n${m.summary}`,
                });
              }
              scrollToBottom();
            } else if (m.type === "working" && m.note) {
              compacting.value = /compact/i.test(m.note);
            } else if (m.type === "readonly_state") {
              readOnly.value = m.value;
            } else if (m.type === "allow_email_state") {
              // Same as above: the bridge narrates it once, for both surfaces.
              allowEmail.value = m.value;
            } else if (m.type === "system_note") {
              // A window command answered - possibly typed on the paired phone. It goes
              // in the transcript because "who turned Write mode on" belongs on record.
              streaming.value = false;
              messages.value.push({ role: "system", text: m.text });
              scrollToBottom();
            } else if (m.type === "model_changed") {
              selectedModel.value = m.model_id;
              if (selectedGroup.value == null) {
                selectedTarget.value = targetValue(null, m.model_id);
                saveTarget(null, m.model_id);
              }
              messages.value.push({
                role: "system",
                text: `Switched model to ${m.display}`,
              });
              scrollToBottom();
            } else if (m.type === "group_changed") {
              selectedGroup.value = m.group_id ?? null;
              if (m.model_id) selectedModel.value = m.model_id;
              selectedTarget.value = targetValue(m.group_id ?? null, m.group_id ? null : m.model_id);
              saveTarget(m.group_id ?? null, m.group_id ? null : m.model_id);
              if (m.group_id) {
                messages.value.push({
                  role: "system",
                  text: `Switched to agent group ${m.display || m.name}. Orchestrator is ${m.model_display || m.model_id}.`,
                });
                scrollToBottom();
              }
            } else if (m.type === "queue_state") {
              queueItems.value = Array.isArray(m.items) ? m.items : [];
              queueAuto.value = !!m.auto_next;
              queueAutoClear.value = !!m.auto_clear_done;
              queueRunningId.value = m.running_id || null;
              queuePending.value = Number(m.pending || 0);
              queuePaused.value = m.paused || null;
              // A NEW pause goes on the record in the transcript (once), so "why did it
              // stop" is answered where the tech is looking - and so the alert fires.
              if (m.paused && m.paused.at !== queueLastPausedAt) {
                queueLastPausedAt = m.paused.at;
                messages.value.push({
                  role: "system",
                  text: m.paused.by === "assistant"
                    ? `\u23F8 Queue paused \u2014 the assistant needs your answer: ${m.paused.reason}`
                    : `\u23F8 Queue paused \u2014 ${m.paused.reason}`,
                });
                scrollToBottom();
                if (m.paused.by === "assistant") queueOpen.value = true;
              }
              if (!m.paused) queueLastPausedAt = null;
            } else if (m.type === "queue_started") {
              // A queued prompt is going to the model now: show it as the user's own
              // bubble (it is their words), tagged so the transcript is honest.
              messages.value.push({ role: "user", text: m.text, queued: true });
              currentIdx = -1;
              streaming.value = true;
              streamStartAt.value = Date.now();
              markActivity();
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
              windowCost.value =
                m.window_cost === null || m.window_cost === undefined
                  ? null
                  : Number(m.window_cost);
              windowTurns.value = Number(m.window_turns || 0);
              if (m.window_scope) windowScope.value = String(m.window_scope);
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
              // A refused or failed compaction arrives as an error; clear the button too,
              // or it spins until the backstop timeout for something already finished.
              compacting.value = false;
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
      connect({
        resume: curSessionId,
        model_id: selectedModel.value,
        group_id: selectedGroup.value,
      });
    }

    // Compacting is a session instruction, not a question for the model, so it goes as
    // its own frame. The bridge also accepts "/compact" typed into the box, which is what
    // works in a window that has not been reloaded since this shipped.
    function compactWindow() {
      if (!ws || !connected.value || streaming.value || compacting.value) return;
      compacting.value = true;
      scrollToBottom(); // the progress row lives at the bottom of the transcript
      ws.send(JSON.stringify({ type: "compact" }));
      // The bridge answers with `compacted` or an `error`; both clear the flag. This is a
      // backstop so a dropped frame cannot leave the button spinning forever.
      setTimeout(() => { compacting.value = false; }, 180000);
    }

    // Summarize & clear history: same compaction, plus the bridge marks a durable cut so
    // this window (and any reload of it) starts clean. Confirmed via dialog first - it
    // is not destructive on disk, but an unexpected blank screen looks destructive.
    const clearConfirm = ref(false);
    const clearNote = ref("");
    function summarizeClear() {
      if (!ws || !connected.value || streaming.value || compacting.value) return;
      compacting.value = true;
      scrollToBottom(); // the progress row lives at the bottom of the transcript
      const note = String(clearNote.value || "").trim();
      clearNote.value = "";
      // /compact <note> is the same path as typing it: the bridge treats the rest of
      // the line as steer for the summary ("done with X, moving to Y").
      ws.send(JSON.stringify({
        type: "compact",
        clear: true,
        message: note ? `/compact ${note}` : "",
        instructions: note || undefined,
      }));
      setTimeout(() => { compacting.value = false; }, 180000);
    }

    function send() {
      const text = input.value.trim();
      if (!text || !connected.value) return;
      // Prime Web Audio while this click/keypress still counts as a user gesture.
      // Managed Chromium browsers otherwise may block the later completion ding.
      primeCompletionAudio();
      messages.value.push({ role: "user", text });
      currentIdx = -1;
      // A window command ("/write on") is answered by the bridge in a millisecond and
      // never reaches the model, so raising the streaming spinner for it would leave a
      // "working" state with nothing working.
      if (!looksLikeCommand(text)) {
        streaming.value = true;
        streamStartAt.value = Date.now();
      }
      markActivity();
      ws.send(JSON.stringify({ type: "prompt", message: text }));
      input.value = "";
      scrollToBottom();
    }

    // Queue actions - each is a request to the bridge; the reply is a queue_state frame.
    function queueSend(frame) {
      if (!ws || !connected.value) return;
      ws.send(JSON.stringify(frame));
    }
    function queueAdd() {
      const text = queueNew.value.trim();
      if (!text) return;
      queueSend({ type: "queue_add", text, compact_first: queueNewCompact.value });
      queueNew.value = "";
      queueNewCompact.value = false;
    }
    function queueSetAuto(v) { queueSend({ type: "queue_set_auto", value: !!v }); }
    function queueSetAutoClear(v) { queueSend({ type: "queue_set_auto_clear", value: !!v }); }
    function queuePause() { queueSend({ type: "queue_pause" }); }
    function queueResume() { queueSend({ type: "queue_resume" }); }
    function queueRunNext() { queueSend({ type: "queue_run_next" }); }
    function queueClearDone() { queueSend({ type: "queue_clear_done" }); }
    function queueClearAll() {
      $q.dialog({
        dark: true,
        title: "Clear the queue?",
        message: "Every queued prompt for this conversation is removed. The chat itself is untouched.",
        cancel: true,
        ok: { label: "Clear", color: "negative", flat: true },
      }).onOk(() => queueSend({ type: "queue_clear" }));
    }
    function queueRemove(it) { queueSend({ type: "queue_remove", id: it.id }); }
    function queueSetStatus(it, status) { queueSend({ type: "queue_update", id: it.id, status }); }
    function queueToggleCompact(it) { queueSend({ type: "queue_update", id: it.id, compact_first: !it.compact_first }); }
    function queueStartEdit(it) {
      if (it.status === "running") return;
      queueEditId.value = it.id;
      queueEditText.value = it.text;
    }
    function queueSaveEdit(it) {
      const text = queueEditText.value.trim();
      if (text && text !== it.text) queueSend({ type: "queue_update", id: it.id, text });
      queueEditId.value = null;
    }
    function queueMove(it, dir) {
      const ids = queueItems.value.map((i) => i.id);
      const i = ids.indexOf(it.id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      queueSend({ type: "queue_reorder", ids });
    }
    function queueStatusIcon(it) {
      return {
        pending: "radio_button_unchecked",
        running: "play_circle",
        done: "check_circle",
        failed: "error",
        skipped: "remove_done",
      }[it.status] || "help";
    }
    function queueStatusColor(it) {
      return {
        pending: "grey-5", running: "green-4", done: "green-6", failed: "red-4", skipped: "grey-6",
      }[it.status] || "grey-5";
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

    // Remote is a three-state button rather than a toggle, because "on" and "a phone is
    // actually attached" are different facts and conflating them is how someone walks
    // away believing they are reachable when nothing is listening.
    function toggleRemote() {
      if (!ws) return;
      if (remoteEnabled.value) {
        // Already on: show the code again rather than tearing it down. Turning it off is
        // a deliberate act inside the dialog, so a mis-click can't drop a live phone.
        remoteDialog.value = true;
        ws.send(JSON.stringify({ type: "remote_pair" }));
        return;
      }
      remoteBusy.value = true;
      remotePairingUri.value = "";
      remoteDialog.value = true;
      ws.send(JSON.stringify({ type: "set_remote", value: true }));
    }

    function disableRemote() {
      remoteDialog.value = false;
      remotePairingUri.value = "";
      if (ws) ws.send(JSON.stringify({ type: "set_remote", value: false }));
    }

    async function copyPairingUri() {
      try {
        await navigator.clipboard.writeText(remotePairingUri.value);
        notifySuccess("Pairing link copied");
      } catch {
        notifyError("Could not copy the pairing link");
      }
    }

    function sendAutoApprove(val) {
      if (ws) ws.send(JSON.stringify({ type: "set_autoapprove", value: val }));
      // Remember it for next time. Without this the toggle is per-socket, so a refresh or a
      // second window starts over - the "sometimes auto-approve does not work" bug.
      saveAIAutoApprove(!!val).catch(() => {
        notifyError("Auto-approve is on for this window, but could not be saved as your default.");
      });
    }

    function applyTarget(val) {
      if (!val || String(val).startsWith("_hdr_")) return;
      if (String(val).startsWith("group:")) {
        const id = Number(String(val).slice(6));
        selectedGroup.value = id;
        saveTarget(id, null);
        if (ws && connected.value) {
          ws.send(JSON.stringify({ type: "set_group", group_id: id }));
        } else {
          connect({ group_id: id });
        }
        return;
      }
      if (String(val).startsWith("model:")) {
        const mid = String(val).slice(6);
        selectedGroup.value = null;
        selectedModel.value = mid;
        saveTarget(null, mid);
        if (ws && connected.value) {
          // Drop the team first, then switch the single model. Two frames, one intent.
          ws.send(JSON.stringify({ type: "set_group", group_id: null }));
          ws.send(JSON.stringify({ type: "set_model", model_id: mid }));
        } else {
          connect({ model_id: mid, group_id: null });
        }
      }
    }

    function onTargetChange(val) {
      applyTarget(val);
    }

    function startNewChat() {
      if (selectedGroup.value != null) connect({ group_id: selectedGroup.value });
      else connect({ model_id: selectedModel.value, group_id: null });
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
      compacting,
      compactWindow,
      clearConfirm,
      clearNote,
      summarizeClear,
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
      windowCost,
      windowTurns,
      windowScope,
      // prompt queue
      queueOpen,
      queueOverlay,
      queueItems,
      queueAuto,
      queueAutoClear,
      queuePaused,
      queueRunningId,
      queuePending,
      queueNew,
      queueNewCompact,
      queueEditId,
      queueEditText,
      queueAdd,
      queueSetAuto,
      queueSetAutoClear,
      queuePause,
      queueResume,
      queueRunNext,
      queueClearDone,
      queueClearAll,
      queueRemove,
      queueSetStatus,
      queueToggleCompact,
      queueStartEdit,
      queueSaveEdit,
      queueMove,
      queueStatusIcon,
      queueStatusColor,
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
      targetOptions,
      selectedTarget,
      onTargetChange,
      autoApprove,
      autoapproveAllowed,
      readOnly,
      allowEmail,
      sendAllowEmail,
      autocredentialAllowed,
      autoCredential,
      sendAutoCredential,
      remoteAllowed,
      remoteEnabled,
      remoteState,
      remoteDevice,
      remoteDevices,
      remoteBusy,
      remoteLabel,
      remoteDialog,
      remotePairingUri,
      remoteQr,
      toggleRemote,
      disableRemote,
      copyPairingUri,
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
      startNewChat,
      // slash commands
      cmdMatches,
      cmdIndex,
      cmdDismissed,
      cmdState,
      applyCommand,
      onEnter,
      onCmdTab,
      onCmdArrow,
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
.pichat :deep(.q-toolbar) {
  flex-wrap: nowrap;
}
.pi-title {
  min-width: 0;
  flex: 1 1 160px;
  overflow: hidden;
}
.pi-label-input {
  flex: 0 1 200px;
}
.pi-target-select {
  flex: 0 0 200px;
  width: 200px;
  max-width: 200px;
}
.pi-target-select :deep(.q-field__native),
.pi-target-select :deep(.q-field__label),
.pi-target-select :deep(.q-field__control) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pi-body {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: row;
  position: relative;
}
.pi-main {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.pi-messages {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}
/* Prompt queue panel: a column to the right of the chat ... */
.pi-queue {
  flex: 0 0 400px;
  width: 400px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #3a3a3a;
}
/* ... or, when the window is too narrow to share, floating over it. */
.pi-queue--overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(440px, 100%);
  z-index: 5;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.5);
}
.pi-queue-head {
  border-bottom: 1px solid #3a3a3a;
}
.pi-queue-paused {
  background: rgba(255, 152, 0, 0.12);
  border: 1px solid rgba(255, 152, 0, 0.5);
  border-radius: 6px;
}
.pi-queue-list {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}
.pi-queue-item {
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  background: #262626;
}
.pi-queue-item--running {
  border-color: #4caf50;
}
.pi-queue-item--failed {
  border-color: #e53935;
}
.pi-queue-text {
  cursor: text;
  word-break: break-word;
}
.pi-queue-tools {
  opacity: 0.55;
}
.pi-queue-item:hover .pi-queue-tools {
  opacity: 1;
}
.pi-user-row {
  display: flex;
  justify-content: flex-end;
}
.pi-user-wrap {
  max-width: min(85%, 56rem);
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.pi-bubble {
  max-width: min(85%, 56rem);
  width: fit-content;
  padding: 8px 12px;
  border-radius: 10px;
  overflow-wrap: break-word;
  word-break: normal;
}
.pi-user-wrap .pi-bubble {
  max-width: 100%;
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
.pi-cmd-menu {
  position: absolute;
  bottom: 100%;
  left: 8px;
  right: 8px;
  max-height: 320px;
  overflow: auto;
  border: 1px solid #455a64;
  border-radius: 4px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.5);
  z-index: 10;
}
.pi-cmd-item {
  padding: 6px 10px;
  cursor: pointer;
  border-bottom: 1px solid #263238;
}
.pi-cmd-item:last-of-type {
  border-bottom: none;
}
.pi-cmd-active {
  background: #37474f;
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
