历史首版规格（以下描述保留初始背景；当前实现与后续开发以 AGENTS.md / README.md 为准）。2026-09-15 已接入真实 DeepSeek，并改为本地后端持久化，不再是仅前端演示；密钥仅在本地 .env。

请立即实现一个可运行可演示的移动端 AI 陪伴对话 App，暂名「回应」。用户自己的 Figma 原稿，要求高度对齐，优先界面与顺滑交互。不是策划方案、不是营销落地页、不要问用户需求、不要擅自换成蓝紫渐变卡片。不部署生产。App 需要可在浏览器预览以便交付演示。
视觉参考为用户提供8屏截图，Figma https://www.figma.com/design/3T1cBSr3hR9ozjluENvdV1?node-id=556-31107 。下面是我已经通过 Figma MCP 读出的精确设计数据。请直接按数据写界面，不要花时间尝试登录 Figma。

所有屏幕设计402×874，手机端全屏响应式，桌面居中显示402宽、最大874高，外侧中性灰，无假手机刘海和边框，无附加侧栏。背景#ededed，字体PingFang SC/system sans-serif。16px正文24行高，12px辅助16行高。Header高77，标题中心x201 y41，左返回/右更多24px，距边16。底部导航x16 w370 h72 bottom16 圆角42，玻璃白rgba(249,248,246,.5)边框#e4e3e1，四个入口「对话、发现、朋友圈、我的」，选中项浅灰pill。手机安全区和键盘适配，内容滚动底部不遮挡。所有按钮有按压缩放0.97/opacity、可见focus，页面push/back 220ms ease-out、底部sheet 240ms，图片decode后淡入与占位。支持减少动态效果，禁止无意义弹跳。

原始素材必须下载入项目public/assets使用（不要依赖临时Figma URL作为运行时链接）。全部是用户自己的设计图片：
风景 https://www.figma.com/api/mcp/asset/6a353471-6a6b-43d2-8835-98bdc4acc15e.png
首页设置 https://www.figma.com/api/mcp/asset/ed1c04e6-e6f5-41fe-8d80-3d8f7a257732.svg
微信 https://www.figma.com/api/mcp/asset/93d37c7a-e7d6-40b8-b27c-440da5db589e.svg
聊天文牧野头像 https://www.figma.com/api/mcp/asset/60d65448-02e4-460f-9668-7cd7a32b0a47.png
用户头像 https://www.figma.com/api/mcp/asset/eb2ef4ad-9ddc-43d3-b022-e9f2d2194486.png
沈宴之 https://www.figma.com/api/mcp/asset/fe761fff-8f0a-4bb0-afaa-381c80ff2caa.png
姜承铉 https://www.figma.com/api/mcp/asset/29545978-d974-4b71-88ba-3d044625efe1.png
顾兆宇 https://www.figma.com/api/mcp/asset/0c3e9d4e-5ff3-4d4c-820c-6451bf7f624a.png
发现圆头像文牧野 https://www.figma.com/api/mcp/asset/3470efc0-01c6-4532-9cc9-4d92344f7629.png
李俊熙 https://www.figma.com/api/mcp/asset/02a5083d-2ecd-4739-bbce-7bc2a1cf2a1d.png
王小雨 https://www.figma.com/api/mcp/asset/a626c040-8d76-4c26-bb3d-6aa479b7d647.png
张伟 https://www.figma.com/api/mcp/asset/8d947c4b-21e2-4cce-99d8-dfeb4853b81c.png
陈婷 https://www.figma.com/api/mcp/asset/66d35928-3aea-4540-a78e-30f36df171b1.png
竹林 https://www.figma.com/api/mcp/asset/dee03cce-91e4-41af-acac-7fd90e2cbc90.png
樱花路 https://www.figma.com/api/mcp/asset/0a70506e-d14d-48f5-a889-461d1d7a8eb1.png
樱花近景 https://www.figma.com/api/mcp/asset/51926da7-5262-48c7-821f-fe464dc01c26.png
返回 https://www.figma.com/api/mcp/asset/4a19de05-841b-49a7-98b4-7a0fc4fcf5c6.svg
更多 https://www.figma.com/api/mcp/asset/24ad7ce4-94b8-457d-9fc5-97e46d7409ae.svg
语音 https://www.figma.com/api/mcp/asset/b8c04401-4ae2-48f0-b62d-43a11343b7ae.svg
加号 https://www.figma.com/api/mcp/asset/a31312d4-3593-4b6b-8c39-5196b925e4d6.svg
emoji按钮 https://www.figma.com/api/mcp/asset/228f3438-2dbb-4110-92f6-47cdace9bca5.svg
导航对话 https://www.figma.com/api/mcp/asset/99dffc6b-8e32-4270-bd76-89c164ae044e.svg
导航发现 https://www.figma.com/api/mcp/asset/00e540ff-ae29-49b2-8994-fa4d00056f31.svg
导航朋友圈 https://www.figma.com/api/mcp/asset/c62a7694-dbbb-48d0-aa97-77282b310679.svg
导航我的 https://www.figma.com/api/mcp/asset/7bca1e1c-6e6a-40fa-ba6a-2fc78b46c148.svg

