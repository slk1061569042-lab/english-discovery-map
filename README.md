# English Discovery Map

> Build a world model, not a word list.

一个以**概念关系**为核心的英语探索系统。它不把英语整理成孤立的中文释义，而是用空间、变化、状态、运动和人的视角，逐步构建一张可探索的英语世界地图。

## 当前版本：v0.1

第一版已经包含：

- Apple × Obsidian × 星空探索视觉系统
- 可缩放、可拖拽的概念宇宙
- 可点击节点与右侧概念详情
- Concept Telescope：搜索时点亮匹配节点及相邻概念
- 分类筛选：变化、空间、运动、状态、感知
- 问题森林
- 发现日志
- 手机与桌面响应式布局
- 独立 JSON 数据源

## 在线发布到 GitHub Pages

项目是无构建依赖的静态网站。发布时：

1. 打开仓库的 **Settings**
2. 进入 **Pages**
3. 在 **Build and deployment** 中选择 **Deploy from a branch**
4. Branch 选择 `main`，目录选择 `/ (root)`
5. 保存

发布后地址通常为：

`https://slk1061569042-lab.github.io/english-discovery-map/`

## 项目结构

```text
english-discovery-map/
├── index.html              页面结构
├── styles.css              视觉系统与响应式样式
├── app.js                  地图渲染、缩放、搜索和导航
├── data/
│   ├── map.json            概念节点和关系（唯一地图数据源）
│   ├── questions.json      问题森林
│   └── discoveries.json    发现日志
└── README.md
```

## 如何增加一个概念

在 `data/map.json` 的 `nodes` 中添加：

```json
{
  "id": "example",
  "label": "example",
  "subtitle": "SHORT MODEL",
  "category": "change",
  "status": "seed",
  "level": "concept",
  "x": 500,
  "y": 300,
  "coreModel": "一句核心模型",
  "description": "对核心模型的解释。",
  "examples": [
    { "en": "English example", "zh": "中文说明" }
  ]
}
```

然后在 `links` 中建立关系：

```json
{
  "source": "change",
  "target": "example",
  "type": "family",
  "label": "relation"
}
```

### 节点状态

- `explored`：已经形成较稳定的核心模型
- `growing`：理解正在形成，仍需验证
- `seed`：已经发现，但尚未深入探索

### 节点层级

- `core`：整个知识系统的中心
- `domain`：空间、变化、运动等概念领域
- `concept`：具体词语或构式

## 内容原则

1. **先写核心模型，再写中文释义。**
2. **建立连接，不堆积卡片。**
3. **保留问题，不伪装成已经理解。**
4. **记录模型如何修正。**
5. **JSON 数据是唯一事实源，页面只负责呈现。**

## 下一阶段

- 增加 Time、Logic、Human、Thought 等领域
- 建立短语动词关系层
- 为节点增加学习证据与置信度
- 增加路径学习模式
- 将问题解决过程沉淀为 Discovery Commit

## License

内容与代码暂由仓库所有者保留。后续确定公开协作模式后，可加入开源许可证。
