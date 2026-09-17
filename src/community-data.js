import assets from "./community-assets.json";
const sampleComments = [
  "我也在慢慢接受自己。",
  "今天这句话刚好需要。",
  "允许自己偶尔停一停。",
  "有被安慰到。",
  "喜欢这样的分享。",
  "慢慢来就好。",
  "这里的风景真好。",
  "想和你聊聊今天。",
  "小小的日常也值得记录。",
  "谢谢你分享。",
  "一起加油。",
  "说得很好。",
  "今天也要照顾好自己。",
  "晚点再来听你说。",
];
export const communitySeeds = [
  {
    id: "square-v2-1",
    person: "xiaoming",
    scope: "square",
    text: "接受自己的不完美",
    photos: [assets["squareDesign-imgRectangle11"]],
    exampleLikes: 188,
    comments: sampleComments.map((text, i) => ({
      id: "example-" + i,
      name: ["小满", "阿宁", "南风"][i % 3] + "（示例）",
      text,
    })),
  },
  {
    id: "square-v2-2",
    person: "chenting",
    scope: "square",
    text: "敢批评你的才是真朋友",
    photos: [assets["squareDesign-imgRectangle12"]],
    exampleLikes: 188,
    hot: "难说",
    comments: [
      {
        id: "example-hot",
        name: "小满（示例）",
        text: "难说，更重要的是有没有认真理解你。",
      },
    ],
  },
  {
    id: "square-v2-3",
    person: "xiaobai",
    scope: "square",
    text: "生活是艺术的表现",
    photos: [assets["squareDesign-imgRectangle13"]],
    exampleLikes: 188,
    comments: [],
  },
  {
    id: "friends-v2-1",
    person: "wen",
    scope: "friends",
    text: "秋意浓",
    photos: [assets["friends-imgRectangle11"]],
    exampleLikes: 3,
    comments: [],
  },
  {
    id: "friends-v2-2",
    person: "jiang",
    scope: "friends",
    text: "路边萌猫",
    photos: [assets["friends-imgRectangle12"]],
    exampleLikes: 1,
    comments: [],
  },
].map((p) => ({
  ...p,
  time: Date.parse("2026-09-15T08:00:00+08:00"),
  likes: [],
  seed: true,
}));
export function allPosts(data) {
  return [
    ...data.posts,
    ...communitySeeds.filter((p) => !data.posts.some((x) => x.id === p.id)),
  ].sort((a, b) => {
    const group = (p) =>
      !p.seed ? 0 : /^(square|friends)-v2-/.test(p.id) ? 1 : 2;
    return group(a) - group(b);
  });
}
export function visiblePosts(data, scope) {
  if (scope === "mine") return allPosts(data).filter((p) => p.person === "me");
  return allPosts(data).filter(
    (p) =>
      (p.scope || "friends") === scope &&
      (scope === "square" ||
        p.person === "me" ||
        data.contacts.includes(p.person)),
  );
}
export function changePost(data, id, fn) {
  const post = allPosts(data).find((p) => p.id === id);
  if (!post) return data;
  const next = fn(post);
  return {
    ...data,
    posts: data.posts.some((p) => p.id === id)
      ? data.posts.map((p) => (p.id === id ? next : p))
      : [next, ...data.posts],
  };
}
// Explicit local matching, not a claim of model-created people or inferred sensitive traits.
export function rankCharacters(data, catalog) {
  const texts = [
    ...Object.values(data.chats)
      .flat()
      .filter((m) => m.role === "user")
      .slice(-60)
      .map((m) => m.text),
    ...Object.values(data.memories)
      .flat()
      .filter((m) => !m.seed)
      .map((m) => m.text),
    ...data.posts.filter((p) => p.person === "me").map((p) => p.text),
  ]
    .join(" ")
    .slice(-14000);
  return catalog
    .map((p, index) => {
      const matches = (p.interests || p.tags).filter((t) => texts.includes(t));
      const likes = data.posts.filter(
        (post) => post.person === p.id && post.likes.includes("me"),
      ).length;
      return {
        ...p,
        score: matches.length * 3 + likes * 2,
        reason: matches.length
          ? "与你分享的兴趣相近"
          : likes
            ? "你喜欢过 TA 的日常"
            : "也许会聊得来",
        order: index,
      };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order);
}
