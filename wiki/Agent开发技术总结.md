# Agent 开发技术总结

> AI 技术生态学习参考，覆盖 Vercel AI SDK、LangChain/LangGraph 两大生态，以 TypeScript 为主要语言。

---

## 目录

1. [LLM 调用基础设施](#1-llm-调用基础设施)
2. [Tool Calling 与权限控制](#2-tool-calling-与权限控制)
3. [结构化输出](#3-结构化输出)
4. [RAG（检索增强生成）](#4-rag检索增强生成)
5. [向量数据库](#5-向量数据库)
6. [Agent 与编排引擎](#6-agent-与编排引擎)
7. [多 Agent 架构](#7-多-agent-架构)
8. [上下文管理](#8-上下文管理)
9. [评测与可观测性](#9-评测与可观测性)
10. [终端 UI（CLI Agent）](#10-终端-uicli-agent)
11. [RAG 类型全景](#11-rag-类型全景)
12. [学习路径](#12-学习路径)

---

## 1. LLM 调用基础设施

### 1.1 Vercel AI SDK

定位：**轻量 LLM 调用层**。提供统一的 `generateText` / `streamText` API，抹平 20+ Provider 差异。

```typescript
import { generateText, streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

// 非流式
const { text } = await generateText({
  model: anthropic("claude-sonnet-4-20250514"),
  system: "你是代码助手",
  prompt: "写一个快排",
});

// 流式（CLI/Chat 必需）
const { textStream } = streamText({
  model: openai("gpt-4o"),
  messages,
});
for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

**设计哲学**：你控制循环。框架只做 LLM 调用 + 流式输出，其余全由你决定。

**Provider 生态**：`@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/google`、`@ai-sdk/cohere`、`@ai-sdk/mistral`、`@ai-sdk/deepseek`、`@ai-sdk/xai` 等 ~20 个官方包。

### 1.2 LangChain

定位：**AI 应用开发平台**。提供从 LLM 调用到 RAG、Agent、可观测性的全栈能力。Python 优先，JavaScript 版功能趋近但文档相对薄弱。

```python
# === Python 版（功能最全）===
from langchain.chat_models import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

llm = ChatOpenAI(model="gpt-4o")
response = llm.invoke([
    SystemMessage(content="你是代码助手"),
    HumanMessage(content="写一个快排"),
])
```

```typescript
// === JavaScript 版 ===
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ model: "gpt-4o" });
const response = await llm.invoke("写一个快排");
```

**LangChain 的模块体系**：

| 模块 | 包名 | 作用 |
|------|------|------|
| 核心抽象 | `@langchain/core` | BaseChatModel、BaseTool、BaseRetriever 等 |
| LLM 集成 | `@langchain/openai`、`@langchain/anthropic` 等 | 各 Provider 封装 |
| 文档处理 | `@langchain/textsplitters` | RecursiveCharacterTextSplitter 等 |
| RAG 检索 | `@langchain/community` | 上百种 VectorStore、DocumentLoader |
| Agent | `langchain`（顶层） | createToolCallingAgent、AgentExecutor |
| 编排引擎 | `@langchain/langgraph` | StateGraph、Checkpointing、人机协作 |

### 1.3 两者关系

```
定位互补，不是竞品：

Vercel AI SDK  = LLM 调用层（轻、快、API 直觉）
LangChain      = AI 应用平台层（重、全、生态丰富）

很多项目同时用两套：
  AI SDK 处理 LLM 调用 + 流式
  LangChain 处理 RAG pipeline（Loader/Splitter/Retriever）
```

---

## 2. Tool Calling 与权限控制

### 2.1 原理

LLM 不执行工具——它生成 tool call（函数名 + 参数 JSON），由你的代码负责执行，结果再喂回 LLM。

```
LLM 思考 → 输出 tool_call → 执行器执行 → 结果喂回 LLM → 继续思考...
```

### 2.2 Vercel AI SDK 方式

```typescript
import { tool } from "ai";
import { z } from "zod";

const readFile = tool({
  description: "读取文件内容",
  parameters: z.object({ filePath: z.string() }),
  execute: async ({ filePath }) => fs.readFileSync(filePath, "utf-8"),
});

// 自动 tool loop（maxSteps 控制最大轮数）
const { text, steps } = await generateText({
  model: anthropic("claude-sonnet-4-20250514"),
  tools: { readFile, writeFile, bash },
  maxSteps: 30,
  messages,
});
// steps 包含每轮 tool call 历史
```

**手动循环（更精细的控制）**：

```typescript
const bash = tool({
  description: "执行 shell 命令",
  parameters: z.object({ command: z.string() }),
  // 不写 execute
});

while (true) {
  const result = await generateText({
    model, tools: { bash },
    maxSteps: 1,  // 只走一步
    messages,
  });
  if (result.finishReason !== "tool-calls") break;

  for (const call of result.toolCalls) {
    // 权限判断
    if (isDangerous(call.args)) {
      if (!await confirm(call)) {
        messages.push(toolResult(call, "用户拒绝"));
        continue;
      }
    }
    const output = execute(call);
    messages.push(toolResult(call, output));
  }
}
```

### 2.3 LangChain 方式

```python
from langchain.tools import tool
from langchain.agents import create_tool_calling_agent, AgentExecutor

@tool
def read_file(path: str) -> str:
    """读取文件内容"""
    return open(path).read()

@tool
def bash(command: str) -> str:
    """执行 shell 命令"""
    import subprocess
    return subprocess.run(command, shell=True, capture_output=True, text=True).stdout

# LangChain 的 Agent = prompt + llm + tools + AgentExecutor
agent = create_tool_calling_agent(
    llm=ChatOpenAI(model="gpt-4o"),
    tools=[read_file, bash],
    prompt=prompt_template,
)
executor = AgentExecutor(agent=agent, tools=[read_file, bash], verbose=True)

# 自动 tool loop
result = executor.invoke({"input": "读取 package.json 并安装依赖"})
```

### 2.4 权限分级系统（通用模式）

```typescript
type Permission = "allow" | "ask" | "deny";

const rules: Record<string, (args: any) => Permission> = {
  readFile: () => "allow",
  grep: () => "allow",
  writeFile: ({ path }) =>
    path.includes(".env") ? "deny" : "ask",
  bash: ({ command }) => {
    if (command.match(/rm\s+-rf/)) return "deny";
    if (command.match(/^git\s+(status|diff|log)/)) return "allow";
    return "ask";
  },
};
```

---

## 3. 结构化输出

### 3.1 Vercel AI SDK：generateObject

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const { object } = await generateObject({
  model: anthropic("claude-sonnet-4-20250514"),
  schema: z.object({
    sentiment: z.enum(["positive", "negative", "neutral"]),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(30),
  }),
  prompt: "分析文本: 这个产品太棒了!",
});
// object: { sentiment: "positive", confidence: 0.95, reason: "..." }
```

底层：Zod → JSON Schema → Provider function calling → 模型推理时受限生成 → API 层保证合法 JSON。

### 3.2 LangChain：with_structured_output

```python
from pydantic import BaseModel, Field
from langchain.chat_models import ChatOpenAI

class SentimentResult(BaseModel):
    sentiment: str = Field(description="positive, negative, neutral")
    confidence: float = Field(description="0.0 to 1.0")
    reason: str = Field(description="分析原因，不超过 30 字")

llm = ChatOpenAI(model="gpt-4o")
structured_llm = llm.with_structured_output(SentimentResult)

result = structured_llm.invoke("这个产品真是太棒了！")
# 返回 Pydantic 对象：SentimentResult(sentiment="positive", ...)
```

原理相同：Pydantic → JSON Schema → OpenAI function calling → 服务端保证合法性。

### 3.3 四层稳定性方案

| 层级 | 方式 | 稳定性 | 框架 |
|------|------|--------|------|
| **L1** | Prompt 约束 | 60-80% | 任何 |
| **L2** | OutputParser（Zod/Pydantic） | 70-90% | AI SDK / LangChain |
| **L3** | with_structured_output | 99%+ | AI SDK `generateObject` / LangChain `with_structured_output` |
| **L4** | L3 + 重试 + 兜底 | 100%（业务层面） | LangGraph StateGraph 编排 |

---

## 4. RAG（检索增强生成）

### 4.1 基础 Pipeline

```
文档加载 → 文本切片 → Embedding → 向量库存储 → 检索 → Rerank → 拼入 Prompt → LLM 生成
```

### 4.2 Vercel AI SDK 实现

```typescript
import { embed, embedMany, cosineSimilarity, rerank } from "ai";
import { openai } from "@ai-sdk/openai";
import { cohere } from "@ai-sdk/cohere";

// 1. 向量化文档
const { embeddings } = await embedMany({
  model: openai.embedding("text-embedding-3-small"),
  values: chunks,
});
// 存入 pgvector / LibSQL

// 2. 检索
const { embedding } = await embed({
  model: openai.embedding("text-embedding-3-small"),
  value: userQuery,
});
const candidates = await db.query(
  `SELECT content, 1 - (embedding <=> $1) AS score
   FROM docs ORDER BY embedding <=> $1 LIMIT 20`,
  [JSON.stringify(embedding)]
);

// 3. Rerank
const { results } = await rerank({
  model: cohere.reranker("rerank-v3.5"),
  query: userQuery,
  documents: candidates.map(c => c.content),
  topK: 5,
});

// 4. 生成
const { text } = await generateText({
  model: anthropic("claude-sonnet-4-20250514"),
  system: `根据参考资料回答:\n${context}`,
  prompt: userQuery,
});
```

**AI SDK 提供的 RAG 原语**：`embed`、`embedMany`、`cosineSimilarity`、`rerank`。文档加载和切片需自己写或引入社区库。

### 4.3 LangChain 实现（生态更丰富）

```python
# LangChain RAG 全链路——每个环节都有现成模块

# 1. 文档加载（200+ Loader）
from langchain.document_loaders import PyPDFLoader, WebBaseLoader, NotionDBLoader

# 2. 文本切片
from langchain.text_splitter import RecursiveCharacterTextSplitter
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

# 3. Embedding + 向量存储（50+ VectorStore）
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma, Pinecone, Weaviate

# 4. 检索
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

# 5. 链式组装
from langchain.chains import RetrievalQA
qa = RetrievalQA.from_chain_type(llm=ChatOpenAI(), retriever=retriever)
qa.run("问题")

# 6. 进阶：带来源引用的 RAG
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
# 让 LLM 标注每条答案来自哪个文档片段
```

**LangChain RAG 模块清单**：

| 模块 | 包 | 数量 | 举例 |
|------|-------|------|------|
| Document Loaders | `langchain_community.document_loaders` | 200+ | PyPDF, CSV, Notion, Confluence, Slack, GitHub |
| Text Splitters | `langchain_text_splitters` | 10+ | Recursive, Markdown, Code, Semantic |
| Vector Stores | `langchain_community.vectorstores` | 50+ | Chroma, Pinecone, pgvector, Weaviate, Redis |
| Retrievers | `langchain_core.retrievers` | 10+ | VectorStore, MultiQuery, Ensemble, ContextualCompression |
| Chains | `langchain.chains` | 10+ | RetrievalQA, ConversationalRetrieval, create_retrieval_chain |

### 4.4 LangChain 检索高级策略

```python
from langchain.retrievers import (
    MultiQueryRetriever,       # Query 改写为多个变体
    EnsembleRetriever,          # 多路检索 RRF 融合
    ContextualCompressionRetriever,  # Rerank 或上下文压缩
)
from langchain.retrievers.document_compressors import CohereRerank

# Query 改写 + 混合检索 + Rerank 三级串联
base_retriever = vectorstore.as_retriever(search_kwargs={"k": 20})

# 第一级：Query 改写
multi_retriever = MultiQueryRetriever.from_llm(
    retriever=base_retriever, llm=ChatOpenAI(),
)

# 第二级：混合检索（向量 + BM25）
from langchain.retrievers import BM25Retriever
ensemble = EnsembleRetriever(
    retrievers=[multi_retriever, BM25Retriever.from_documents(docs)],
    weights=[0.7, 0.3],
)

# 第三级：Rerank
compression_retriever = ContextualCompressionRetriever(
    base_compressor=CohereRerank(model="rerank-v3.5", top_n=5),
    base_retriever=ensemble,
)
```

### 4.5 embedjs（TypeScript 简化方案）

embedjs 是构建在 `@langchain/core` + `@langchain/textsplitters` 之上的 TypeScript RAG 框架，提供开箱即用的 Pipeline：

```typescript
import { RAGApplicationBuilder } from "@llm-tools/embedjs";

const rag = await new RAGApplicationBuilder()
  .setVectorDb(new LibsqlDb({ path: "./data.db" }))
  .addLoader(new PdfLoader({ filePath: "./docs/" }))
  .addLoader(new WebLoader({ url: "https://..." }))
  .setEmbeddingModel(new OpenAIEmbeddings())
  .build();

const result = await rag.query("问题");
```

| 层 | 支持 |
|----|------|
| **Loaders（10 种）** | PDF, Markdown, CSV, MS Office, Web, Sitemap, XML, YouTube, Confluence, Image |
| **Vector DB（11 种）** | LibSQL, LanceDB, HNSWLib, LMDB, Pinecone, Qdrant, Weaviate, Redis, MongoDB, Astra, Cosmos |
| **Embedding（8 种）** | OpenAI, Anthropic, Cohere, Ollama, HuggingFace, Mistral, VertexAI, LlamaCpp |

---

## 5. 向量数据库

### 5.1 各方案概览

| | PostgreSQL + pgvector | LibSQL | Pinecone | Chroma | Milvus |
|--|--|--|--|--|--|
| 定位 | 通用 DB + 向量 | SQLite + 向量 | 托管向量服务 | Python 本地 | 分布式引擎 |
| 部署 | 自建/Supabase/Neon | 零依赖 | SaaS | pip install | Docker/Cloud |
| Node.js SDK | ✅ pg | ✅ 官方 | ✅ | ❌ 弱 | ❌ Python 优先 |
| SQL 混合查询 | ✅ | ✅ | ❌ | ❌ | ⚠️ |
| 适合规模 | 百万级 | 十万级 | 十亿级 | 十万级 | 十亿级 |

### 5.2 pgvector

```sql
CREATE EXTENSION vector;
CREATE TABLE docs (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1536)  -- OpenAI text-embedding-3-small
);
CREATE INDEX ON docs USING hnsw (embedding vector_cosine_ops);

-- 检索
SELECT content, 1 - (embedding <=> $1) AS score
FROM docs ORDER BY embedding <=> $1 LIMIT 5;
```

### 5.3 LibSQL

```sql
CREATE TABLE docs (content TEXT, embedding F32_BLOB(1536));
CREATE INDEX docs_idx ON docs (libsql_vector_idx(embedding));
SELECT *, vector_distance_cos(embedding, vector($query)) AS score
FROM docs ORDER BY score LIMIT 5;
```

---

## 6. Agent 与编排引擎

### 6.1 Vercel AI SDK 的 Agent 方式：手动 Loop

AI SDK 没有"Agent"抽象——它的 Agent 就是你写的 `while` 循环：

```typescript
async function agentLoop(messages: Message[]) {
  while (true) {
    const result = await generateText({
      model, tools, maxSteps: 1, messages,
    });
    messages.push({ role: "assistant", content: result.text });

    if (result.finishReason !== "tool-calls") break;

    messages.push(...executeToolCalls(result.toolCalls));
  }
  return messages;
}
```

优点：你完全控制循环逻辑（何时停、何时重试、权限在哪判断）。  
缺点：状态管理、断点恢复、人机协作等高级能力需要自己实现。

### 6.2 LangGraph：声明式 Agent 状态机

LangGraph 是 LangChain 生态的编排引擎，用**状态图（StateGraph）**建模 Agent 流程：

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage
import operator

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]

# 构建图
graph = StateGraph(AgentState)

# 添加节点
graph.add_node("agent", call_model)          # LLM 思考
graph.add_node("tools", ToolNode(tools))     # 执行工具

# 添加边
graph.set_entry_point("agent")
graph.add_conditional_edges(
    "agent",
    tools_condition,  # 有 tool call → tools，否则 → END
    {"tools": "tools", END: END},
)
graph.add_edge("tools", "agent")  # 工具执行完回到 agent

app = graph.compile()
result = app.invoke({"messages": [HumanMessage(content="...")]})
```

**LangGraph 核心概念**：

| 概念 | 含义 |
|------|------|
| **StateGraph** | 状态机定义，每个节点接收 State，返回新 State |
| **State（TypedDict）** | Agent 的"专属记忆"，在节点间自动流转 |
| **Node** | 处理函数：LLM 调用 / 工具执行 / 判断 / 人机确认 |
| **Conditional Edge** | 条件分支：根据 State 动态决定下一个节点 |
| **Checkpointing** | 每个状态变更自动持久化（对话中途崩溃可恢复） |
| **Interrupt** | 暂停执行，等待人工审批后继续 |

### 6.3 LangGraph 的高级能力

#### Checkpointing（断点恢复）

```python
from langgraph.checkpointing import MemorySaver

memory = MemorySaver()
app = graph.compile(checkpointer=memory)

# 崩溃后，用相同 thread_id 恢复
config = {"configurable": {"thread_id": "conversation-1"}}
app.invoke({"messages": [...]}, config)  # 接着上次中断的地方继续
```

#### 人机协作（Human-in-the-Loop）

```python
# 工具执行前暂停，等人工审批
graph.add_node("tools", ToolNode(tools, interrupt_before=["dangerous_tool"]))
# 执行到 dangerous_tool 时暂停，用户在外部审批后 resume
```

#### 并行节点执行

```python
# 两个节点同时执行
graph.add_node("search_web", web_search)
graph.add_node("search_db", db_search)
graph.add_edge("router", "search_web")
graph.add_edge("router", "search_db")
graph.add_edge(["search_web", "search_db"], "synthesize")  # 等两个都完成
```

### 6.4 AI SDK vs LangGraph 对比

| | AI SDK Agent Loop | LangGraph |
|--|--|--|
| 建模方式 | 命令式 `while` 循环 | 声明式 StateGraph |
| 状态管理 | 手写 messages 数组 | 框架自动管理 State |
| Checkpointing | ❌ 自己实现 | ✅ 内置 |
| 人机协作 | ❌ 自己写确认逻辑 | ✅ `interrupt_before` |
| 并行 | 手写 Promise.all | `add_edge([a,b], next)` |
| 复杂度 | 低，代码就是循环 | 中，需要理解图概念 |
| 适合 | Code Agent CLI、简单 Agent | 复杂多步流程、生产级可靠性 |

---

## 7. 多 Agent 架构

### 7.1 手动编排（AI SDK）

```typescript
// 并行：独立任务同时执行
const [fe, be] = await Promise.all([
  generateText({ model, system: "前端专家", prompt: "登录表单" }),
  generateText({ model, system: "后端专家", prompt: "登录 API" }),
]);

// 串行：写 → 审查
const { text: code } = await generateText({
  model, system: "代码专家", prompt: "实现登录",
});
const { text: review } = await generateText({
  model, system: "审查专家", prompt: `审查:\n${code}`,
});

// 路由器模式：orchestrator Agent 分发任务
const { text: plan } = await generateText({
  model, system: "你是调度员",
  prompt: `决定如何拆分以下任务: ${userRequest}`,
});
// plan 输出: "需要前端Agent做XX，后端Agent做YY"
// → 解析 plan，分发子任务
```

### 7.2 LangGraph 子图

```python
# 每个子 Agent 是独立的 StateGraph
coder_graph = StateGraph(CoderState)
coder_graph.add_node("code", write_code)
coder_graph.add_node("test", run_tests)
# ...

reviewer_graph = StateGraph(ReviewerState)
reviewer_graph.add_node("review", review_code)
# ...

# 父图：orchestrator
orchestrator = StateGraph(MainState)
orchestrator.add_node("coder", coder_graph.compile())
orchestrator.add_node("reviewer", reviewer_graph.compile())
orchestrator.add_conditional_edges("router",
    lambda s: "coder" if s["phase"] == "build"
    else "reviewer" if s["phase"] == "review"
    else END
)
```

### 7.3 何时需要多 Agent

| 信号 | 方案 |
|------|------|
| 单任务简单 | 单 Agent + 更多 tools |
| 任务天然可并行拆分 | 并行多 Agent |
| 需要审查流水线（写→审→测） | 串行多 Agent |
| 复杂 DAG + 断点恢复 + 人机协作 | LangGraph |

---

## 8. 上下文管理

### 8.1 核心挑战

- LLM 有上下文窗口限制（如 200K tokens）
- 长对话 + 大量工具调用结果快速填满窗口
- 需要在"压缩"和"保留关键信息"之间平衡

### 8.2 策略

| 策略 | 做法 |
|------|------|
| **滑动窗口** | 只保留最近 N 轮对话 |
| **摘要压缩** | 旧对话用 LLM 总结为一段摘要 |
| **混合（推荐）** | 最近 5 轮原文 + 更早的摘要 |
| **重要标记** | 关键工具输出（错误信息等）标记"不可压缩" |
| **分层记忆** | 短期（本对话）+ 长期（持久化记忆库，如 LangGraph Checkpointing） |

### 8.3 Claude Code 的压缩流程

```
触发：对话超过阈值
1. 保留：最近消息 + 关键工具输出 + system prompt
2. 压缩：中间对话摘要为简要叙述
3. 恢复：压缩后上下文 + 新消息 → 继续
```

---

## 9. 评测与可观测性

### 9.1 检索质量

| 指标 | 含义 |
|------|------|
| **Recall@K** | Top K 中包含正确答案的比例 |
| **MRR** | 第一个正确结果排在什么位置 |
| **NDCG** | 考虑排序位置的质量增益 |

### 9.2 生成质量

| 指标 | 含义 | 评测方式 |
|------|------|---------|
| **Faithfulness** | 答案是否有编造 | LLM-as-Judge |
| **Relevancy** | 是否回答了问题 | LLM-as-Judge |
| **Context Precision** | 检索内容对生成有用的比例 | RAGAS |
| **Context Recall** | 需要的信息检索到了多少 | RAGAS |

### 9.3 评测与监控框架

| 框架 | 生态 | 定位 |
|------|------|------|
| **RAGAS** | Python 独立 | RAG 专项评测（Faithfulness/Relevancy/Context 指标） |
| **LangSmith** | LangChain 生态 | 端到端 Tracing + 评测 + Prompt 管理 |
| **Phoenix (Arize)** | Python 独立 | 可观测性 + LLM 行为监控 + 评测 |
| **Vercel AI SDK Telemetry** | AI SDK 生态 | OpenTelemetry 集成，导出到 LangSmith / Phoenix |

### 9.4 LangSmith Tracing 示意

```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"

# 之后每个 LangChain/LangGraph 调用自动记录：
# - 输入/输出
# - 每轮 LLM token 消耗
# - 每个工具调用的参数和返回值
# - 每个 Graph 节点的执行时间
# → 在 LangSmith Dashboard 中可视化查看
```

---

## 10. 终端 UI（CLI Agent）

### 10.1 终端渲染原理

终端没有 DOM、没有 GPU 合成层。所有 UI 本质是**字符流 + ANSI 转义码**控制光标和样式。

### 10.2 为什么 Ink 闪烁严重

```
状态变更 → 清屏 → 重新渲染 → 输出
问题：清除和写入不是原子操作，"擦"和"画"之间有时间间隔，人眼看到空白。
```

### 10.3 OpenTUI 如何解决

| | Ink | OpenTUI |
|--|--|--|
| 核心语言 | 纯 JS | Zig 原生 + TS 绑定 |
| 渲染方式 | 全量清屏重绘 | 双 buffer + cell 级 diff |
| 闪烁 | ⚠️ | ✅ 无 |

**原理**：每个终端单元格用 `char(u32)+fg+bg+attributes` 四通道 buffer（Zig 管理），对前后两帧做 cell 级 diff，只输出变化的字符。相邻同属性 cell 合并为 span，减少 ANSI 转义码。组件级 dirty flag，未变子树不渲染。

### 10.4 CLI Agent 最低依赖

```
readline（输入） + AI SDK streamText（LLM 调用） + chalk（颜色） = 最小 CLI Agent
```

进阶：OpenTUI → Claude Code 级体验。

---

## 11. RAG 类型全景

### 按检索方式

| 类型 | 检索方式 | AI SDK / LangChain 实现 |
|------|---------|------------------------|
| **Naive RAG** | 纯向量语义检索 | AI SDK `embed` + `cosineSimilarity`；LangChain `RetrievalQA` |
| **混合 RAG** | 向量 + BM25 关键词 → RRF 融合 | LangChain `EnsembleRetriever`（AI SDK 需手写 BM25） |
| **Rerank RAG** | 粗排 Top 20 → 精排 Top 5 | AI SDK `rerank`（Cohere）；LangChain `CohereRerank` Compressor |
| **GraphRAG** | 知识图谱实体→关系→子图 | LangChain `GraphCypherQAChain` + Neo4j；AI SDK 无此能力 |
| **Self-RAG** | LLM 自判：要不要检索？结果够不够？ | LangGraph StateGraph + 条件循环；AI SDK 手写 loop |
| **Agentic RAG** | Agent 自主决定检索策略 + 工具调用 | LangGraph `create_react_agent`；AI SDK 手写 tool loop |

### 提高准确率的手段按阶段

| 阶段 | 策略 | 框架支持 |
|------|------|---------|
| **索引（离线）** | 语义切片、重叠窗口、假设性问题、元数据增强 | LangChain Splitter 类型丰富；AI SDK 无内置 |
| **检索（在线）** | Query 改写、HyDE、混合检索 | LangChain `MultiQueryRetriever`；AI SDK 需手写 |
| **精排** | Rerank（Cross-Encoder） | AI SDK `rerank`；LangChain `CohereRerank` |
| **生成** | 上下文压缩、引用标注、幻觉检测 | LangChain Compressor；AI SDK 需手写 |
| **迭代** | 结果不够 → 自动重试 | LangGraph 循环边；AI SDK 手动重试 |

### Rerank 原理

```
粗排（Embedding）：独立编码 query 和 doc → 余弦相似度 → 快但向量是有损压缩
精排（Rerank）：     同时输入 (query, doc) → 精确打分 → 慢但准

"苹果手机" vs "苹果公司"：向量很近但语义不相关 → Rerank 能区分
```

---

## 12. 学习路径

```
Phase 1: LLM 调用基础
  → AI SDK: pnpm add ai @ai-sdk/anthropic
  → 跑通 streamText, generateText
  → LangChain: pip install langchain langchain-openai
  → 理解两者的设计哲学差异

Phase 2: Tool Calling
  → AI SDK: tool() 定义 + maxSteps 自动循环 → 手动 loop
  → LangChain: @tool 装饰器 + AgentExecutor

Phase 3: 结构化输出
  → AI SDK: generateObject + Zod
  → LangChain: with_structured_output + Pydantic
  → 理解 function calling 原理（JSON Schema → 模型受限生成）

Phase 4: RAG 基础
  → Naive RAG 全流程（加载→切片→embedding→检索→生成）
  → AI SDK: embed + cosineSimilarity + pgvector
  → LangChain: DocumentLoader → TextSplitter → VectorStore → RetrievalQA

Phase 5: RAG 进阶
  → 混合检索（向量 + BM25）
  → Rerank（Cohere）
  → LangChain EnsembleRetriever / ContextualCompressionRetriever
  → embedjs 试用

Phase 6: Agent 开发
  → 手写 Agent loop（AI SDK）
  → LangGraph StateGraph 入门
  → 权限系统（allow/ask/deny）

Phase 7: Agent 进阶
  → LangGraph: Checkpointing, Interrupt, 并行节点
  → 手写: 上下文压缩、多 Agent 编排

Phase 8: 可观测性
  → LangSmith Tracing
  → RAGAS 评测（Python）
  → Phoenix 监控

Phase 9: CLI Agent
  → chalk + readline → AI SDK → 最小 CLI Agent
  → 进阶：OpenTUI
```

---

## 关键参考

| 类别 | 资源 |
|------|------|
| Vercel AI SDK | [sdk.vercel.ai/docs](https://sdk.vercel.ai/docs) — LLM调用、Tool Calling、Structured Output、Embedding、Rerank |
| LangChain | [python.langchain.com](https://python.langchain.com/docs) — Python 主文档 |
| LangGraph | [langchain-ai.github.io/langgraph](https://langchain-ai.github.io/langgraph/) — Agent 编排引擎 |
| embedjs | [github.com/llm-tools/embedjs](https://github.com/llm-tools/embedjs) — TypeScript RAG 框架 |
| OpenTUI | [github.com/anomalyco/opentui](https://github.com/anomalyco/opentui) — Zig + TS 终端 UI |
| pgvector | [github.com/pgvector/pgvector](https://github.com/pgvector/pgvector) — PostgreSQL 向量扩展 |
| LibSQL | [github.com/tursodatabase/libsql](https://github.com/tursodatabase/libsql) — SQLite 向量扩展 |
| RAGAS | [docs.ragas.io](https://docs.ragas.io) — RAG 评测 |
| LangSmith | [smith.langchain.com](https://smith.langchain.com) — LLM 可观测性平台 |

## 相关文章
- [[AI-Coding方法论]] — 本总结的理论基础
- [[协议层]] — 知识库模板/标签/时效规则
