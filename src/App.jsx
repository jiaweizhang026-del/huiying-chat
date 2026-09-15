import React, { useState, useEffect, useRef } from "react";
import {
  scheduleSave,
  flushSave,
  subscribeSave,
  hasUnsavedChanges,
  recoveryBackup,
} from "./persistence.js";
import {
  ArrowUp,
  Check,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Sparkles,
  ImagePlus,
  Heart,
  MessageCircle,
  Plus,
  Settings,
  LogOut,
  Hand,
  LoaderCircle,
} from "lucide-react";
import {
  asset,
  people,
  discoverIds,
  uid,
  dayKey,
  defaultSettings,
  circleCropClass,
} from "./data.js";

import { CommunityFeed, CommentComposer } from "./Community.jsx";
import { Planet, Encounter } from "./Explore.jsx";
import { rankCharacters } from "./community-data.js";
import communityAssets from "./community-assets.json";
import {
  Onboarding,
  CreateCompanion,
  CreatedNote,
  ConversationMenu,
} from "./Companion.jsx";
import { customPerson } from "../shared/custom-characters.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const personById = (id) => people.find((p) => p.id === id) || people[1];
// How far the discover list has to be scrolled before the Hi sphere folds
// itself away. The sphere is rotate-only, so scrolling the cards is the one
// and only dismiss gesture; a short travel keeps that dismiss easy to reach
// while still being clearly deliberate rather than scroll jitter.
const FOLD_SCROLL = 44;
const clock = (t) =>
  new Date(t).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
