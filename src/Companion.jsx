import React, { useEffect, useRef, useState } from "react";

export function Onboarding({ onCreate, onChoose, Photo }) {
  return (
    <div className="onboarding">
      <div className="gift-title">
        <h1>Life gift</h1>
        <p>
          <img src="/assets/v3-onboard-imgVector3.svg" alt="" />
          自在相遇
          <img src="/assets/v3-onboard-imgVector4.svg" alt="" />
        </p>
      </div>
      <Photo
        className="gift-art"
        src="/assets/v3-onboard-imgClipboardScreenshot17894751591.png"
      />
      <div className="gift-actions">
        <button className="pill-button primary" onClick={onCreate}>
          创建 AI 伙伴
        </button>
        <button className="pill-button" onClick={onChoose}>
          选择角色
        </button>
      </div>
    </div>
  );
}

export function CreateCompanion({
  ui,
  draft,
  onDraft,
  onSave,
  shrinkImage,
  onBack,
}) {
  const { Header, Photo } = ui;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    input = useRef(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const change = (key, value) => onDraft({ ...draft, [key]: value });
  return (
    <>
      <Header title="TA 的资料" onBack={busy ? undefined : onBack} />
      <form
        className="companion-form scroll-area"
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current) return;
          if (!draft.name.trim() || !draft.setting.trim()) {
            setError("请填写备注和人物设定。");
            return;
          }
          lock.current = true;
          setBusy(true);
          setError("");
          try {
            await onSave();
          } catch (e) {
            if (alive.current) setError(e.message || "保存失败，请重试。");
          } finally {
            lock.current = false;
            if (alive.current) setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <div className="avatar-upload">
            <button
              type="button"
              aria-label="上传头像"
              onClick={() => input.current?.click()}
            >
              {draft.avatar ? (
                <Photo src={draft.avatar} />
              ) : (
                <img
                  src="/assets/v3-create-imgExport.svg"
                  width="28"
                  height="28"
                  alt=""
                />
              )}
            </button>
            <span>上传头像</span>
            <input
              ref={input}
              hidden
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files[0];
                e.target.value = "";
                if (!file) return;
                lock.current = true;
                setBusy(true);
                setError("");
                try {
                  const avatar = await shrinkImage(file);
                  if (alive.current) change("avatar", avatar);
                } catch (e) {
                  if (alive.current) setError(e.message);
                } finally {
                  lock.current = false;
                  if (alive.current) setBusy(false);
                }
              }}
            />
          </div>
          <label>
            备注 <span className="field-emoji">🖊️</span>
            <span className="sr-only">（必填）</span>
            <input
              aria-label="备注"
              required
              maxLength={80}
              placeholder="TA 的名字..."
              value={draft.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          <label>
            性别 <span className="field-emoji">♀♂</span>
            <select
              aria-label="性别"
              value={draft.gender}
              onChange={(e) => change("gender", e.target.value)}
            >
              <option value="">选择性别</option>
              <option>男</option>
              <option>女</option>
              <option>其他</option>
            </select>
          </label>
          <label>
            人物设定<span className="sr-only">（必填）</span>
            <textarea
              aria-label="人物设定"
              required
              maxLength={2000}
              placeholder="描述人物的背景、行为"
              value={draft.setting}
              onChange={(e) => change("setting", e.target.value)}
            />
          </label>
          <label>
            表达风格
            <textarea
              aria-label="表达风格"
              maxLength={500}
              placeholder="描述角色的语言特点～"
              value={draft.style}
              onChange={(e) => change("style", e.target.value)}
            />
          </label>
          <label>
            关系设定
            <textarea
              aria-label="关系设定"
              maxLength={500}
              placeholder="描述和 TA 的关系，例如恋人、朋友"
              value={draft.relationship}
              onChange={(e) => change("relationship", e.target.value)}
            />
          </label>
        </fieldset>
        <p className="form-hint">备注和人物设定为必填，其余可以稍后补充。</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="pill-button companion-save" disabled={busy}>
          {busy ? "正在保存…" : "保存"}
        </button>
      </form>
    </>
  );
}

export function CreatedNote({ person, ui, onComplete }) {
  const { Avatar, Tags, Sheet } = ui;
  const done = useRef(false),
    callback = useRef(onComplete);
  callback.current = onComplete;
  const finish = () => {
    if (!done.current) {
      done.current = true;
      callback.current();
    }
  };
  useEffect(() => {
    const timer = setTimeout(finish, 2300);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Sheet
      title="伙伴已创建"
      onClose={finish}
      className="created-sheet"
      minimal
    >
      <div className="created-note">
        <small>Note</small>
        <div className="note-rule" />
        <div className="note-person">
          <Avatar src={person.avatar} alt={person.name} round />
          <div>
            <strong>{person.name}</strong>
            <Tags values={person.tags} />
          </div>
        </div>
        <p>{person.bio}</p>
      </div>
      <button className="pill-button sheet-action" onClick={finish}>
        查看 TA 的资料
      </button>
    </Sheet>
  );
}

export function ConversationMenu({
  target,
  onClose,
  onCreate,
  onChoose,
  onPin,
  onDelete,
  pinned,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector("button")?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      const buttons = [...ref.current.querySelectorAll("button")];
      if (["ArrowDown", "ArrowUp", "Tab"].includes(e.key)) {
        e.preventDefault();
        const index = buttons.indexOf(document.activeElement);
        const step =
          e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 1;
        buttons[(index + step + buttons.length) % buttons.length].focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="menu-scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="menu"
        aria-label={target.id ? "聊天操作" : "添加伙伴"}
        className="conversation-menu"
        style={{ top: target.y || 72, right: 16 }}
      >
        {target.id ? (
          <>
            <button role="menuitem" onClick={onDelete}>
              删除聊天
            </button>
            <button role="menuitem" onClick={onPin}>
              {pinned ? "取消置顶" : "置顶"}
            </button>
          </>
        ) : (
          <>
            <button role="menuitem" onClick={onCreate}>
              创建 AI 伙伴
            </button>
            <button role="menuitem" onClick={onChoose}>
              选择角色
            </button>
          </>
        )}
      </div>
    </div>
  );
}
