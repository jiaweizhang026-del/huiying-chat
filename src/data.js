import assets from "./assets.json";
import communityAssets from "./community-assets.json";
import { exploreCharacters } from "../shared/explore-characters.mjs";
export const asset = (key) => assets[key];
// Files exported as a circle inscribed in a square canvas: about 20% of
// the pixels are fully transparent and the corners are alpha 0. In the
// design's rounded-square frames (conversation list, chat bubbles, profile
// rows, moments) that leaves the .photo placeholder showing through as grey
// notches, so these get a small zoom to fill the frame. Circular frames
// (discover card, profile portrait) fit the artwork exactly and are excluded
// at the call site.
//
// Membership is decided by measuring transparency, not by sampling a corner
// pixel: an opaque image whose corners merely look pale is a full-bleed
// illustration, and zooming it crops the character. s1-imgRectangle5 (the
// user's own avatar) is exactly that case and must stay out of this list.
// s3-imgRectangle6 is the one opaque member — its artwork is a circle on a
// baked background darker than the page (measured rgb(225,227,229) against
// paper rgb(237,237,237)), so it needs the zoom to hide that ring.
const circleCroppedAvatars = new Set(
  [
    "s2-imgEllipse1",
    "s2-imgEllipse2",
    "s2-imgEllipse3",
    "s2-imgEllipse4",
    "s2-imgEllipse5",
    "s3-imgRectangle6",
  ].map((key) => assets[key]),
);
export const circleCropClass = (src) =>
  circleCroppedAvatars.has(src) ? "circle-crop" : "";
export const people = [
  {
    id: "shen",
    name: "沈宴之",
    avatar: asset("s3-imgRectangle3"),
    tags: ["职场", "温柔", "可靠"],
    bio: "总会把伞往你这边偏一点。话不多，但你说过的小事，他都记得。",
    greeting: "忙了一天了吧。先坐一会儿，今天有没有什么想和我说的？",
  },
  {
    id: "wen",
    name: "文牧野",
    avatar: asset("s1-imgRectangle4"),
    portrait: asset("s2-imgEllipse1"),
    tags: ["大学", "青梅竹马", "富家少爷"],
    bio: "他的人生从未出现计划外的选项，直到与你相遇。他第一次希望，和你的见面永远不要结束。",
    greeting:
      "（联赛决赛结束，全场都在喊文牧野的名字。他摘下耳机，没有先去接采访，而是穿过人群走到你面前。）",
  },
  {
    id: "jiang",
    name: "姜承铉",
    avatar: asset("s3-imgRectangle5"),
    tags: ["校园", "直球", "少年感"],
    bio: "嘴上说着顺路，其实已经在楼下等了你好久。热烈，也认真。",
    greeting: "终于等到你了！我刚发现一家特别好吃的小店，要不要听听？",
  },
  {
    id: "gu",
    name: "顾兆宇",
    avatar: asset("s3-imgRectangle6"),
    tags: ["日常", "安静", "倾听者"],
    bio: "喜欢傍晚的风，也喜欢听你讲那些没什么大不了的小事。",
    greeting: "窗外的天慢慢暗下来了。你今天过得怎么样？",
  },
  {
    id: "li",
    name: "李俊熙",
    avatar: asset("s2-imgEllipse2"),
    tags: ["职场", "初恋", "奋斗者"],
    bio: "在无数次的挑战中，他终于明白，爱也是前行的动力。再忙的一天，也会为你留一点时间。",
    greeting: "刚结束工作，第一件事就是来找你。今天过得还好吗？",
  },
  {
    id: "wang",
    name: "王小雨",
    avatar: asset("s2-imgEllipse3"),
    tags: ["校园", "暗恋", "文艺少女"],
    bio: "每一个不经意的目光交汇，都是她心中悸动的开始。那些没有说出口的话，都写在了日记里。",
    greeting: "今天在书里读到一句很喜欢的话，突然就想分享给你。",
  },
  {
    id: "zhang",
    name: "张伟",
    avatar: asset("s2-imgEllipse4"),
    tags: ["家庭", "责任", "普通人"],
    bio: "会把平凡的日子过得热气腾腾。饭要趁热吃，心事也有人听。",
    greeting: "吃饭了没？我刚煮好面，坐下来慢慢聊。",
  },
  {
    id: "chen",
    name: "陈婷",
    avatar: asset("s2-imgEllipse5"),
    tags: ["旅行", "探索", "自由灵魂"],
    bio: "在每一次旅途中，寻找更好的自己。也想把沿途的风和晚霞，带回来给你。",
    greeting: "今天路过一片好漂亮的树林！你最近有没有想去的地方？",
  },
];
// The three community sample authors keep the artwork the square designs
// were drawn with; everyone else gets their own photo.
const fixedAvatars = {
  xiaoming: communityAssets["squareDesign-imgRectangle5"],
  chenting: communityAssets["squareDesign-imgRectangle6"],
  xiaobai: communityAssets["squareDesign-imgRectangle7"],
};
// Only a fallback for a character added to the catalog without its own file:
// cycling a handful of images across twenty-odd people made several of them
// share a face, which reads as a bug rather than as a deliberate reuse.
const sparePortraits = [
  "s2-imgEllipse2",
  "s2-imgEllipse3",
  "s2-imgEllipse5",
  "s2-imgEllipse4",
  "s1-imgRectangle4",
];
people.push(
  ...exploreCharacters.map((p, i) => ({
    ...p,
    avatar:
      fixedAvatars[p.id] ||
      communityAssets["char-" + p.id] ||
      asset(sparePortraits[i % sparePortraits.length]),
  })),
);
export const discoverIds = ["wen", "li", "wang", "zhang", "chen"];
export const photos = [
  asset("s4-imgRectangle13"),
  asset("s4-imgRectangle11"),
  asset("s4-imgRectangle12"),
];
export const uid = () => crypto.randomUUID();
export const dayKey = (time = Date.now()) =>
  new Date(time).toLocaleDateString("sv-SE");