需要全部实现的屏幕和流程：
1欢迎页：full bleed风景object-fit cover，原图opacity.6背景#585858。右上x315 y16 w71 h60 glass设置按钮。文字x19 y643字号32 semibold行高40，Hi Jawi，然后间距12「随时随地获得回应」。x19 y763 w367 h58圆角42玻璃按钮，微信图标32绿+白字「微信一键登录」。由于未接微信OAuth点击体验登录，按钮下轻小字明确「演示登录，无需微信授权」，有loading/进入transition。底部小字不抢视觉。设置入口可看DeepSeek连接状态/使用说明，不要问API key。
2对话列表：title 下午好，右上加号去发现。四行沈宴之、文牧野、姜承铉、顾兆宇，头像49x49 x19 top91、162、233、304，radius4；文字x87名字16、摘要12灰，分隔线从x87开始。底部四tab。点击任意进对应人聊天，各自人设会话完全隔离；会话摘要和排序随最近新消息更新，不丢数据。
3发现页：title发现。卡片x16 w370高138间距16，第一张top86。半透白卡片实际底从卡片top25起高113 round16；圆头像82 x32从卡片top0，名字x125 top33，细描边tag top61，描述x32 top94 font12/16。人物文牧野(大学/青梅竹马/富家少爷)、李俊熙(职场/初恋/奋斗者)、王小雨(校园/暗恋/文艺少女)、张伟(家庭/责任/普通人)、陈婷(旅行/探索/自由灵魂)。自然简介。点击进角色主页，开始聊天加入列表，加号展开搜索/筛选。
4聊天页：header文牧野，更多进聊天设置，点名字或头像进个人主页。时间8:00 chip top85。AI头像40x40 x16圆角4，白bubble x68最大264宽padding8 radius4+小tail。用户右头像x344 bubble#ddd。初始文牧野消息：（联赛决赛结束，全场都在喊文牧野的名字。他摘下耳机，没有先去接采访，而是穿过人群走到你面前。）其他角色有不同开场。用户发送你好，马上出现右bubble，然后顶部变「对方正在输入…」，AI头像右上浮一个emoji从💭→🤔→💡轻柔切换，不是大段推理loading卡片。回复完成头像旁emoji收起，名字恢复，分三条带头像顺序进入：(把外套递给你)、你好什么、别站门口，进来。此为无API模式演示，后续非你好有关键词和上下文相关的若干不同自然示例，不要所有消息回复同一内容。真实模式接DeepSeek。
5聊天收起/展开想法：最新回复下有白色小按钮「看看 TA 的想法⌄」14浅灰；点开出现白卡片x16 w316 radius4 padding8，标题「TA 在想 🤔」16，body14/20灰，参考「刚分开两小时，又和我装客气。是紧张还是故意的……算了，外套给你拿了，还站门口。」可收起。这里是简短虚构角色内心旁白，不是模型内部思维链，设置或卡片脚注明确说明。每轮保存对应旁白，不要露出reasoning_content。
输入bar x16 bottom16 w370 h56 round42。语音左，input弹性，emoji与plus右（32图标）。有字时发送按钮替换plus或增加。Enter发送、ShiftEnter换行、中文输入法isComposing不误发，禁重复发送；空文字禁发。emoji panel插入；plus sheet含「帮我回复」「发送图片」「拍一拍」。帮我回复请求AI生成3条建议，选一条只填入输入框不自动发送。上传图片支持本地展示和灯箱，不要假装DeepSeek支持图片理解。语音如果不能实现语音输入就明确浏览器限制不假装录音。新消息平滑滚到底，阅读旧记录不强拉，加载失败有重试，离开会话异步结果不串人。
6聊天设置：灰header77。白个人资料row y77 h81 avatar49 top93 left16，名字x80、tags、右chevron。gap12。回复模式/聊天背景/语言设置三行每64，分别y170/234/298。gap12聊天记录行64 y374。gap12与他的记忆64 y450和拍一拍64 y514。模式选自然陪伴/简短/故事，背景选原稿灰、米白、风景（仅聊天），语言中文/English影响请求；拍一拍可修改文案并在聊天触发。设置真实保存。
7记忆页：header「与他的记忆」。body白，上方头像49+名字tags。日期标题今天😔 top158；浅灰#f7f7f7 block x16 top194 w370 padding8 内容「今天我很伤心，文牧野和我一起去吃了一顿大餐，一起去了水族馆」。9.6☺️ top270，content top306「告诉了他去看了好看的风景」。照片三张错落拼贴，不是规整网格：樱花近景x65 y357 w100 h65 rotate3deg，竹林x31 y422 w134 h87 rotate-6.49deg，樱花路x171 y360 w196 h126 rotate-1.56deg。9.2 top535内容top571「我故意把书包甩得响，其实心跳快得要死，还要装得满不在乎……完蛋，我是不是回得太冷淡了？」预置数据明确演示回忆，用户新对话按当天自动摘要记录，不凭空编造经历，每角色隔离，可删除单条记忆。照片点开放大。
8聊天记录：按日期分组，搜索关键词，点击回到对应聊天消息定位高亮，空结果状态。
9角色个人页：沿用灰白语言，头像简介tags、人物设定、开始聊天、记忆入口。不新发明大彩色界面。
10朋友圈：用户发布文字/图片日常，点赞评论，本地持久化，简单3条种子动态（标明示例），不外发。我的页头像Jawi可改昵称、连接状态、返回欢迎页、数据说明。保持轻量。

