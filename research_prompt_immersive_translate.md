# Research Prompt: 沉浸式翻译 (Immersive Translate) 深度调研

## 调研目标
深度调研「沉浸式翻译」(https://immersivetranslate.com) 产品功能和官方文档，输出一份完整的技术规格文档，用于让LLM能够无歧义地复刻一个功能一致的开源项目。

> [!IMPORTANT]
> **调研聚焦点**：主要基于产品功能和官方文档进行调研，无需分析源码（该项目可能非完全开源）。

---

## MVP 范围定义

### 第一阶段 MVP（核心功能）
| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | Chrome 浏览器扩展 | 唯一目标平台 |
| P0 | 网页双语对照翻译 | 核心功能 |
| P0 | YouTube 双语字幕 | 视频翻译核心 |
| P0 | Bilibili 双语字幕 | 本土化视频支持 |
| P1 | 免费翻译引擎 | Google翻译等免费API |
| P1 | OpenAI 兼容 API | 支持 GLM 等兼容接口 |

### 后续阶段（本次调研需记录但不深入）
- PDF翻译、EPUB电子书、其他浏览器、移动端App

---

## 需要调研的内容

### 1. Chrome扩展技术架构 [P0]
- [ ] Manifest V3 配置结构
- [ ] Content Script 注入策略
- [ ] Background Service Worker 设计
- [ ] Popup 页面结构
- [ ] 存储方案（chrome.storage）
- [ ] 消息通信协议（popup ↔ content ↔ background）

### 2. 网页双语对照翻译 [P0]

#### 2.1 DOM解析与文本提取
- [ ] 如何识别网页"主内容区域"（排除导航、广告、侧边栏）
- [ ] 段落分割算法（以段落为最小翻译单位）
- [ ] 处理复杂DOM结构（嵌套标签、行内元素）
- [ ] 排除不需翻译的元素（代码块、公式、专有名词）

#### 2.2 双语对照UI实现
- [ ] 译文插入方式（原文下方显示）
- [ ] 译文样式设计（字体、颜色、间距区分）
- [ ] 折叠/展开原文功能
- [ ] 翻译中/翻译完成状态指示

#### 2.3 翻译触发机制
- [ ] 一键翻译整页
- [ ] 鼠标悬停+快捷键翻译段落
- [ ] 选中文本翻译
- [ ] 自动翻译模式

#### 2.4 动态内容处理
- [ ] SPA网页路由变化检测
- [ ] Ajax/Fetch加载新内容检测
- [ ] MutationObserver 使用方案
- [ ] 无限滚动页面增量翻译

### 3. YouTube 双语字幕 [P0]

#### 3.1 字幕获取
- [ ] YouTube 原生字幕API获取方式
- [ ] 自动生成字幕 vs 手动字幕处理
- [ ] 多语言字幕源选择

#### 3.2 双语字幕显示
- [ ] 字幕叠加层实现
- [ ] 原字幕+译文双行显示
- [ ] 字幕位置和样式配置
- [ ] 与原生播放器控件兼容

#### 3.3 字幕同步
- [ ] 时间轴同步处理
- [ ] 实时翻译 vs 预翻译缓存

### 4. Bilibili 双语字幕 [P0]

#### 4.1 字幕获取
- [ ] Bilibili 字幕API分析
- [ ] CC字幕 vs AI字幕
- [ ] 弹幕翻译（可选）

#### 4.2 双语叠加
- [ ] Bilibili播放器字幕层hook
- [ ] 双语显示样式

### 5. 翻译引擎集成 [P1]

#### 5.1 免费翻译引擎
- [ ] Google翻译（免费API逆向或官方API）
- [ ] 微软翻译（Azure免费层）
- [ ] 其他免费方案

#### 5.2 OpenAI兼容API
- [ ] OpenAI API调用标准格式
- [ ] 兼容接口适配（GLM、Claude、DeepSeek等）
- [ ] 用户自定义API Base URL
- [ ] 用户自定义API Key
- [ ] 自定义翻译Prompt模板

#### 5.3 通用引擎接口设计
- [ ] 翻译引擎抽象接口定义
- [ ] 请求批处理（多段落合并请求）
- [ ] 错误处理与重试
- [ ] 限流控制

### 6. 用户界面 [P1]

#### 6.1 Popup界面
- [ ] 一键翻译按钮
- [ ] 源语言/目标语言选择
- [ ] 翻译引擎切换
- [ ] 当前网站设置

#### 6.2 设置页面
- [ ] 翻译引擎配置（API Key等）
- [ ] 翻译样式自定义
- [ ] 快捷键设置
- [ ] 黑白名单管理

#### 6.3 页内悬浮球
- [ ] 浮动翻译控制按钮
- [ ] 展开/收起菜单

---

## 调研产出要求

### 输出文档结构
```
1. 产品需求文档(PRD)
   - MVP功能列表（优先级标注）
   - 用户故事和使用流程
   - 界面线框图描述

2. 技术设计文档(TDD)
   - Chrome扩展架构图
   - 核心模块设计
   - 数据流设计
   - 消息通信设计

3. 实现细节文档
   - DOM解析算法伪代码
   - YouTube/Bilibili字幕hook方案
   - 翻译引擎接口定义
   - API调用示例代码

4. 测试用例
   - 网页翻译测试场景
   - 视频字幕测试场景
   - 边界情况处理
```

### 关键要求
1. **自包含性**: 文档包含复刻MVP所需的所有信息
2. **无歧义性**: 技术细节描述精确
3. **可执行性**: LLM基于此文档可直接开始编码
4. **聚焦MVP**: 以P0/P1功能为主，其他功能简要记录

---

## 参考资源

1. 官网: https://immersivetranslate.com/zh-Hans/
2. 使用文档: https://immersivetranslate.com/zh-Hans/docs/usage/
3. 翻译服务: https://immersivetranslate.com/zh-Hans/docs/services/
4. 高级配置: https://immersivetranslate.com/zh-Hans/docs/advanced/
5. 视频字幕: https://immersivetranslate.com/zh-Hans/docs/video/
6. Chrome扩展开发文档: https://developer.chrome.com/docs/extensions/mv3/