export function initialState() {
  const now = Date.now();
  return {
    version: 1,
    loggedIn: false,
    onboardingComplete: false,
    customCharacters: [],
    pinned: [],
    hiddenChats: [],
    name: "Jawi",
    bio: "慢慢说，我在听。",
    contacts: [],
    chats: Object.fromEntries(
      people.map((p) => [
        p.id,
        [
          {
            id: "opening-" + p.id,
            role: "assistant",
            text: p.greeting,
            time: now,
            opening: true,
          },
        ],
      ]),
    ),
    drafts: {},
    settings: {},
    memories: {
      wen: [
        {
          id: "seed-1",
          date: dayKey(),
          text: "今天我很伤心，文牧野和我一起去吃了一顿大餐，一起去了水族馆",
          emoji: "😔",
          seed: true,
        },
        {
          id: "seed-2",
          date: "2026-09-06",
          text: "告诉了他去看了好看的风景",
          emoji: "☺️",
          photos,
          seed: true,
        },
        {
          id: "seed-3",
          date: "2026-09-02",
          text: "我故意把书包甩得响，其实心跳快得要死，还要装得满不在乎……完蛋，我是不是回得太冷淡了？",
          seed: true,
        },
      ],
    },
    posts: [
      {
        id: "post1",
        person: "chen",
        text: "把今天的一点绿色，留在这里。🌿",
        photos: [photos[1]],
        time: now - 3600000,
        likes: [],
        comments: [],
        seed: true,
      },
      {
        id: "post2",
        person: "wen",
        text: "比赛结束了。想见的人，也见到了。",
        photos: [],
        time: now - 7200000,
        likes: [],
        comments: [],
        seed: true,
      },
    ],
  };
}
export const defaultSettings = {
  mode: "自然陪伴",
  language: "中文",
  background: "原稿灰",
  pat: "轻轻拍了拍你，说「我在」",
};