数据与API：没有得到用户DeepSeek密钥，严禁伪造。实现真正服务端POST chat/suggestions，DEEPSEEK_API_KEY仅服务端环境变量，绝不在客户端/localStorage/日志存key。DEEPSEEK_MODEL可配置，当前官方文档默认deepseek-flash（如环境支持deepseek-chat也可env切换）base https://api.deepseek.com，POST /chat/completions；响应JSON {messages:string[],innerVoice:string,memory:string|null}，角色人设+用户所选模式/语言+最近20条消息+记忆作为context。innerVoice是可展示虚构文学旁白非真实思维链；禁用模型thinking或不使用reasoning_content。官方文档 https://api-docs.deepseek.com/api/create-chat-completion/ 。加入超时、错误脱敏、输入长度限制、HTTP错误、JSON/schema校验。有key却调用失败必须显示失败重试，不能悄悄回演示内容。无key时能立即体验完整离线演示，连接设置清楚「演示模式 · 未连接DeepSeek」，仅服务端返回configured布尔，提供.env.example与README配置步骤。
所有聊天/草稿/记忆/设置在本地持久化，刷新不丢，每个角色隔离。请不要仅做静态UI；所有可点按钮必须真实完成上述行为或给出明确不支持说明。真实API尚未测试必须如实报告。
完成后运行构建、主要交互测试和320/375/402/414手机宽度检查，提供预览入口和测试结论。
