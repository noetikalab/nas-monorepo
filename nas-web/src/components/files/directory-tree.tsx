"use client";

/**
 * DirectoryTree — 目录树侧边栏组件
 *
 * 特性：
 *   - 递归展示目录和文件结构
 *   - 目录：可展开/折叠，懒加载子节点，点击导航到该目录
 *   - 文件：灰色显示，无展开箭头，点击导航到文件所在目录
 *   - 当前选中的目录高亮
 *   - 与 FileList 联动：点击节点 → 右侧显示对应目录的文件列表
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { filesApi } from "@/services";
import type { FileInfo } from "@/lib/types";

// ---- 树节点数据结构 ----

/** 目录树节点，包含目录和文件 */
interface TreeNode {
  name: string;
  path: string;
  loaded: boolean;       // 是否已从后端加载过子节点（文件节点始终为 true）
  children: TreeNode[];
  isFile: boolean;       // 是否为文件（true=文件，false=目录）
}

// ---- Props ----

interface DirectoryTreeProps {
  /** 当前文件列表所在路径，用于高亮对应节点 */
  currentPath: string;
  /** 点击目录节点时回调（文件节点也触发，传父目录路径） */
  onSelect: (path: string) => void;
  /** 当前用户名，非 admin 用户根据此加载个人目录 */
  username: string;
}

// ---- 递归树节点组件 ----

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  currentPath: string;
  onSelect: (path: string) => void;
  onToggle: (node: TreeNode) => void;
}

function TreeItem({ node, depth, currentPath, onSelect, onToggle }: TreeItemProps) {
  const isExpanded = node.children.length > 0;

  // ===== 文件节点 =====
  if (node.isFile) {
    // 点击文件 → 导航到文件所在目录，右侧面板显示该目录的完整列表
    const parentDir = node.path.substring(0, node.path.lastIndexOf("/"));
    const isActive = currentPath === parentDir;

    return (
      <button
        type="button"
        className={`flex w-full items-center gap-1 rounded px-2 py-1 text-sm transition-colors cursor-pointer
          ${isActive
            ? "bg-accent/30 text-accent-foreground"
            : "text-muted-foreground/60 hover:bg-accent/20 hover:text-muted-foreground"
          }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(parentDir)}
      >
        {/* 文件无展开箭头，占位保持对齐 */}
        <span className="size-3.5 shrink-0" />
        <File className="size-3 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  // ===== 目录节点 =====
  const isActive = currentPath === node.path;

  return (
    <div>
      {/* 节点行：展开按钮 + 图标 + 名称 */}
      <button
        type="button"
        className={`flex w-full items-center gap-1 rounded px-2 py-1 text-sm transition-colors cursor-pointer
          ${isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          onToggle(node);
          onSelect(node.path);
        }}
      >
        {/* 展开/折叠箭头：目录始终显示，展开时旋转 90° */}
        <ChevronRight
          className={`size-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
        />
        {/* 文件夹图标：展开时用打开图标 */}
        {isExpanded ? (
          <FolderOpen className="size-4 shrink-0" />
        ) : (
          <Folder className="size-4 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {/* 子节点（递归） */}
      {isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.path + (child.isFile ? "-f" : "-d")}
            node={child}
            depth={depth + 1}
            currentPath={currentPath}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

// ---- 主组件 ----

export function DirectoryTree({ currentPath, onSelect, username }: DirectoryTreeProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);

  /** 从后端加载指定目录的内容（目录 + 文件），文件在前目录在后 */
  const loadChildren = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    try {
      const res = await filesApi.list(dirPath);
      // 文件在上、目录在下，按字母排序
      const sorted = [...res.files].sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
      return sorted.map((entry) => ({
        name: entry.name,
        path: `${dirPath.replace(/\/$/, "")}/${entry.name}`,
        loaded: entry.type === "file",   // 文件无需懒加载
        children: [],
        isFile: entry.type === "file",
      }));
    } catch {
      return [];
    }
  }, []);

  /** 初始加载根目录 — admin 看 /data，普通用户看自己的目录 */
  useEffect(() => {
    const isAdmin = typeof window !== "undefined" && localStorage.getItem("nas-role") === "admin";
    if (isAdmin || !username) {
      loadChildren("/data").then((nodes) => setRootNodes(nodes));
    } else {
      Promise.all([
        loadChildren(`/data/${username}`),
        loadChildren("/data/shared"),
      ]).then(([userNodes, sharedNodes]) => {
        setRootNodes([...userNodes, ...sharedNodes]);
      });
    }
  }, [loadChildren, username]);

  /** 展开/折叠节点：展开时懒加载子目录。文件节点不触发此函数 */
  const handleToggle = useCallback(
    async (node: TreeNode) => {
      if (node.isFile) return;

      if (node.children.length > 0) {
        // 已展开 → 折叠：清空子节点并重置加载状态，下次展开重新加载
        setRootNodes((prev) => updateTreeNode(prev, node.path, (n) => ({
          ...n,
          loaded: false,
          children: [],
        })));
        return;
      }

      if (!node.loaded) {
        // 尚未加载 → 懒加载子内容
        const children = await loadChildren(node.path);
        setRootNodes((prev) =>
          updateTreeNode(prev, node.path, (n) => ({
            ...n,
            loaded: true,
            children,
          })),
        );
      }
    },
    [loadChildren],
  );

  return (
    <div className="flex h-full flex-col">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Folder className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          目录
        </span>
      </div>

      {/* 树节点列表 */}
      <div className="flex-1 overflow-auto py-1">
        {rootNodes.map((node) => (
          <TreeItem
            key={node.path + (node.isFile ? "-f" : "-d")}
            node={node}
            depth={0}
            currentPath={currentPath}
            onSelect={onSelect}
            onToggle={handleToggle}
          />
        ))}
        {rootNodes.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">
            暂无目录
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 递归更新树中的指定节点。
 *
 * @param nodes 当前节点数组
 * @param targetPath 要更新的节点路径
 * @param updater 更新函数，接收匹配到的节点，返回新节点
 * @returns 更新后的节点数组（不可变更新）
 */
function updateTreeNode(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return updater(node);
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: updateTreeNode(node.children, targetPath, updater),
      };
    }
    return node;
  });
}
