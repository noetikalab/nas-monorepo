"use client";

/**
 * 用户管理页面 — admin 可查看用户列表、创建用户、删除用户。
 * 需要 admin 角色，普通用户访问会看到权限不足的 API 错误。
 */

import { useEffect, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";
import { usersApi } from "@/services";
import type { UserEntry } from "@/lib/types";

export default function UsersPage() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 创建用户弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [creating, setCreating] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<UserEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** 加载用户列表 */
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.list();
      setUsers(res.users);
    } catch (e: any) {
      setError(e.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  /** 创建用户 */
  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setCreating(true);
    try {
      await usersApi.create({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      });
      toast.success(`用户 ${newUsername.trim()} 创建成功`);
      setCreateOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      loadUsers();
    } catch (e: any) {
      toast.error(e.message ?? "创建失败");
    } finally {
      setCreating(false);
    }
  };

  /** 删除用户 */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersApi.delete(deleteTarget.username);
      toast.success(`用户 ${deleteTarget.username} 已删除`);
      setDeleteTarget(null);
      loadUsers();
    } catch (e: any) {
      toast.error(e.message ?? "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">用户管理</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "加载中..." : `共 ${users.length} 个用户`}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          添加用户
        </Button>
      </div>

      {/* 内容区 */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={loadUsers}>重试</Button>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Users className="mx-auto size-8 mb-2 opacity-50" />
          <p>暂无用户</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>UID</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>家目录</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.username}>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.uid}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {u.home}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(u)}
                    disabled={u.role === "admin" && users.filter(x => x.role === "admin").length === 1}
                    title={
                      u.role === "admin" && users.filter(x => x.role === "admin").length === 1
                        ? "不能删除最后一个管理员"
                        : "删除用户"
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 创建用户弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加用户</DialogTitle>
            <DialogDescription>创建新用户账号，系统会自动创建对应的数据目录。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">用户名</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 8 位"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user — 普通用户</SelectItem>
                  <SelectItem value="admin">admin — 管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating || !newUsername.trim() || !newPassword.trim()}>
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除用户 <span className="font-medium">{deleteTarget?.username}</span> 及其所有数据。
              此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
