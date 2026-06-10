"use client";

/**
 * FileContextMenu — 文件/目录右键菜单
 *
 * 使用 react-contexify，支持的菜单项：
 *   - 预览（文件）：触发文件预览面板
 *   - 下载（文件）：下载文件
 *   - 重命名：弹出重命名对话框
 *   - 删除：弹出确认删除对话框
 *
 * 菜单显示逻辑：
 *   - 选中文件时显示文件专属菜单（预览/下载）
 *   - 选中目录时不显示预览/下载
 *
 * 使用方式（在 FileList / FileGrid 中）：
 *   import { Menu, Item, useContextMenu } from "react-contexify";
 *   import "react-contexify/ReactContexify.css";
 */

import { Item, Menu, useContextMenu } from "react-contexify";
import { Eye, Download, Pencil, Share2, Trash2 } from "lucide-react";

/** 右键菜单 ID，全局唯一 */
export const FILE_CONTEXT_MENU_ID = "file-context-menu";

/** 右键菜单的回调参数 */
export interface FileContextMenuHandlers {
  /** 预览文件 */
  onPreview: (fileName: string) => void;
  /** 下载文件 */
  onDownload: (fileName: string) => void;
  /** 重命名 */
  onRename: (fileName: string) => void;
  /** 删除 */
  onDelete: (fileName: string) => void;
  /** 共享权限管理（仅 admin 可见） */
  onShare: (fileName: string) => void;
}

/**
 * 文件/目录右键菜单组件。
 *
 * 挂载在文件列表的父组件中（仅需一处），所有文件行通过 contextMenu.show() 触发。
 *
 * Props：
 *   - handlers: 各类菜单项的回调函数
 *   - isDirectory: 当前右键操作的目标是否为目录（由调用方根据点击位置传入）
 */
interface FileContextMenuProps {
  handlers: FileContextMenuHandlers;
  /** 当前右键点击的文件名 */
  fileName: string;
  /** 是否为目录 */
  isDirectory: boolean;
}

export function FileContextMenu({ handlers, fileName, isDirectory }: FileContextMenuProps) {
  return (
    <Menu id={FILE_CONTEXT_MENU_ID} animation="fade" className="min-w-36">
      {/* 文件专属 */}
      {!isDirectory && (
        <>
          <Item onClick={() => handlers.onPreview(fileName)}>
            <div className="flex items-center gap-2 px-1 py-0.5 text-sm">
              <Eye className="size-4" />
              预览
            </div>
          </Item>
          <Item onClick={() => handlers.onDownload(fileName)}>
            <div className="flex items-center gap-2 px-1 py-0.5 text-sm">
              <Download className="size-4" />
              下载
            </div>
          </Item>
        </>
      )}

      {/* 公共 */}
      <Item onClick={() => handlers.onShare(fileName)}>
        <div className="flex items-center gap-2 px-1 py-0.5 text-sm">
          <Share2 className="size-4" />
          共享
        </div>
      </Item>
      <Item onClick={() => handlers.onRename(fileName)}>
        <div className="flex items-center gap-2 px-1 py-0.5 text-sm">
          <Pencil className="size-4" />
          重命名
        </div>
      </Item>
      <Item onClick={() => handlers.onDelete(fileName)}>
        <div className="flex items-center gap-2 px-1 py-0.5 text-sm text-destructive">
          <Trash2 className="size-4" />
          删除
        </div>
      </Item>
    </Menu>
  );
}

/**
 * useFileContextMenu — 封装 react-contexify 的 useContextMenu + show 逻辑。
 *
 * 返回：
 *   - showMenu: 调用后显示右键菜单
 *   - contextMenuProps: 传给 FileContextMenu 组件的 props
 *
 * 使用方式：
 *   const { showMenu, contextMenuProps } = useFileContextMenu(handlers);
 *   // 在 onContextMenu 中调用 showMenu(e, fileName, isDir)
 *   // 在 JSX 中渲染 <FileContextMenu {...contextMenuProps} />
 */
export function useFileContextMenu(handlers: FileContextMenuHandlers) {
  const { show } = useContextMenu({ id: FILE_CONTEXT_MENU_ID });

  /** 显示右键菜单 */
  const showMenu = (e: React.MouseEvent, fileName: string, isDirectory: boolean) => {
    // 将 fileName 和 isDirectory 存储到 event 中，供 FileContextMenu 读取
    // react-contexify 通过 props 传递数据，这里用闭包方式
    show({ event: e, props: { fileName, isDirectory } });
  };

  return { showMenu };
}
