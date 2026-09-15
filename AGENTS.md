# 回应项目：给 CodeBuddy / Codex / 其他 AI 的开发交接

## 用户约束（优先）

- 直接维护**本地源代码**，不使用 Coze，不转移到远程生成项目；无需任何专有开发环境。
- 用户的 Figma 视觉是基准。保留灰白背景、小圆角聊天气泡、悬浮导航、原始风景/头像/记忆照片，禁止擅自改成营销页、大卡片仪表盘或蓝紫 AI 风格。
- 桌面浏览器中居中手机尺寸预览，默认402px，宽度可选；修改代码实时热更新。后续将在 CodeBuddy 继续。
- 优先可点击的完整体验与顺滑按压/切页/emoji加载/图片加载，不要只做静态截图。

## 技术 / 命令

- React 19 + Vite 6 + JavaScript/JSX + CSS。Node Express 服务在 `server.mjs`。
- `npm install`；`npm run dev` → http://localhost:5178。
- 前端 Fast Refresh；改服务端和 `.env` 需要重启进程。仅监听127.0.0.1。
- `npm run build`；停掉开发服务后 `npm start` 验证生产构建。
- `npm test` 要求服务已启动。`npm run test:ui` / `test:hmr` 自动启动独立5188演示服务与临时数据，不用真实key；要求 Playwright Chromium或Chrome（见 README）。`test:live` 在5189运行，正常花费2次真实API调用，仅按需使用。
- 5173 在原电脑被 CodeBuddy 使用，不终止不属于本项目的进程；需要时改 `.env` 的 PORT。

## 代码结构与状态

- `src/App.jsx`: `nav` 是页面栈；主tab替换栈，返回pop；聊天 route 带 person id。
- `data` 全局数据通过 `src/persistence.js` 同步到 `/api/state`，后端 `server/state-store.mjs` 持久化在 `.local-data/state.json`。chats/drafts/settings/memories **按角色id分隔**。localStorage `huiying.demo.v1` 仅缓存；`huiying.unsaved.v1` 为失败备份，`huiying.conflict-backup.v1` 保留版本冲突内容。
- 不要把后端落盘退回纯前端演示。状态写入带 revision，原子替换，409不自动覆盖。初始化先读取后端；后端为空时才迁移旧缓存。所有改动通过 `update()` 排队；发送前与发布成功前等待 `flushSave()`。AI已回复但保存失败，使用保存横幅处理，不重复调用模型。
- `busyRef` 立即防重复提交，`busy` 渲染每角色加载态。异步回复携带捕获的角色id，不要改成读取当前路由后落库，防串会话。
- `dataRef` 为请求读取最新设置/记忆；消息渲染后scrollIntoView，但用户阅读旧消息时不强拉滚动。
- `src/data.js` 人物和演示数据；`src/assets.json` 本地资源映射；不要重新依赖Figma过期URL。
- `src/styles.css` 用402×874为设计坐标参考。桌面手机预览高度会适配窗口，移动端走 visualViewport 高度。
- 底栏是 keyed screen 外的稳定节点，四个tab独立line/fill素材配对；不要把所有聊天图标固定fill。`.frosted-glass` 统一导航/输入栏材质，输入栏绝对定位覆盖聊天滚动层；记忆 `.memory-mood` 使用原稿蓝色圆形底图。
- 聊天输入框点击/聚焦只显示文字光标，不要套用全局矩形focus-visible描边；保留按钮和其他控件的键盘焦点提示。
- `Sheet` 处理焦点圈与 Escape。新增交互要支持键盘、loading/error/disabled与 reduced-motion。

## 新增社区 / Hi 探索（2026-09-15）

- 第三个 Tab 文案为「社区」，内部 route 仍为 moments，避免破坏旧导航。`src/Community.jsx` 实现朋友圈/广场与专用评论 Sheet；`src/community.css` 在原 styles.css 后加载。
- 动态共用 data.posts，新增 scope= friends|square，旧数据未带 scope 时视为 friends。朋友圈只显示自己和 contacts 内的角色；不要将私人动态自动迁移到广场。示例是 `src/community-data.js` 的固定ID种子，仅在用户操作后写入快照；旧种子保留在下方，不删除用户内容。
- 评论按 post.id 隔离；提交前锁防连点、等待 flushSave 后关闭，失败保留原评论ID，重试不重复新增；关闭弹窗时草稿保留于当前 App 会话，不承诺重启恢复未发评论。
- 广场仍为本地单用户预览，其他用户评论和热度明确为示例，没有真实多人/实时社交服务，不可称为已上线公共社区。
- `shared/explore-characters.mjs` 为客户端与服务端共用的22个新角色目录；src/data.js保留已有8人并追加。新增角色必须同时通过server校验与persona提示；openChat补齐旧状态里不存在的新角色会话。
- Hi 根据本地真实用户文字、非示例记忆、自己的动态、点赞对预设角色排序；这是可验证的本地兴趣匹配，不是大模型动态生成人物。没有上传私人内容到公共空间，也不要声称从微小数据推断用户人格。
- `src/Explore.jsx` 实现点选→放大虚化→标签→同一人物资料，定时器卸载清理、可取消/跳过、键盘焦点限制、reduced-motion。不把标签屏的名字和资料页名字错配。Figma返回空motion节点，动效按用户明确描述实现，非导出的Smart Animate。
- 首页保留用户 SceneLayers 与透明图片修复，柔化现有 bloom 的渐变/不透明度/时长；不可重置欢迎图或头像裁切。
- `npm run test:community` 使用隔离5188，无API费用；与test:ui/test:hmr不可同时跑。迁移到CodeBuddy必须连同 shared/ 与全部 public/assets 一起复制。

