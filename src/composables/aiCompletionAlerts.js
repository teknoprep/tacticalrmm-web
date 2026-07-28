import { computed, ref, watch } from "vue";

const STORAGE_KEY = "trmm.aiCompletionAlerts.v1";
const DEFAULTS = {
  sound: true,
  desktop: false,
  onlyWhenUnfocused: true,
};

function loadPreferences() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULTS, ...saved };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export function useAICompletionAlerts() {
  const preferences = loadPreferences();
  const soundEnabled = ref(!!preferences.sound);
  const desktopEnabled = ref(!!preferences.desktop);
  const onlyWhenUnfocused = ref(preferences.onlyWhenUnfocused !== false);
  const notificationSupported = typeof window !== "undefined" && "Notification" in window;
  const notificationPermission = ref(
    notificationSupported ? window.Notification.permission : "unsupported",
  );
  // A saved preference must not pretend notifications are active after the
  // operator revokes permission in browser settings.
  if (notificationPermission.value !== "granted") desktopEnabled.value = false;

  let audioContext = null;
  let lastCompletionKey = null;

  watch(
    [soundEnabled, desktopEnabled, onlyWhenUnfocused],
    () => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            sound: soundEnabled.value,
            desktop: desktopEnabled.value,
            onlyWhenUnfocused: onlyWhenUnfocused.value,
          }),
        );
      } catch (e) {
        // A locked-down browser may deny localStorage. Alerts still work for this tab.
      }
    },
    { immediate: true },
  );

  const desktopStatus = computed(() => {
    if (!notificationSupported) return "Desktop notifications are not supported by this browser.";
    if (notificationPermission.value === "denied")
      return "Desktop notifications are blocked in this browser's site settings.";
    if (notificationPermission.value === "granted")
      return desktopEnabled.value
        ? "Desktop notifications are enabled."
        : "Permission granted; notifications are currently off.";
    return "The browser will ask for permission when enabled.";
  });

  function getAudioContext() {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audioContext = new AudioContext();
    }
    return audioContext;
  }

  // Call during a click/key action so browsers permit sounds later, when the
  // asynchronous AI response finishes and the page no longer has user activation.
  function primeAudio() {
    if (!soundEnabled.value) return;
    try {
      const ctx = getAudioContext();
      if (ctx?.state === "suspended") ctx.resume().catch(() => {});
    } catch (e) {
      // Sound is a convenience; it must never interfere with sending a prompt.
    }
  }

  function playDing({ force = false } = {}) {
    if (!force && !soundEnabled.value) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const play = () => {
        const start = ctx.currentTime;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        gain.connect(ctx.destination);

        // A short, friendly two-note completion chime with no external audio asset.
        [
          { frequency: 880, offset: 0, duration: 0.16 },
          { frequency: 1174.66, offset: 0.14, duration: 0.27 },
        ].forEach(({ frequency, offset, duration }) => {
          const oscillator = ctx.createOscillator();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, start + offset);
          oscillator.connect(gain);
          oscillator.start(start + offset);
          oscillator.stop(start + offset + duration);
        });
      };
      if (ctx.state === "suspended") ctx.resume().then(play).catch(() => {});
      else play();
    } catch (e) {
      // Never let an unavailable audio device affect the chat session.
    }
  }

  async function setDesktopEnabled(value) {
    if (!value) {
      desktopEnabled.value = false;
      return true;
    }
    if (!notificationSupported) {
      desktopEnabled.value = false;
      return false;
    }
    try {
      let permission = window.Notification.permission;
      if (permission === "default") permission = await window.Notification.requestPermission();
      notificationPermission.value = permission;
      desktopEnabled.value = permission === "granted";
      return desktopEnabled.value;
    } catch (e) {
      desktopEnabled.value = false;
      return false;
    }
  }

  function showDesktopNotification({ title, body, key, force = false }) {
    if (!notificationSupported || window.Notification.permission !== "granted") return;
    if (!force && !desktopEnabled.value) return;
    if (
      !force &&
      onlyWhenUnfocused.value &&
      !document.hidden &&
      document.hasFocus()
    ) return;

    try {
      const notification = new window.Notification(title, {
        body,
        tag: `trmm-ai-complete-${key}`,
        renotify: false,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      // Some managed browsers expose Notification but disallow constructing one.
    }
  }

  function finished({ kind, hostname, key }) {
    // agent_end should arrive once per turn, but this also protects against a
    // duplicated WebSocket event without suppressing later turns.
    if (key && key === lastCompletionKey) return;
    lastCompletionKey = key || `completion-${Date.now()}`;

    const isDecision = kind === "decision";
    const title = isDecision ? "AI Decision finished" : "Pi Chat finished";
    const body = isDecision
      ? "The AI has finished working and is ready for review."
      : `The AI has finished working${hostname ? ` on ${hostname}` : ""}.`;

    playDing();
    showDesktopNotification({ title, body, key: lastCompletionKey });
  }

  function test() {
    playDing({ force: true });
    showDesktopNotification({
      title: "AI completion alerts",
      body: "The completion ding and desktop notification are working.",
      key: `test-${Date.now()}`,
      force: desktopEnabled.value,
    });
  }

  return {
    soundEnabled,
    desktopEnabled,
    onlyWhenUnfocused,
    notificationSupported,
    notificationPermission,
    desktopStatus,
    primeAudio,
    setDesktopEnabled,
    finished,
    test,
  };
}