function Photo({ src, alt = "", className = "", ...props }) {
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <span className={`photo ${ready ? "ready" : ""} ${className}`} {...props}>
      {failed ? (
        <span className="image-fallback">◌</span>
      ) : (
        <img
          src={src}
          alt={alt}
          draggable="false"
          onLoad={() => setReady(true)}
          onError={() => {
            setFailed(true);
            setReady(true);
          }}
        />
      )}
    </span>
  );
}
// Avatars appear in two frame shapes: the design's rounded squares
// (conversation list, message bubbles, profile rows, moments) and circles
// (discover cards, the profile portrait). Some avatar files are circle
// crops, which sit exactly in a circular frame but leave non-photo notches
// in a square one, so the fill fix is asked for only when not round.
function Avatar({ src, alt = "", round = false, className = "", ...props }) {
  return (
    <Photo
      src={src}
      alt={alt}
      className={[round ? "" : circleCropClass(src), className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
function Icon({ name, size = 24 }) {
  return (
    <img
      className="design-icon"
      src={asset(name)}
      width={size}
      height={size}
      alt=""
    />
  );
}
function IconButton({ label, children, onClick, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
function Tags({ values }) {
  return (
    <div className="tags">
      {values.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
function Header({ title, onBack, right, onTitle }) {
  return (
    <header className="header">
      {onBack ? (
        <IconButton label="返回" onClick={onBack}>
          <Icon name="s1-imgLine" />
        </IconButton>
      ) : (
        <span />
      )}
      {onTitle ? (
        <button className="header-title" onClick={onTitle}>
          {title}
        </button>
      ) : (
        <h1>{title}</h1>
      )}
      <div className="header-right">{right}</div>
    </header>
  );
}
function Sheet({ title, onClose, children, className = "", heading }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const root = ref.current;
    root?.querySelector("button,input,textarea")?.focus();
    function key(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = [
          ...root.querySelectorAll(
            'button:not(:disabled),input,textarea,[tabindex="0"]',
          ),
        ];
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <h2>{heading || title}</h2>
          <IconButton label="关闭" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}
function SettingRow({ label, value, onClick }) {
  return (
    <button className="setting-row" onClick={onClick}>
      <span>{label}</span>
      <span className="row-value">
        {value}
        <ChevronRight size={18} />
      </span>
    </button>
  );
}
// The landing art is a still photo; these layers give it life without
// swapping the artwork: three heavily blurred cloud bands drifting at
// different speeds, two out-of-focus light orbs breathing on their own
// cycles, and a soft caustic sheen. Everything light-bearing is blurred
// well past legibility on purpose — the brief is breathing-room and haze,
// not visible shapes. All are decorative and animation-only, so
// prefers-reduced-motion parks them.
function SceneLayers() {
  return (
    <div className="scene-layers" aria-hidden="true">
      <span className="cloud cloud-a" />
      <span className="cloud cloud-b" />
      <span className="cloud cloud-c" />
      <span className="scene-glow" />
      <span className="light-orb orb-a" />
      <span className="light-orb orb-b" />
      <span className="water-sheen" />
    </div>
  );
}
async function shrinkImage(file) {
  if (!file?.type.startsWith("image/")) throw new Error("请选择图片文件");
  if (file.size > 12 * 1024 * 1024) throw new Error("请选择小于 12 MB 的图片");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    // A fresh canvas is transparent, and JPEG has no alpha channel — so
    // every transparent pixel would encode as pure black. Transparent PNGs
    // (screenshots, stickers, logos) are common enough that skipping this
    // turns an ordinary share into a solid black block. Paint white first
    // so transparency flattens the way it does in any image viewer.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const communityUI = {
  Header,
  IconButton,
  Icon,
  Avatar,
  Photo,
  Tags,
  personById,
  Sheet,
};
export default function App({ initialData }) {
  const [data, setData] = useState(initialData),
    dataRef = useRef(data);
  const personById = (id) => {
    const custom = (dataRef.current.customCharacters || []).find(
      (p) => p.id === id,
    );
    return custom
      ? customPerson(custom, asset("s1-imgRectangle5"))
      : people.find((p) => p.id === id) || people[1];
  };
  const communityUI = {
    Header,
    IconButton,
    Icon,
    Avatar,
    Photo,
    Tags,
    personById,
    Sheet,
  };
  const needsOnboarding = data.onboardingComplete === false;
  const [nav, setNav] = useState([
    {
      page: data.loggedIn
        ? needsOnboarding
          ? "onboarding"
          : "conversations"
        : "welcome",
    },
  ]);
  const route = nav.at(-1),
    page = route.page,
    person = personById(route.person),
    pid = person.id;
  const [sheet, setSheet] = useState(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState({}),
    busyRef = useRef({});
  const [config, setConfig] = useState({ configured: false, mode: "checking" }),
    [width, setWidth] = useState(402);
  const [expanded, setExpanded] = useState({}),
    [emoji, setEmoji] = useState(0),
    [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]),
    [suggesting, setSuggesting] = useState(false),
    [suggestionError, setSuggestionError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false),
    [lightbox, setLightbox] = useState(null),
    [newMessages, setNewMessages] = useState(false);
  // One-shot white bloom that greets the user on the landing screen. It is
  // purely decorative: it plays once when the welcome screen first mounts
  // and then stays mounted only until its animation has finished.
  const [landed, setLanded] = useState(!data.loggedIn);
  const [syncStatus, setSyncStatus] = useState({ saving: false, error: null });
  const [publishing, setPublishing] = useState(false),
    [publishError, setPublishError] = useState("");
  const pendingPostId = useRef(null);
  const [communityScope, setCommunityScope] = useState("friends");
  const [planetOpen, setPlanetOpen] = useState(true),
    [encounter, setEncounter] = useState(null);
  const discoverListRef = useRef(null);
  const [menu, setMenu] = useState(null),
    [created, setCreated] = useState(null);
  const emptyCompanion = () => ({
    id: "custom-" + uid(),
    name: "",
    gender: "",
    setting: "",
    style: "",
    relationship: "",
    avatar: "",
  });
  const [companionDraft, setCompanionDraft] = useState(emptyCompanion);
  const longPress = useRef(null),
    longPressed = useRef(false);
  useEffect(() => () => clearTimeout(longPress.current), []);
  function createCompanion() {
    setMenu(null);
    go({
      page: "create",
      onboarding: needsOnboarding || page === "onboarding",
    });
  }
  function chooseCompanion() {
    setMenu(null);
    if (discoverListRef.current) discoverListRef.current.scrollTop = 0;
    setPlanetOpen(true);
    go({
      page: "discover",
      onboarding: needsOnboarding || page === "onboarding",
    });
  }
  async function saveCompanion() {
    const p = {
      ...companionDraft,
      name: companionDraft.name.trim(),
      setting: companionDraft.setting.trim(),
    };
    update((d) => ({
      ...d,
      customCharacters: [
        ...(d.customCharacters || []).filter((x) => x.id !== p.id),
        p,
      ],
      contacts: d.contacts.includes(p.id) ? d.contacts : [...d.contacts, p.id],
    }));
    await flushSave();
    setCreated(customPerson(p, asset("s1-imgRectangle5")));
  }
  function chatMenu(event, id) {
    event.preventDefault();
    const shell = event.currentTarget
      .closest(".app-shell")
      .getBoundingClientRect();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ id, y: Math.min(rect.bottom - shell.top, shell.height - 110) });
  }
  const planetStage = useRef(null),
    planetIcon = useRef(null);
  const [commentPost, setCommentPost] = useState(null);
  const commentDrafts = useRef({});
  const ranked = rankCharacters(
    data,
    people.filter((p) => p.interests),
  );
  const [formText, setFormText] = useState(""),
    [postPhotos, setPostPhotos] = useState([]),
    [uploading, setUploading] = useState(false);
  const chatRef = useRef(null),
    inputRef = useRef(null),
    bottomRef = useRef(null),
    nearBottom = useRef(true),
    highlightedRef = useRef(null),
    imageInput = useRef(null),
    fileTarget = useRef("chat");
  const liveMessages = data.chats[pid] || [],
    prefs = { ...defaultSettings, ...data.settings[pid] };
  const draft = data.drafts[pid] || "";
  const flash = (message) => {
    setToast(message);
  };
  function update(fn) {
    const next = fn(dataRef.current);
    dataRef.current = next;
    setData(next);
    scheduleSave(next);
  }
  function go(next) {
    setToast("");
    setQuery("");
    setSheet(null);
    setNav((n) => [...n, next]);
  }
  function back() {
    setQuery("");
    setSheet(null);
    setNav((n) =>
      n.length > 1 ? n.slice(0, -1) : [{ page: "conversations" }],
    );
  }
  function tab(next) {
    setToast("");
    setQuery("");
    setMenu(null);
    if (next === "discover") {
      if (discoverListRef.current) discoverListRef.current.scrollTop = 0;
      setPlanetOpen(true);
    }
    setNav([{ page: next }]);
  }
  function changeDraft(value) {
    update((d) => ({ ...d, drafts: { ...d.drafts, [pid]: value } }));
  }
  function openChat(id) {
    update((d) => ({
      ...d,
      onboardingComplete: true,
      hiddenChats: (d.hiddenChats || []).filter((x) => x !== id),
      contacts: d.contacts.includes(id) ? d.contacts : [...d.contacts, id],
      chats: {
        ...d.chats,
        [id]: d.chats[id] || [
          {
            id: "opening-" + id,
            role: "assistant",
            text: personById(id).greeting,
            time: Date.now(),
            opening: true,
          },
        ],
      },
    }));
    setQuery("");
    setSheet(null);
    setNav([{ page: "conversations" }, { page: "chat", person: id }]);
  }
  function setPref(key, value) {
    update((d) => ({
      ...d,
      settings: { ...d.settings, [pid]: { ...d.settings[pid], [key]: value } },
    }));
    setSheet(null);
  }
  function append(id, message) {
    update((d) => ({
      ...d,
      chats: { ...d.chats, [id]: [...(d.chats[id] || []), message] },
    }));
  }
  // The model can't see images, so a sent photo would otherwise vanish into
  // the chat log. Mirror it into "与他的记忆" in the same update as the chat
  // message: same-day photos are merged into one entry (up to the 3 the
  // collage layout can show) so a batch of photos reads as one shared
  // moment instead of several near-identical entries.
  function rememberPhoto(id, image) {
    const today = dayKey();
    update((d) => {
      const list = d.memories[id] || [];
      const openSlot = list.findIndex(
        (m) =>
          m.date === today &&
          m.photoMemory &&
          (m.photos || []).length < 3 &&
          !m.seed,
      );
      const merged =
        openSlot === -1
          ? [
              {
                id: uid(),
                date: today,
                text: `你分享了一张照片给${personById(id).name}。`,
                emoji: "📷",
                photos: [image],
                photoMemory: true,
                source: "聊天图片",
              },
              ...list,
            ]
          : list.map((m, i) =>
              i === openSlot
                ? {
                    ...m,
                    photos: [...m.photos, image],
                    text: `你分享了 ${m.photos.length + 1} 张照片给${personById(id).name}。`,
                  }
                : m,
            );
      return {
        ...d,
        chats: {
          ...d.chats,
          [id]: [
            ...(d.chats[id] || []),
            {
              id: uid(),
              role: "user",
              text: "[图片]",
              image,
              time: Date.now(),
            },
          ],
        },
        memories: { ...d.memories, [id]: merged },
      };
    });
  }
  useEffect(() => {
    nearBottom.current = true;
    setNewMessages(false);
  }, [route]);
  useEffect(() => subscribeSave(setSyncStatus), []);
  useEffect(() => {
    function guard(e) {
      if (hasUnsavedChanges() || Object.values(busyRef.current).some(Boolean)) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setConfig)
      .catch(() => setConfig({ mode: "offline", configured: false }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  // The bloom is a one-shot flourish; unmount it once it has played so it
  // never repaints behind later interactions.
  useEffect(() => {
    if (!landed) return;
    const t = setTimeout(() => setLanded(false), 5800);
    return () => clearTimeout(t);
  }, [landed]);
  // The sphere folds into the corner icon on swipe-up, so its shrink origin
  // has to land exactly on that icon. Measured rather than hard-coded because
  // the preview frame is resizable (375/402/430) and the icon rides the
  // header's right edge.
  useEffect(() => {
    const stage = planetStage.current,
      icon = planetIcon.current;
    if (!stage || !icon || page !== "discover") return;
    const inner = stage.getBoundingClientRect(),
      point = icon.getBoundingClientRect();
    stage.style.setProperty(
      "--collapse-origin",
      `${(point.left - inner.left + point.width / 2).toFixed(1)}px ${(point.top - inner.top + point.height / 2).toFixed(1)}px`,
    );
  }, [page, width, planetOpen]);
  // Pulling the corner icon down grows the sphere back out of it. The click
  // handler also expands, so the gesture is an enhancement rather than the
  // only way in.
  const iconPull = useRef({ from: null, moved: 0 });
  function planetIconDown(e) {
    if (planetOpen) return;
    iconPull.current = { from: e.clientY, moved: 0 };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer already gone */
    }
  }
  function planetIconMove(e) {
    const pull = iconPull.current;
    if (pull.from === null || planetOpen) return;
    pull.moved = e.clientY - pull.from;
  }
  function planetIconUp() {
    const pull = iconPull.current;
    if (pull.from === null) return;
    const pulledDown = pull.moved > 26;
    iconPull.current = { from: null, moved: 0 };
    if (pulledDown) {
      setToast("");
      setPlanetOpen(true);
    }
  }
  useEffect(() => {
    if (!Object.values(busy).some(Boolean)) return;
    const t = setInterval(() => setEmoji((e) => (e + 1) % 3), 650);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => {
    if (page !== "chat") return;
    // The highlight is a one-shot "jump here from search" affordance tied
    // to a specific message id. Only act on it the first time we see this
    // particular id — otherwise this effect (which also re-runs whenever
    // liveMessages.length/busy changes, e.g. on every new message) would
    // keep yanking the view back to that old message forever instead of
    // following the latest message, since route.highlight itself is never
    // cleared. Once handled, fall through so subsequent runs behave like
    // normal and respect the user's actual current scroll position.
    if (route.highlight && highlightedRef.current !== route.highlight) {
      highlightedRef.current = route.highlight;
      requestAnimationFrame(() =>
        document
          .getElementById("message-" + route.highlight)
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      return;
    }
    if (nearBottom.current) {
      bottomRef.current?.scrollIntoView({
        behavior: liveMessages.length > 1 ? "smooth" : "instant",
        block: "end",
      });
    } else setNewMessages(true);
  }, [liveMessages.length, busy[pid], expanded, page, pid, route.highlight]);
  useEffect(() => {
    function escape(e) {
      if (e.key === "Escape" && lightbox) setLightbox(null);
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [lightbox]);
  useEffect(() => {
    const vp = window.visualViewport;
    function resize() {
      document.documentElement.style.setProperty(
        "--viewport-height",
        `${vp?.height || window.innerHeight}px`,
      );
    }
    resize();
    vp?.addEventListener("resize", resize);
    return () => vp?.removeEventListener("resize", resize);
  }, []);

  async function request(task, id, messages) {
    await flushSave();
    const state = dataRef.current;
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(50000),
      body: JSON.stringify({
        task,
        person: id,
        settings: { ...defaultSettings, ...state.settings[id] },
        messages: messages
          .filter((m) => m.role !== "system" && !m.image)
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.text })),
        memories: (state.memories[id] || [])
          .filter((m) => !m.seed)
          .slice(0, 8)
          .map((m) => m.text),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "暂时无法连接，请重试。");
    if (result.mode === "live")
      setConfig((c) => ({
        ...c,
        configured: true,
        mode: "live",
        verifiedAt: result.verifiedAt,
      }));
    return result;
  }
  async function respond(id, messages, userMessageId) {
    if (busyRef.current[id]) return;
    busyRef.current[id] = true;
    setBusy({ ...busyRef.current });
    update((d) => ({
      ...d,
      chats: {
        ...d.chats,
        [id]: d.chats[id].map((m) =>
          m.id === userMessageId ? { ...m, error: undefined } : m,
        ),
      },
    }));
    try {
      const start = Date.now();
      const result = await request("chat", id, messages);
      await sleep(Math.max(0, 1600 - (Date.now() - start)));
      const turnId = uid();
      for (let i = 0; i < result.messages.length; i++) {
        append(id, {
          id: uid(),
          role: "assistant",
          text: result.messages[i],
          time: Date.now(),
          turnId,
          innerVoice:
            i === result.messages.length - 1 ? result.innerVoice : null,
          mode: result.mode,
        });
        if (i < result.messages.length - 1) await sleep(360);
      }
      const lastUser = messages.filter((m) => m.role === "user").at(-1)?.text;
      const memory =
        result.memory ||
        (result.mode === "demo" &&
        lastUser &&
        !/^(你好|嗨|hi|hello)[！!。\s]*$/i.test(lastUser)
          ? `你说：「${lastUser.slice(0, 180)}」`
          : null);
      if (memory)
        update((d) => ({
          ...d,
          memories: {
            ...d.memories,
            [id]: [
              {
                id: uid(),
                date: dayKey(),
                text: memory,
                emoji: "🌿",
                source: result.mode === "demo" ? "聊天摘录" : "AI 整理",
              },
              ...(d.memories[id] || []),
            ],
          },
        }));
      // The AI has already replied. Disk failure is retried via the save banner,
      // not by asking DeepSeek again and duplicating the assistant turn.
      await flushSave().catch(() => {});
    } catch (error) {
      update((d) => ({
        ...d,
        chats: {
          ...d.chats,
          [id]: d.chats[id].map((m) =>
            m.id === userMessageId
              ? {
                  ...m,
                  error:
                    error.name === "TimeoutError"
                      ? "等待超时，点击重试"
                      : error.message,
                }
              : m,
          ),
        },
      }));
    } finally {
      busyRef.current[id] = false;
      setBusy({ ...busyRef.current });
    }
  }
  function send() {
    const text = draft.trim();
    if (!text || busyRef.current[pid]) return;
    if (text.length > 2000) {
      flash("一次最多发送 2000 字");
      return;
    }
    const message = { id: uid(), role: "user", text, time: Date.now() };
    const messages = [...liveMessages, message];
    nearBottom.current = true;
    append(pid, message);
    changeDraft("");
    setSheet(null);
    respond(pid, messages, message.id);
    inputRef.current?.focus();
  }
  async function helpReply() {
    setSheet({ type: "suggestions" });
    setSuggestions([]);
    setSuggestionError("");
    setSuggesting(true);
    const id = pid;
    try {
      const result = await request("suggestions", id, liveMessages);
      setSuggestions(result.suggestions);
    } catch (e) {
      setSuggestionError(e.message);
    } finally {
      setSuggesting(false);
    }
  }
  function pat() {
    append(pid, {
      id: uid(),
      role: "system",
      text: `${data.name} 拍了拍${person.name}，${prefs.pat}`,
      time: Date.now(),
    });
    setSheet(null);
  }
  async function pickFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const image = await shrinkImage(file);
      if (fileTarget.current === "post")
        setPostPhotos((p) => [...p, image].slice(0, 3));
      else {
        rememberPhoto(pid, image);
        setSheet(null);
        flash("图片已存进「与他的记忆」；当前模型不读取图片内容。");
      }
    } catch (error) {
      flash(error.message || "图片读取失败，请换一张试试。");
    } finally {
      setUploading(false);
    }
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "回应-聊天备份.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function voice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      flash("当前浏览器不支持语音输入，请使用文字。");
      return;
    }
    const recognition = new Speech();
    recognition.lang = prefs.language === "English" ? "en-US" : "zh-CN";
    recognition.onresult = (e) =>
      changeDraft(draft + e.results[0][0].transcript);
    recognition.onerror = () => flash("未能识别语音，请检查麦克风权限。");
    recognition.onend = () => setSheet((s) => (s?.type === "voice" ? null : s));
    setSheet({ type: "voice", recognition });
    recognition.start();
  }
  const navItems = [
    ["conversations", "对话", "s2-imgLine2", "s3-imgFill"],
    ["discover", "发现", "s3-imgCustomerDatabase", "s2-imgCustomerDatabase"],
    ["moments", "社区", "s3-imgLine1", "nav-moments-filled"],
    ["me", "我的", "s3-imgLine", "nav-me-filled"],
  ];
  const profileRow = (action) => (
    <button className="profile-row" onClick={action}>
      <Avatar src={person.avatar} alt={person.name} />
      <span>
        <strong>{person.name}</strong>
        <Tags values={person.tags} />
      </span>
      {action && <ChevronRight size={18} />}
    </button>
  );
  const more = (
    <IconButton
      label="聊天设置"
      onClick={() => go({ page: "settings", person: pid })}
    >
      <Icon name="s1-imgLine1" />
    </IconButton>
  );
  const allHistory = liveMessages.filter(
    (m) =>
      m.role !== "system" && m.text.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <main className="workspace">
      <div className="desktop-toolbar">
        <span className="preview-brand">
          回应 <span>实时预览</span>
        </span>
        <div className="size-picker" aria-label="预览宽度">
          {[375, 402, 430].map((w) => (
            <button
              key={w}
              aria-pressed={width === w}
              onClick={() => setWidth(w)}
            >
              {w}
            </button>
          ))}
        </div>
        <button
          className="connection-chip"
          onClick={() => setSheet({ type: "connection" })}
        >
          <span className={config.configured ? "online" : ""} />
          {config.configured
            ? config.verifiedAt
              ? "DeepSeek 已连接"
              : "DeepSeek 待验证"
            : config.mode === "offline"
              ? "服务未连接"
              : "演示模式"}
        </button>
      </div>
      <div className="app-shell" style={{ "--phone-width": `${width}px` }}>
        <div
          className={`screen screen-${page} ${page === "chat" ? "background-" + ({ 原稿灰: "gray", 米白: "cream", 风景: "scenic" }[prefs.background] || "gray") : ""}`}
          key={page + "-" + (route.person || "")}
        >
          {page === "welcome" && (
            <>
              <div className="welcome-illustration">
                <Photo
                  src="/assets/v3-welcome-cat.png"
                  className="welcome-art"
                />
                <div className="welcome-hi" aria-hidden="true">
                  {[
                    ["imgVector5", 8, 0, 14, 72],
                    ["imgVector6", 41, 8, 11, 66],
                    ["imgVector7", 0, 32, 45, 13],
                    ["imgVector8", 66, 38, 8, 33],
                    ["imgEllipse47", 68, 23, 9, 9],
                    ["imgVector9", 96, 33, 59, 20],
                  ].map(([name, x, y, w, h]) => (
                    <img
                      key={name}
                      src={`/assets/v3-welcome-${name}.svg`}
                      style={{
                        left: `${(x / 160) * 100}%`,
                        top: `${(y / 80) * 100}%`,
                        width: `${(w / 160) * 100}%`,
                        height: `${(h / 80) * 100}%`,
                      }}
                      alt=""
                    />
                  ))}
                </div>
              </div>
              <button
                aria-label="应用设置"
                className="welcome-settings glass"
                onClick={() => setSheet({ type: "connection" })}
              >
                <img
                  src="/assets/v3-welcome-imgSetting.svg"
                  width="32"
                  height="32"
                  alt=""
                />
              </button>
              <div className="welcome-copy">
                <h1>
                  Hi {data.name}
                  <br />
                  <span>
                    创建属于你的 <em>TA</em>
                  </span>
                </h1>
                <button
                  className="login-button glass"
                  disabled={loginBusy}
                  onClick={async () => {
                    setLoginBusy(true);
                    await sleep(550);
                    try {
                      update((d) => ({ ...d, loggedIn: true }));
                      await flushSave();
                      setNav([
                        {
                          page: needsOnboarding
                            ? "onboarding"
                            : "conversations",
                        },
                      ]);
                    } catch {
                      flash("登录状态未保存，请重试。");
                    } finally {
                      setLoginBusy(false);
                    }
                  }}
                >
                  {loginBusy ? (
                    <LoaderCircle className="spinning" size={25} />
                  ) : (
                    <Icon name="s0-imgWeixin" size={32} />
                  )}
                  <span>{loginBusy ? "正在进入…" : "微信一键登录"}</span>
                </button>
                <p className="login-note">演示登录，无需微信授权</p>
              </div>
            </>
          )}
          {page === "onboarding" && (
            <Onboarding
              Photo={Photo}
              onCreate={createCompanion}
              onChoose={chooseCompanion}
            />
          )}
          {page === "create" && (
            <CreateCompanion
              ui={communityUI}
              draft={companionDraft}
              onDraft={setCompanionDraft}
              onSave={saveCompanion}
              shrinkImage={shrinkImage}
              onBack={back}
            />
          )}
          {page === "conversations" && (
            <>
              <Header
                title="下午好"
                right={
                  <IconButton label="添加伙伴" onClick={() => setMenu({})}>
                    <Icon name="s3-imgLine2" />
                  </IconButton>
                }
              />
              <div className="scroll-area conversation-list">
                {[...data.contacts]
                  .filter((id) => !(data.hiddenChats || []).includes(id))
                  .sort((a, b) => {
                    const pin =
                      Number((data.pinned || []).includes(b)) -
                      Number((data.pinned || []).includes(a));
                    if (pin) return pin;
                    const last = (id) => data.chats[id]?.at(-1);
                    return (
                      (last(b)?.opening ? 0 : last(b)?.time || 0) -
                      (last(a)?.opening ? 0 : last(a)?.time || 0)
                    );
                  })
                  .map((id) => {
                    const p = personById(id),
                      m = data.chats[id]?.at(-1);
                    return (
                      <button
                        className={
                          "conversation-row" +
                          ((data.pinned || []).includes(id) ? " is-pinned" : "")
                        }
                        key={id}
                        onClick={() => {
                          if (!longPressed.current) openChat(id);
                          longPressed.current = false;
                        }}
                        onContextMenu={(e) => chatMenu(e, id)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "ContextMenu" ||
                            (e.shiftKey && e.key === "F10")
                          )
                            chatMenu(e, id);
                        }}
                        onPointerDown={(e) => {
                          longPressed.current = false;
                          if (e.pointerType === "mouse") return;
                          const target = e.currentTarget;
                          longPress.current = setTimeout(() => {
                            longPressed.current = true;
                            chatMenu(
                              { preventDefault() {}, currentTarget: target },
                              id,
                            );
                          }, 550);
                        }}
                        onPointerUp={() => clearTimeout(longPress.current)}
                        onPointerMove={() => clearTimeout(longPress.current)}
                        onPointerCancel={() => clearTimeout(longPress.current)}
                      >
                        <Avatar src={p.avatar} alt={p.name} />
                        <div className="conversation-copy">
                          <div>
                            <strong>
                              {p.name}
                              {(data.pinned || []).includes(id) && (
                                <small className="pin-label">置顶</small>
                              )}
                            </strong>
                            {m && !m.opening && <time>{clock(m.time)}</time>}
                          </div>
                          <p>
                            {busy[id]
                              ? "对方正在输入…"
                              : m?.image
                                ? "[图片]"
                                : m?.text || "开始聊聊吧"}
                            {/* Every row previews its own last message. A chat
                                nobody has replied to yet therefore shows the
                                character's opening line, which is the honest
                                thing to show — an earlier hardcoded
                                placeholder here made every unstarted chat
                                look identical. */}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                {!data.contacts.some(
                  (id) => !(data.hiddenChats || []).includes(id),
                ) && (
                  <div className="empty-conversations">
                    <p>从一声你好开始。</p>
                    <button className="pill-button" onClick={chooseCompanion}>
                      选择角色
                    </button>
                    <button className="pill-button" onClick={createCompanion}>
                      创建 AI 伙伴
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {page === "discover" && (
            <>
              {/* Fixed scene behind the whole screen: a faint alpha-faded wash
                  of the planet artwork. It stays outside the scroll area, so
                  the cards travel over it — that overlap, rather than a hard
                  image swap, is what makes the background change read as
                  smooth. */}
              <div className="planet-scene" aria-hidden="true">
                <img
                  className="planet-scene-art"
                  src={communityAssets["planet-bg"]}
                  alt=""
                />
              </div>
              <Header
                title="发现"
                onBack={route.onboarding ? back : undefined}
                right={
                  <span
                    className={"planet-toggle" + (planetOpen ? " hidden" : "")}
                    ref={planetIcon}
                  >
                    <IconButton
                      label={planetOpen ? "收起 Hi 星球" : "展开 Hi 人物星球"}
                      inert={planetOpen || undefined}
                      onClick={() => {
                        setToast("");
                        setPlanetOpen(true);
                      }}
                      onPointerDown={planetIconDown}
                      onPointerMove={planetIconMove}
                      onPointerUp={planetIconUp}
                      onPointerCancel={planetIconUp}
                    >
                      <img
                        src={communityAssets["planet-icon"]}
                        width="24"
                        height="24"
                        alt=""
                      />
                    </IconButton>
                  </span>
                }
              />
              <div
                ref={discoverListRef}
                className={
                  "scroll-area discover-list " +
                  (route.onboarding ? "onboarding-discover " : "") +
                  (planetOpen ? "with-planet" : "")
                }
                onScroll={(e) => {
                  const el = e.currentTarget;
                  // The sphere folds away from down here rather than from
                  // its own gesture: scrolling is what the list is for, so
                  // it doubles as the dismiss, and the two halves of the
                  // screen never compete over the same drag. Resetting the
                  // scroll in the same tick means the cards rise into the
                  // space the stage gives up, instead of the list suddenly
                  // showing content from a screen further down.
                  if (!planetOpen || el.scrollTop < FOLD_SCROLL) return;
                  el.scrollTop = 0;
                  setToast("");
                  setPlanetOpen(false);
                }}
              >
                <div
                  className="planet-stage"
                  ref={planetStage}
                  inert={!planetOpen || undefined}
                >
                  <Planet
                    people={ranked}
                    active={planetOpen}
                    onCollapse={() => {
                      setToast("");
                      setPlanetOpen(false);
                    }}
                    onSelect={(p, element) => {
                      const shell = element
                          .closest(".app-shell")
                          .getBoundingClientRect(),
                        point = element.getBoundingClientRect();
                      setEncounter({
                        person: p,
                        origin: {
                          x: point.left - shell.left + point.width / 2,
                          y: point.top - shell.top + point.height / 2,
                        },
                      });
                    }}
                  />
                </div>
                {query && (
                  <div className="search-summary">
                    搜索「{query}」
                    <button onClick={() => setQuery("")}>清除</button>
                  </div>
                )}
                {[
                  ...new Set([
                    ...(data.customCharacters || []).map((p) => p.id),
                    ...(planetOpen
                      ? [...ranked.slice(0, 3).map((p) => p.id), ...discoverIds]
                      : discoverIds),
                  ]),
                ]
                  .map(personById)
                  .filter((p) => (p.name + p.tags.join("")).includes(query))
                  .map((p) => (
                    <button
                      className="discover-card"
                      key={p.id}
                      onClick={() => go({ page: "profile", person: p.id })}
                    >
                      <span className="card-surface" />
                      <Avatar src={p.portrait || p.avatar} alt={p.name} round />
                      <div className="discover-info">
                        <strong>{p.name}</strong>
                        <Tags values={p.tags} />
                      </div>
                      <p>{p.bio}</p>
                    </button>
                  ))}
                {![
                  ...discoverIds,
                  ...ranked.map((p) => p.id),
                  ...(data.customCharacters || []).map((p) => p.id),
                ]
                  .map(personById)
                  .some((p) => (p.name + p.tags.join("")).includes(query)) && (
                  <div className="empty">
                    还没有找到这个人，换个关键词试试。
                  </div>
                )}
                {/* Footnote, not part of the planet scene: the design leaves the
                    artwork clear, so this sits after the list rather than
                    floating over the stars. */}
                <p className="explore-note">
                  根据本地聊天兴趣匹配 · 预设 AI 角色
                </p>
              </div>
            </>
          )}
          {page === "chat" && (
            <>
              <Header
                title={busy[pid] ? "对方正在输入…" : person.name}
                onBack={back}
                onTitle={() => go({ page: "profile", person: pid })}
                right={more}
              />
              <div
                className="chat-scroll"
                ref={chatRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  nearBottom.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                  if (nearBottom.current) setNewMessages(false);
                }}
              >
                <div className="time-label">
                  {liveMessages[0]?.opening
                    ? "8:00"
                    : clock(liveMessages[0]?.time || Date.now())}
                </div>
                {liveMessages.map((m, index) => (
                  <React.Fragment key={m.id}>
                    {m.role === "system" ? (
                      <div className="system-message">{m.text}</div>
                    ) : (
                      <div
                        id={"message-" + m.id}
                        className={`message ${m.role} ${route.highlight === m.id ? "highlighted" : ""}`}
                      >
                        <button
                          className="avatar-button"
                          aria-label={
                            m.role === "user"
                              ? "我的资料"
                              : person.name + "的资料"
                          }
                          onClick={() =>
                            go(
                              m.role === "user"
                                ? { page: "me" }
                                : { page: "profile", person: pid },
                            )
                          }
                        >
                          <Avatar
                            src={
                              m.role === "user"
                                ? asset("s1-imgRectangle5")
                                : person.avatar
                            }
                          />
                        </button>
                        <div className="message-content">
                          <div
                            className={`bubble ${m.image ? "image-bubble" : ""}`}
                          >
                            {m.image ? (
                              <button
                                onClick={() => setLightbox(m.image)}
                                aria-label="查看聊天图片"
                              >
                                <Photo src={m.image} alt="你发送的图片" />
                              </button>
                            ) : (
                              m.text
                            )}
                          </div>
                          {m.error && (
                            <button
                              className="message-error"
                              onClick={() =>
                                respond(
                                  pid,
                                  liveMessages.slice(0, index + 1),
                                  m.id,
                                )
                              }
                              disabled={!!busy[pid]}
                            >
                              {m.error} · 重试
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {m.innerVoice && (
                      <div
                        className={`thought ${expanded[m.id] ? "is-open" : ""}`}
                      >
                        <button
                          className="thought-toggle"
                          aria-expanded={!!expanded[m.id]}
                          onClick={() =>
                            setExpanded((v) => ({ ...v, [m.id]: !v[m.id] }))
                          }
                        >
                          <span>
                            {expanded[m.id] ? "TA 在想 🤔" : "看看 TA 的想法"}
                          </span>
                          <ChevronDown size={14} />
                        </button>
                        {expanded[m.id] && (
                          <div className="thought-body">
                            <p>{m.innerVoice}</p>
                            <small>角色内心旁白 · AI 创作</small>
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                ))}
                {busy[pid] && (
                  <div
                    className="typing-row"
                    role="status"
                    aria-label="对方正在输入"
                  >
                    <Avatar src={person.avatar} />
                    <span className="thinking-emoji" key={emoji}>
                      {["💭", "🤔", "💡"][emoji]}
                    </span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              {newMessages && (
                <button
                  className="new-message"
                  onClick={() => {
                    nearBottom.current = true;
                    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                    setNewMessages(false);
                  }}
                >
                  有新消息 ↓
                </button>
              )}
              <div className="composer frosted-glass">
                <IconButton label="语音输入" onClick={voice}>
                  <Icon name="s1-imgVoiceRound" size={32} />
                </IconButton>
                <textarea
                  ref={inputRef}
                  aria-label="消息"
                  placeholder="说点什么…"
                  value={draft}
                  rows={1}
                  maxLength={2000}
                  onChange={(e) => changeDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <IconButton
                  label="表情"
                  onClick={() => setSheet({ type: "emoji" })}
                >
                  <Icon name="s1-imgEmoji" size={32} />
                </IconButton>
                {draft.trim() ? (
                  <button
                    className="send-button"
                    aria-label="发送消息"
                    onClick={send}
                    disabled={!!busy[pid]}
                  >
                    <ArrowUp size={23} />
                  </button>
                ) : (
                  <IconButton
                    label="更多聊天功能"
                    onClick={() => setSheet({ type: "actions" })}
                  >
                    <Icon name="s1-imgAddRound" size={32} />
                  </IconButton>
                )}
              </div>
            </>
          )}
          {page === "settings" && (
            <>
              <Header
                title="聊天设置"
                onBack={back}
                right={
                  <IconButton
                    label="连接与说明"
                    onClick={() => setSheet({ type: "connection" })}
                  >
                    <Icon name="s1-imgLine1" />
                  </IconButton>
                }
              />
              <div className="scroll-area settings-list">
                {profileRow(() => go({ page: "profile", person: pid }))}
                <div className="setting-group">
                  <SettingRow
                    label="回复模式"
                    onClick={() => setSheet({ type: "mode" })}
                  />
                  <SettingRow
                    label="聊天背景"
                    onClick={() => setSheet({ type: "background" })}
                  />
                  <SettingRow
                    label="语言设置"
                    onClick={() => setSheet({ type: "language" })}
                  />
                </div>
                <div className="setting-group">
                  <SettingRow
                    label="聊天记录"
                    onClick={() => go({ page: "history", person: pid })}
                  />
                </div>
                <div className="setting-group">
                  <SettingRow
                    label="与他的记忆"
                    onClick={() => go({ page: "memory", person: pid })}
                  />
                  <SettingRow
                    label="拍一拍"
                    onClick={() => {
                      setFormText(prefs.pat);
                      setSheet({ type: "pat" });
                    }}
                  />
                </div>
              </div>
            </>
          )}
          {page === "memory" && (
            <>
              <Header
                title="与他的记忆"
                onBack={back}
                right={
                  <IconButton
                    label="记忆说明"
                    onClick={() => setSheet({ type: "memory-info" })}
                  >
                    <Icon name="s1-imgLine1" />
                  </IconButton>
                }
              />
              <div className="scroll-area memory-list">
                {profileRow(() => go({ page: "profile", person: pid }))}
                {(data.memories[pid] || []).map((m, index, list) => (
                  <section className="memory-entry" key={m.id}>
                    {(index === 0 || list[index - 1].date !== m.date) && (
                      <h2>
                        {m.date === dayKey()
                          ? "今天"
                          : m.date
                              .slice(5)
                              .split("-")
                              .map(Number)
                              .join(".")}{" "}
                        <span className="memory-mood" aria-label="当天心情">
                          {m.emoji || "☺️"}
                        </span>
                      </h2>
                    )}
                    <div className="memory-note">
                      <p>{m.text}</p>
                      <button
                        className="memory-delete"
                        aria-label="删除这条记忆"
                        onClick={() => {
                          setSheet({ type: "delete-memory", memory: m });
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {m.photos && (
                      <div
                        className={`memory-collage count-${m.photos.length}`}
                      >
                        {m.photos.map((src, i) => (
                          <button
                            key={src}
                            className={"collage-" + i}
                            onClick={() => setLightbox(src)}
                            aria-label="查看记忆照片"
                          >
                            <Photo src={src} alt="共同记忆里的风景" />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
                {!(data.memories[pid] || []).length && (
                  <div className="empty">
                    <span>🌱</span>
                    <p>你们的故事，从这里开始。</p>
                    <small>聊过的小事会慢慢留在这里。</small>
                    <button
                      className="quiet-button"
                      onClick={() => openChat(pid)}
                    >
                      去聊聊
                    </button>
                  </div>
                )}
                <p className="memory-footnote">
                  示例回忆仅用于演示。新的聊天摘录 / AI 记忆保存在本机。
                </p>
              </div>
            </>
          )}
          {page === "history" && (
            <>
              <Header title="聊天记录" onBack={back} />
              <div className="search-box">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索聊天内容"
                  aria-label="搜索聊天记录"
                />
                {query && (
                  <IconButton label="清除搜索" onClick={() => setQuery("")}>
                    <X size={16} />
                  </IconButton>
                )}
              </div>
              <div className="scroll-area history-list">
                {allHistory.map((m, i) => (
                  <React.Fragment key={m.id}>
                    {(i === 0 ||
                      dayKey(m.time) !== dayKey(allHistory[i - 1].time)) && (
                      <h2>
                        {dayKey(m.time) === dayKey() ? "今天" : dayKey(m.time)}
                      </h2>
                    )}
                    <button
                      className="history-result"
                      onClick={() =>
                        setNav([
                          { page: "conversations" },
                          { page: "chat", person: pid, highlight: m.id },
                        ])
                      }
                    >
                      <Avatar
                        src={
                          m.role === "user"
                            ? asset("s1-imgRectangle5")
                            : person.avatar
                        }
                      />
                      <span>
                        <strong>
                          {m.role === "user" ? data.name : person.name}
                          <time>{clock(m.time)}</time>
                        </strong>
                        <p>{m.text}</p>
                      </span>
                    </button>
                  </React.Fragment>
                ))}
                {!allHistory.length && (
                  <div className="empty">没有找到相关聊天记录。</div>
                )}
              </div>
            </>
          )}
          {page === "profile" && (
            <>
              <Header
                title="个人资料"
                onBack={back}
                right={
                  <IconButton
                    label={
                      person.setting
                        ? "编辑伙伴资料"
                        : data.contacts.includes(pid)
                          ? "已添加，查看角色设置"
                          : "添加 AI 好友"
                    }
                    onClick={() => {
                      if (person.setting) {
                        setCompanionDraft({
                          ...data.customCharacters.find((p) => p.id === pid),
                        });
                        go({ page: "create", onboarding: needsOnboarding });
                      } else if (data.contacts.includes(pid))
                        go({ page: "settings", person: pid });
                      else {
                        update((d) => ({
                          ...d,
                          contacts: [...d.contacts, pid],
                        }));
                        flash("已添加 " + person.name);
                      }
                    }}
                  >
                    {data.contacts.includes(pid) ? (
                      <Check size={22} />
                    ) : (
                      <Icon name="s3-imgLine2" />
                    )}
                  </IconButton>
                }
              />
              <div className="scroll-area profile-page">
                <Avatar
                  src={person.portrait || person.avatar}
                  alt={person.name}
                  className="profile-portrait"
                  round
                />
                <h2>{person.name}</h2>
                <Tags values={person.tags.map((t) => "#" + t)} />
                <p className="profile-bio">{person.bio}</p>
                <div className="profile-section">
                  <h3>关于 TA</h3>
                  <p>
                    {person.setting ||
                      "一个可以听你说日常、也愿意分享小事的 AI 角色。不必找一个特别的话题，想到什么，都可以说。"}
                  </p>
                  {person.style && <p>表达风格：{person.style}</p>}
                  {person.relationship && (
                    <p>与你的关系：{person.relationship}</p>
                  )}
                </div>
                <SettingRow
                  label="一起留下的记忆"
                  onClick={() => go({ page: "memory", person: pid })}
                />
                <SettingRow
                  label="聊天记录"
                  onClick={() => go({ page: "history", person: pid })}
                />
                <p className="muted-note">虚构 AI 角色，不是真实人物。</p>
              </div>
              <button
                className="profile-chat frosted-glass"
                onClick={() => openChat(pid)}
              >
                和 TA 聊聊
              </button>
            </>
          )}
          {page === "moments" && (
            <CommunityFeed
              data={data}
              scope={communityScope}
              onScope={(scope) => {
                setToast("");
                setCommunityScope(scope);
              }}
              update={update}
              ui={communityUI}
              onPublish={() => {
                setFormText("");
                setPostPhotos([]);
                pendingPostId.current = null;
                setPublishError("");
                setSheet({ type: "post", scope: communityScope });
              }}
              onProfile={(id) =>
                id === "me" ? tab("me") : go({ page: "profile", person: id })
              }
              onChat={openChat}
              onPhoto={setLightbox}
              onComment={setCommentPost}
            />
          )}
          {page === "me" && (
            <>
              <Header
                title="我的"
                right={
                  <IconButton
                    label="连接设置"
                    onClick={() => setSheet({ type: "connection" })}
                  >
                    <Settings size={22} />
                  </IconButton>
                }
              />
              <div className="scroll-area me-page">
                <button
                  className="me-profile"
                  onClick={() => {
                    setFormText(data.name);
                    setSheet({ type: "name" });
                  }}
                >
                  <Avatar src={asset("s1-imgRectangle5")} />
                  <div>
                    <h2>{data.name}</h2>
                    <p>{data.bio}</p>
                  </div>
                  <ChevronRight size={18} />
                </button>
                <div className="setting-group">
                  <SettingRow
                    label="AI 连接"
                    value={config.configured ? "DeepSeek" : "演示模式"}
                    onClick={() => setSheet({ type: "connection" })}
                  />
                  <SettingRow label="我的日常" onClick={() => tab("moments")} />
                  <SettingRow label="导出聊天与记忆" onClick={exportData} />
                  <SettingRow
                    label="数据与隐私"
                    onClick={() => setSheet({ type: "privacy" })}
                  />
                </div>
                <button
                  className="logout-button"
                  onClick={() => {
                    update((d) => ({ ...d, loggedIn: false }));
                    setNav([{ page: "welcome" }]);
                    setLanded(true);
                  }}
                >
                  <LogOut size={16} />
                  返回欢迎页
                </button>
                <button
                  className="logout-button"
                  onClick={() => go({ page: "onboarding" })}
                >
                  体验首次相遇
                </button>
                <p className="me-signature">
                  随时随地，获得回应。<span>回应 · 本地演示版 0.1</span>
                </p>
              </div>
            </>
          )}
        </div>
        {!route.onboarding &&
          ["conversations", "discover", "moments", "me"].includes(page) && (
            <nav className="bottom-nav frosted-glass" aria-label="主导航">
              <span
                className="nav-indicator"
                style={{
                  transform: `translateX(${navItems.findIndex((n) => n[0] === page) * 100}%)`,
                }}
              />
              {navItems.map(([key, label, lineIcon, fillIcon]) => (
                <button
                  key={key}
                  className={page === key ? "selected" : ""}
                  aria-current={page === key ? "page" : undefined}
                  data-icon-state={page === key ? "filled" : "line"}
                  onClick={() => tab(key)}
                >
                  <span className={`nav-icon nav-icon-${key}`}>
                    <Icon name={page === key ? fillIcon : lineIcon} size={24} />
                  </span>
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          )}
        {syncStatus.error && (
          <div className="sync-error" role="alert">
            <span>{syncStatus.error}</span>
            <button onClick={() => flushSave().catch(() => {})}>
              重试保存
            </button>
            <button
              onClick={() => {
                const raw = recoveryBackup();
                if (raw) {
                  const a = document.createElement("a"),
                    url = URL.createObjectURL(
                      new Blob([raw], { type: "application/json" }),
                    );
                  a.href = url;
                  a.download = "回应-未保存备份.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } else exportData();
              }}
            >
              导出备份
            </button>
          </div>
        )}
        {encounter && (
          <Encounter
            person={encounter.person}
            origin={encounter.origin}
            onCancel={() => setEncounter(null)}
            onComplete={() => {
              const id = encounter.person.id;
              setEncounter(null);
              go({ page: "profile", person: id, onboarding: route.onboarding });
            }}
          />
        )}
        {created && (
          <CreatedNote
            person={created}
            ui={communityUI}
            onComplete={() => {
              const id = created.id;
              setCreated(null);
              setCompanionDraft(emptyCompanion());
              setNav((n) => [
                ...n.slice(0, -1),
                { page: "profile", person: id, onboarding: needsOnboarding },
              ]);
            }}
          />
        )}
        {menu && (
          <ConversationMenu
            target={menu}
            pinned={(data.pinned || []).includes(menu.id)}
            onClose={() => setMenu(null)}
            onCreate={createCompanion}
            onChoose={chooseCompanion}
            onPin={() => {
              const id = menu.id;
              update((d) => ({
                ...d,
                pinned: (d.pinned || []).includes(id)
                  ? d.pinned.filter((x) => x !== id)
                  : [...(d.pinned || []), id],
              }));
              setMenu(null);
            }}
            onDelete={() => {
              const id = menu.id;
              setMenu(null);
              if (busyRef.current[id]) {
                flash("TA 正在回复，请稍后再删除。");
                return;
              }
              setSheet({ type: "delete-conversation", id });
            }}
          />
        )}
        {sheet?.type === "delete-conversation" && (
          <Sheet title="删除聊天？" onClose={() => setSheet(null)}>
            <p className="delete-note">
              从列表移除与{personById(sheet.id).name}
              的对话。聊天记录和记忆会保留，重新聊天即可恢复。
            </p>
            <button
              className="pill-button"
              onClick={async () => {
                const id = sheet.id;
                update((d) => ({
                  ...d,
                  hiddenChats: [...new Set([...(d.hiddenChats || []), id])],
                  pinned: (d.pinned || []).filter((x) => x !== id),
                }));
                try {
                  await flushSave();
                  setSheet(null);
                  flash("已移除对话，历史记录仍可恢复。");
                } catch {
                  flash("未能保存，请重试。");
                }
              }}
            >
              确认删除
            </button>
          </Sheet>
        )}
        {commentPost && (
          <CommentComposer
            post={commentPost}
            data={data}
            initialText={commentDrafts.current[commentPost.id]}
            onDraft={(value) => {
              commentDrafts.current[commentPost.id] = value;
            }}
            update={update}
            ui={communityUI}
            onClose={() => setCommentPost(null)}
            onSuccess={() => {
              setCommentPost(null);
              flash("评论已发表 · 已保存到本地后端");
            }}
          />
        )}
        {sheet && sheet.type !== "delete-conversation" && (
          <Sheet
            title={
              {
                connection: "AI 连接",
                actions: "聊点什么",
                emoji: "选择表情",
                suggestions: "帮我回复",
                mode: "回复模式",
                background: "聊天背景",
                language: "语言设置",
                pat: "拍一拍",
                search: "发现更多",
                "memory-info": "关于聊天记忆",
                "delete-memory": "移除这条记忆？",
                post: "分享日常",
                comment: "写评论",
                name: "怎么称呼你",
                privacy: "数据与隐私",
                voice: "正在听…",
              }[sheet.type]
            }
            onClose={() => {
              if (publishing) return;
              sheet.recognition?.stop();
              setSheet(null);
            }}
          >
            {sheet.type === "connection" && (
              <div className="sheet-body">
                <div className="connection-status">
                  <span
                    className={
                      config.configured ? "status-dot live" : "status-dot"
                    }
                  />
                  <div>
                    <strong>
                      {config.configured
                        ? config.verifiedAt
                          ? "DeepSeek 已连接"
                          : "DeepSeek 已配置 · 待验证"
                        : config.mode === "offline"
                          ? "本地服务未连接"
                          : "正在体验演示模式"}
                    </strong>
                    <p>
                      {config.configured
                        ? `模型：${config.model} · ${config.verifiedAt ? "已成功收到真实 AI 回复" : "发送消息后验证连接"}`
                        : "当前回复为本地示例，尚未调用 AI。"}
                    </p>
                  </div>
                </div>
                <p>
                  在项目根目录复制 <code>.env.example</code> 为{" "}
                  <code>.env</code>，填入你的 <code>DEEPSEEK_API_KEY</code>
                  ，重启开发服务即可。
                </p>
                <pre>npm run dev</pre>
                <p className="muted-note">
                  密钥仅由本地 Node.js
                  服务读取，不会存进浏览器。无需在聊天里发送密钥。页面修改会自动热更新。
                </p>
                <button
                  className="primary-button"
                  onClick={async () => {
                    try {
                      const r = await fetch("/api/status");
                      if (!r.ok) throw new Error();
                      setConfig(await r.json());
                      flash("连接配置已刷新");
                    } catch {
                      flash("服务暂时不可用，请先运行 npm run dev");
                    }
                  }}
                >
                  刷新连接状态
                </button>
              </div>
            )}
            {sheet.type === "actions" && (
              <div className="action-grid">
                <button onClick={helpReply}>
                  <Sparkles />
                  帮我回复
                </button>
                <button
                  disabled={uploading}
                  onClick={() => {
                    fileTarget.current = "chat";
                    imageInput.current.click();
                  }}
                >
                  <ImagePlus />
                  {uploading ? "读取中…" : "发送图片"}
                </button>
                <button onClick={pat}>
                  <Hand />
                  拍一拍
                </button>
                <button onClick={() => go({ page: "memory", person: pid })}>
                  <Heart />
                  聊天记忆
                </button>
              </div>
            )}
            {sheet.type === "emoji" && (
              <div className="emoji-grid">
                {[
                  "☺️",
                  "🥰",
                  "🥺",
                  "😌",
                  "🤔",
                  "😂",
                  "😭",
                  "😳",
                  "🤍",
                  "🫶",
                  "🌷",
                  "🌙",
                  "☀️",
                  "🍀",
                  "✨",
                  "💭",
                ].map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      changeDraft(draft + e);
                      setSheet(null);
                      inputRef.current?.focus();
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            {sheet.type === "suggestions" && (
              <div className="sheet-body">
                <p className="muted-note">
                  根据刚才的聊天，换一种自然的表达。点选后填入输入框，由你决定发送。
                </p>
                {suggesting ? (
                  <div className="suggestion-loading">
                    <LoaderCircle className="spinning" size={20} />{" "}
                    正在想怎么接话…
                  </div>
                ) : suggestionError ? (
                  <div className="error-box">
                    {suggestionError}
                    <button onClick={helpReply}>重试</button>
                  </div>
                ) : (
                  suggestions.map((s) => (
                    <button
                      className="suggestion"
                      key={s}
                      onClick={() => {
                        changeDraft(s);
                        setSheet(null);
                        inputRef.current?.focus();
                      }}
                    >
                      {s}
                      <ArrowUp size={16} />
                    </button>
                  ))
                )}
                {!config.configured && (
                  <p className="muted-note">
                    演示建议 · 连接 DeepSeek 后按对话生成
                  </p>
                )}
              </div>
            )}
            {["mode", "background", "language"].includes(sheet.type) && (
              <div className="option-list">
                {{
                  mode: ["自然陪伴", "简短", "故事"],
                  background: ["原稿灰", "米白", "风景"],
                  language: ["中文", "English"],
                }[sheet.type].map((value) => (
                  <button
                    key={value}
                    onClick={() => setPref(sheet.type, value)}
                  >
                    <span>
                      {sheet.type === "background" && (
                        <i
                          className={
                            "swatch " +
                            { 原稿灰: "gray", 米白: "cream", 风景: "scenic" }[
                              value
                            ]
                          }
                        />
                      )}
                      <span>
                        {value}
                        {sheet.type === "mode" && (
                          <small>
                            {
                              {
                                自然陪伴: "像朋友一样，一来一往",
                                简短: "简单几句，轻松一点",
                                故事: "带一点场景与动作的对话",
                              }[value]
                            }
                          </small>
                        )}
                      </span>
                    </span>
                    {prefs[sheet.type] === value && <Check size={18} />}
                  </button>
                ))}
              </div>
            )}
            {["name", "pat", "comment", "post"].includes(sheet.type) && (
              <form
                className="sheet-body edit-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (publishing) return;
                  const text = formText.trim();
                  if (!text && !(sheet.type === "post" && postPhotos.length))
                    return;
                  if (sheet.type === "post") {
                    setPublishing(true);
                    setPublishError("");
                    const id = pendingPostId.current || uid();
                    pendingPostId.current = id;
                    update((d) => {
                      const post = {
                        id,
                        person: "me",
                        scope: sheet.scope || "friends",
                        text,
                        photos: postPhotos,
                        time: Date.now(),
                        likes: [],
                        comments: [],
                      };
                      return {
                        ...d,
                        posts: d.posts.some((p) => p.id === id)
                          ? d.posts.map((p) =>
                              p.id === id
                                ? { ...p, text, photos: postPhotos }
                                : p,
                            )
                          : [post, ...d.posts],
                      };
                    });
                    try {
                      await flushSave();
                      pendingPostId.current = null;
                      setSheet(null);
                      flash("日常已发布 · 已保存到本地后端");
                    } catch (error) {
                      setPublishError(error.message);
                    } finally {
                      setPublishing(false);
                    }
                    return;
                  }
                  if (sheet.type === "name")
                    update((d) => ({ ...d, name: text }));
                  if (sheet.type === "pat") setPref("pat", text);
                  if (sheet.type === "comment")
                    update((d) => ({
                      ...d,
                      posts: d.posts.map((p) =>
                        p.id === sheet.post
                          ? {
                              ...p,
                              comments: [
                                ...p.comments,
                                { id: uid(), name: d.name, text },
                              ],
                            }
                          : p,
                      ),
                    }));
                  setSheet(null);
                }}
              >
                <textarea
                  autoFocus
                  aria-label="编辑内容"
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  maxLength={
                    sheet.type === "name"
                      ? 20
                      : sheet.type === "pat"
                        ? 80
                        : 1000
                  }
                  rows={sheet.type === "post" ? 5 : 2}
                  placeholder={
                    sheet.type === "post" ? "今天有什么想分享的？" : "写在这里…"
                  }
                />
                {sheet.type === "post" && (
                  <>
                    <div className="upload-thumbnails">
                      {postPhotos.map((src, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label="移除图片"
                          onClick={() =>
                            setPostPhotos((p) => p.filter((_, j) => j !== i))
                          }
                        >
                          <Photo src={src} />
                          <X size={14} />
                        </button>
                      ))}
                      {postPhotos.length < 3 && (
                        <button
                          type="button"
                          className="add-photo"
                          disabled={uploading}
                          onClick={() => {
                            fileTarget.current = "post";
                            imageInput.current.click();
                          }}
                        >
                          {uploading ? (
                            <LoaderCircle className="spinning" />
                          ) : (
                            <ImagePlus />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="muted-note">
                      {sheet.scope === "square"
                        ? "发布到广场（本地预览），不会同步到私人朋友圈。"
                        : "仅发布到你与 AI 好友的朋友圈，不会出现在广场。"}
                    </p>
                  </>
                )}
                <button
                  className="primary-button"
                  disabled={
                    uploading ||
                    publishing ||
                    (!formText.trim() &&
                      !(sheet.type === "post" && postPhotos.length))
                  }
                >
                  {publishing
                    ? "正在保存…"
                    : sheet.type === "post"
                      ? "发布日常"
                      : sheet.type === "comment"
                        ? "发表"
                        : "保存"}
                </button>
                {publishError && sheet.type === "post" && (
                  <p className="error-box" role="alert">
                    {publishError} · 内容已保留，再次点击发布可重试。
                  </p>
                )}
              </form>
            )}
            {sheet.type === "search" && (
              <form
                className="sheet-body edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSheet(null);
                }}
              >
                <div className="search-box">
                  <Search size={18} />
                  <input
                    placeholder="搜索名字或标签"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="搜索角色关键词"
                  />
                </div>
                <button className="primary-button">查看结果</button>
              </form>
            )}
            {sheet.type === "delete-memory" && (
              <div className="sheet-body">
                <p>{sheet.memory.text}</p>
                <p className="muted-note">只移除这条记忆，不影响聊天记录。</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    const m = sheet.memory;
                    update((d) => ({
                      ...d,
                      memories: {
                        ...d.memories,
                        [pid]: (d.memories[pid] || []).filter(
                          (x) => x.id !== m.id,
                        ),
                      },
                    }));
                    setSheet(null);
                  }}
                >
                  移除记忆
                </button>
              </div>
            )}
            {sheet.type === "memory-info" && (
              <div className="sheet-body">
                <p>
                  记忆按聊天日期保存。连接 DeepSeek 后，AI
                  会从你明确分享的内容中提取简短记忆，用于接下来的对话。
                </p>
                <p>
                  演示模式只摘录你发送的话，不会假装完成 AI
                  分析。文牧野的三条初始回忆是设计稿里的示例。
                </p>
                <p>不准确的记忆可以点击右上角 × 移除。</p>
              </div>
            )}
            {sheet.type === "privacy" && (
              <div className="sheet-body">
                <p>
                  聊天、图片、日常和记忆由本地 Node
                  后端保存到电脑磁盘，浏览器保留缓存与未保存备份。体验登录不是真实微信登录，也不会向真实好友发送内容。
                </p>
                <p>
                  连接 DeepSeek 后，当前角色最近 20 条文字消息和最多 8
                  条非示例记忆，会经本地服务发送给 DeepSeek。图片不会发送。
                </p>
                <p>
                  清理浏览器缓存后仍可从本地后端恢复已保存内容。当前是单用户本机版本，尚不包含多用户账号、端到端加密或公网生产权限体系。
                </p>
                <p>
                  所有角色均为虚构 AI 角色，「TA
                  在想」是创作的角色旁白，不是模型内部推理过程。
                </p>
              </div>
            )}
            {sheet.type === "voice" && (
              <div className="sheet-body">
                <div className="voice-listening">🎙️</div>
                <p>说完后，文字会填入输入框。</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    sheet.recognition.stop();
                    setSheet(null);
                  }}
                >
                  结束语音输入
                </button>
              </div>
            )}
          </Sheet>
        )}
        {lightbox && (
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            onClick={() => setLightbox(null)}
          >
            <IconButton label="关闭图片" onClick={() => setLightbox(null)}>
              <X />
            </IconButton>
            <img
              src={lightbox}
              alt="图片预览"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        <input
          hidden
          type="file"
          accept="image/*"
          ref={imageInput}
          onChange={pickFile}
        />
      </div>
      <div className="desktop-caption">
        <span>{width} × 自适应高度</span>
        <span
          role="status"
          data-save-state={
            syncStatus.error ? "error" : syncStatus.saving ? "saving" : "saved"
          }
        >
          {syncStatus.error
            ? "更改尚未保存"
            : syncStatus.saving
              ? "正在保存到本地后端…"
              : "已保存到本地后端 · 实时更新"}
        </span>
      </div>
    </main>
  );
}
