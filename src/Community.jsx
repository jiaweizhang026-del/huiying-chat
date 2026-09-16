import React, { useRef, useState } from "react";
import assets from "./community-assets.json";
import { asset, uid } from "./data.js";
import { visiblePosts, changePost } from "./community-data.js";
import { flushSave } from "./persistence.js";

const Glyph = ({ name }) => (
  <img
    className="community-glyph"
    width="24"
    height="24"
    src={assets[name]}
    alt=""
  />
);
export function CommunityFeed({
  data,
  scope,
  onScope,
  onPublish,
  onProfile,
  onChat,
  onComment,
  onPhoto,
  update,
  ui,
}) {
  const { Header, IconButton, Icon, Avatar, Photo, Tags, personById } = ui;
  const [expanded, setExpanded] = useState({});
  return (
    <>
      <Header
        title={
          <span className="community-tabs" role="tablist" aria-label="社区分栏">
            {[
              ["friends", "朋友圈"],
              ["square", "广场"],
            ].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={scope === key}
                onClick={() => onScope(key)}
              >
                {label}
              </button>
            ))}
          </span>
        }
        right={
          <IconButton label="发布日常" onClick={onPublish}>
            <Icon name="s3-imgLine2" />
          </IconButton>
        }
      />
      <div
        className="scroll-area community-feed"
        key={scope}
        role="tabpanel"
        aria-label={scope === "square" ? "广场动态" : "朋友圈动态"}
      >
        {visiblePosts(data, scope).map((post) => {
          const p =
            post.person === "me"
              ? {
                  name: data.name,
                  avatar: asset("s1-imgRectangle5"),
                  tags: ["我的日常"],
                }
              : personById(post.person);
          return (
            <article
              className="community-post"
              key={post.id}
              data-post-id={post.id}
            >
              <button
                className="community-author"
                onClick={() => onProfile(post.person)}
                aria-label={p.name + "的资料"}
              >
                <Avatar src={p.avatar} alt="" />
                <span>
                  <strong>{p.name}</strong>
                  <Tags values={p.tags.map((t) => "#" + t)} />
                </span>
              </button>
              <p className="community-text">{post.text}</p>
              {!!post.photos.length && (
                <div
                  className={
                    "community-photos " +
                    (post.photos.length > 1 ? "multiple" : "")
                  }
                >
                  {post.photos.map((src, i) => (
                    <button
                      key={i}
                      aria-label="查看日常图片"
                      onClick={() => onPhoto(src)}
                    >
                      <Photo
                        src={src}
                        alt="分享的日常"
                        className={
                          src.includes("friends-") ||
                          src.includes("imgRectangle12")
                            ? "portrait-photo"
                            : ""
                        }
                      />
                    </button>
                  ))}
                </div>
              )}
              {post.hot && (
                <p className="community-hot">
                  <Glyph name="squareDesign-imgHot" />
                  热门回复：{post.hot}
                </p>
              )}
              <div className="community-actions">
                {post.person !== "me" && (
                  <button
                    onClick={() => onChat(post.person)}
                    aria-label={"私聊" + p.name}
                  >
                    <Glyph name="squareDesign-imgAiSession" />
                    私聊
                  </button>
                )}
                <button
                  aria-label={post.likes.includes("me") ? "取消赞" : "点赞"}
                  aria-pressed={post.likes.includes("me")}
                  onClick={() =>
                    update((d) =>
                      changePost(d, post.id, (p) => ({
                        ...p,
                        likes: p.likes.includes("me")
                          ? p.likes.filter((x) => x !== "me")
                          : [...p.likes, "me"],
                      })),
                    )
                  }
                >
                  <Glyph
                    name={
                      scope === "square"
                        ? "squareDesign-imgThumbsup"
                        : "friends-imgLike"
                    }
                  />
                  {(post.exampleLikes || 0) + post.likes.length}
                </button>
                <button aria-label="评论" onClick={() => onComment(post)}>
                  <Glyph name="squareDesign-imgMessage" />
                  {post.comments.length}
                </button>
                {post.seed && (
                  <small title="设计稿示例内容和互动，不代表在线用户">
                    示例
                  </small>
                )}
              </div>
              {!!post.comments.length && (
                <div className="community-discussion">
                  {(expanded[post.id]
                    ? post.comments
                    : post.comments
                        .filter(
                          (c) =>
                            post.comments.length <= 2 ||
                            !c.id.startsWith("example-"),
                        )
                        .slice(-2)
                  ).map((c) => (
                    <p key={c.id}>
                      <b>{c.name}：</b>
                      {c.text}
                    </p>
                  ))}
                  {post.comments.length > 2 && (
                    <button
                      onClick={() =>
                        setExpanded((v) => ({ ...v, [post.id]: !v[post.id] }))
                      }
                    >
                      {expanded[post.id]
                        ? "收起评论"
                        : `查看 ${post.comments.length} 条评论`}
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
        <p className="community-footnote">
          {scope === "square"
            ? "广场 · 本地社区预览，其他用户互动为示例"
            : "仅你与已添加的 AI 好友可见 · 本地保存"}
        </p>
      </div>
    </>
  );
}

export function CommentComposer({
  post,
  data,
  initialText,
  onDraft,
  onClose,
  onSuccess,
  update,
  ui,
}) {
  const { Sheet, Avatar } = ui;
  const [text, setText] = useState(initialText || "");
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const id = useRef(uid()),
    locked = useRef(false);
  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || locked.current) return;
    locked.current = true;
    setSaving(true);
    setError("");
    update((d) =>
      changePost(d, post.id, (p) => ({
        ...p,
        comments: p.comments.some((c) => c.id === id.current)
          ? p.comments.map((c) =>
              c.id === id.current ? { ...c, text: text.trim() } : c,
            )
          : [
              ...p.comments,
              { id: id.current, name: d.name, text: text.trim() },
            ],
      })),
    );
    try {
      await flushSave();
      onDraft("");
      onSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  return (
    <Sheet
      title="写评论"
      className="comment-sheet"
      onClose={() => {
        if (!locked.current) onClose();
      }}
      heading={
        <span className="comment-identity">
          <Avatar src={asset("s1-imgRectangle5")} />
          <span>{data.name} 评论</span>
        </span>
      }
    >
      <form className="comment-form" onSubmit={submit}>
        <div className="comment-writing">
          <span className="comment-quote" aria-hidden="true">
            “
          </span>
          <textarea
            aria-label="评论内容"
            placeholder="说点什么..."
            value={text}
            maxLength={1000}
            onChange={(e) => {
              setText(e.target.value);
              onDraft(e.target.value);
            }}
            disabled={saving}
          />
        </div>
        {error && (
          <p className="error-box" role="alert">
            {error} · 评论已保留，可以重试。
          </p>
        )}
        <button
          className="comment-submit sheet-action"
          disabled={!text.trim() || saving}
        >
          {saving ? "正在发表…" : "发表"}
        </button>
      </form>
    </Sheet>
  );
}
