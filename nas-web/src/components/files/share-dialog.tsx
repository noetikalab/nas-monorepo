"use client";

/**
 * ShareDialog — 文件/目录共享权限弹窗。
 *
 * 功能：
 *   - 查询当前路径的 ACL 权限列表
 *   - 授权用户访问（只读 / 读写）
 *   - 撤销用户权限
 *   - 用户列表从 usersApi 获取（下拉选择）
 */

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { X } from "lucide-react";
import { filesApi } from "@/services/files";
import { usersApi } from "@/services";
import type { PermissionEntry } from "@/lib/types";

interface ShareDialogProps {
  /** 要管理的文件/目录路径 */
  path: string;
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

export function ShareDialog({ path, open, onClose }: ShareDialogProps) {
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // 授权表单
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [grantUser, setGrantUser] = useState("");
  const [grantPerm, setGrantPerm] = useState<"readonly" | "readwrite">("readonly");
  const [granting, setGranting] = useState(false);

  /** 加载当前 ACL */
  const loadPermissions = async () => {
    if (!path) return;
    setLoading(true);
    try {
      const res = await filesApi.share.list(path);
      setPermissions(res.permissions);
    } catch {
      toast.error("加载权限列表失败");
    } finally {
      setLoading(false);
    }
  };

  /** 加载全部用户名（用于下拉选择） */
  const loadUsers = async () => {
    try {
      const res = await usersApi.list();
      setAllUsers(res.users.map((u) => u.username));
    } catch { /* 静默失败 */ }
  };

  useEffect(() => {
    if (open) {
      loadPermissions();
      loadUsers();
      setGrantUser("");
    }
  }, [open, path]);

  /** 授权 */
  const handleGrant = async () => {
    if (!grantUser) return;
    setGranting(true);
    try {
      await filesApi.share.grant(path, grantUser, grantPerm);
      toast.success(`已授权 ${grantUser}`);
      setGrantUser("");
      loadPermissions();
    } catch (e: any) {
      toast.error(e.message ?? "授权失败");
    } finally {
      setGranting(false);
    }
  };

  /** 撤销 */
  const handleRevoke = async (username: string) => {
    try {
      await filesApi.share.revoke(path, username);
      toast.success(`已撤销 ${username} 的权限`);
      loadPermissions();
    } catch (e: any) {
      toast.error(e.message ?? "撤销失败");
    }
  };

  const fileName = path.split("/").pop() || path;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            共享 — <span className="font-mono text-sm text-muted-foreground truncate max-w-48">{fileName}</span>
          </DialogTitle>
          <DialogDescription>管理对此目录的访问权限。</DialogDescription>
        </DialogHeader>

        {/* 授权表单 */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">用户</Label>
            <Select value={grantUser} onValueChange={setGrantUser}>
              <SelectTrigger>
                <SelectValue placeholder="选择用户" />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 space-y-1.5">
            <Label className="text-xs">权限</Label>
            <Select value={grantPerm} onValueChange={(v) => setGrantPerm(v as "readonly" | "readwrite")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="readonly">只读</SelectItem>
                <SelectItem value="readwrite">读写</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleGrant} disabled={granting || !grantUser}>
            授权
          </Button>
        </div>

        {/* 当前权限列表 */}
        <div className="space-y-1.5">
          <Label className="text-xs">当前权限</Label>
          {loading ? (
            <div className="space-y-1">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">暂无授权用户，组内成员默认只读</p>
          ) : (
            <div className="space-y-1">
              {permissions.map((p) => (
                <div key={p.username} className="flex items-center justify-between rounded-md border px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.username}</span>
                    <Badge variant="secondary" className="text-xs">
                      {p.permission === "rwx" ? "读写" : "只读"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => handleRevoke(p.username)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