## 首次相遇 / 自建伙伴（2026-09-15 新稿覆盖旧欢迎页）

- 新稿明确改用白色猫咪欢迎页与 Life gift，原风景欢迎页不再显示。猫咪和拥抱插画是透明素材，Photo 容器必须透明，不能出现灰色占位底。标题与星球过渡名使用本地站酷文艺体。
- 新状态 `onboardingComplete=false`，contacts 初始为空；无该字段的旧状态视为老用户，禁止清空旧好友。首次选择角色 route.onboarding=true，隐藏底栏；openChat 完成引导。我的页面提供非破坏性「体验首次相遇」。
- `customCharacters` 是服务端持久化的原始设定，使用 custom- 前缀唯一ID，最多100条。`shared/custom-characters.mjs` 共享校验与映射，/api/chat 从服务器状态检索已存设定，拒绝未保存角色；不得把角色头像传入模型。
- `src/Companion.jsx` / `src/companion.css` 为新组件样式；创建必须等待 flushSave 成功才出现 Note。重试复用ID，勿重复建立角色。必填备注、人物设定；资料页右上角可编辑。
- `pinned` 持久化置顶；`hiddenChats` 是软删除列表，仅隐藏对话，不删历史与记忆。发现列表必须包含自建角色，openChat 移除隐藏标记以恢复。右键、Shift+F10、触屏长按均应可用。
- 每次主 Tab 进入发现都 setPlanetOpen(true)，仍保留用户现有球面旋转和滚动收起。不要为修复测试停止球面动画；回归可用焦点+Enter选择移动星点。
- `test:companion` 和其他5188测试串行运行；legacy-user fixture 专门模拟老用户，不改变新用户默认值。

## DeepSeek / 安全

- `.env` 中 DEEPSEEK_API_KEY 只给服务器。严禁硬编码或转为 VITE_ 前缀，严禁写进日志/客户端/localStorage。
- GET /api/status 仅返回 configured/model/mode/verifiedAt/storage；成功调用后才标记 verifiedAt。POST /api/chat 支持 task=chat|suggestions；GET/PUT /api/state负责本地数据。
- 默认模型deepseek-flash，可由DEEPSEEK_MODEL覆盖。请求JSON输出 messages/innerVoice/memory，禁用thinking，不读取reasoning_content。
- innerVoice是虚构人物旁白，不是私有推理；不要向用户声称是真实思维过程。
- 无key明确演示模式；有key调用失败显示重试，不静默替换演示。没有真实key时不能报告API端到端通过。
- 用户图片不发给DeepSeek。真实请求最多20条文字与8条非示例记忆。示例记忆不得进入模型上下文。
- 本机服务对Host/Origin做限制。这是本地演示，未经用户要求不发布公网、不新建第三方账户/项目。
- `.env` 和 `.local-data` 不可通过Web静态服务读取，不提交或展示其内容；CodeBuddy迁移要保留server/，密钥与用户数据私下单独迁移。生产当前使用文件存储，仅支持本地单用户，尚未完成公网账号/鉴权/费用隔离。

## 验收清单

1. 欢迎登录 → 会话 → 发送你好 → 头像右上emoji / 顶部对方正在输入 → 分段回复 → 展开收起旁白。
2. 更多 → 帮我回复 → 选择建议只进入草稿，不自动发送。
3. 更多设置 → 背景/模式/语言/拍一拍；聊天记忆与聊天记录搜索跳转。
4. 角色主页 → 开始聊天；切角色不串数据，刷新持久化。
5. 朋友圈发布与点赞评论、图片预览；我的昵称和备份。
6. 320/375/402/414/768宽度无水平溢出；键盘和弹层焦点可用。
7. npm run build、npm test、演示模式UI回归无异常；新浏览器恢复后端数据、存储重启/冲突/失败重试测试。更新 README / TEST_REPORT 中实际验证情况，不编造完成状态。

后续建议按需将 App.jsx 拆成 pages/components/hooks，但先保行为与原稿，不要为重构重写整个项目。
