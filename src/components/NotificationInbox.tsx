import React, { useMemo, useState } from "react";
import { Bell, CheckCheck, Inbox, Search } from "lucide-react";
import { api } from "../api";
import { LMSDataStore, Notification, User } from "../types";

interface NotificationInboxProps {
  store: LMSDataStore;
  currentUser: User;
  onRefreshData: () => void;
  title?: string;
}

const formatNotificationTime = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const typeClasses = (type: string) => {
  switch (type) {
    case "success":
      return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
    case "warning":
      return "bg-amber-500/15 text-amber-100 border-amber-300/30";
    case "danger":
    case "error":
      return "bg-red-500/15 text-red-100 border-red-300/30";
    default:
      return "bg-cyan-500/15 text-cyan-100 border-cyan-300/30";
  }
};

export default function NotificationInbox({ store, currentUser, onRefreshData, title = "Hộp thư thông báo" }: NotificationInboxProps) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notifications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.notifications || [])
      .filter(note => note.userId === currentUser.id)
      .filter(note => {
        if (!query) return true;
        return note.message.toLowerCase().includes(query) || note.type.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentUser.id, search, store.notifications]);

  const unreadCount = notifications.filter(note => !note.isRead).length;

  const markRead = async (note: Notification) => {
    if (note.isRead) return;
    setBusyId(note.id);
    setError(null);
    try {
      await api.markNotificationRead(note.id);
      onRefreshData();
    } catch (err: any) {
      setError(err.message || "Không thể đánh dấu thông báo đã đọc.");
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    setBusyId("all");
    setError(null);
    try {
      await api.markAllNotificationsRead();
      onRefreshData();
    } catch (err: any) {
      setError(err.message || "Không thể đánh dấu toàn bộ thông báo đã đọc.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-bold text-white">{title}</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-300 text-slate-950 text-[10px] font-black">
                {unreadCount} mới
              </span>
            )}
          </div>
          <p className="text-xs text-white/55 mt-1">Theo dõi thông báo hệ thống dành riêng cho tài khoản của bạn.</p>
        </div>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0 || busyId === "all"}
          className="px-3 py-2 rounded-xl bg-white text-slate-950 text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-100 transition cursor-pointer"
        >
          <CheckCheck className="h-4 w-4" />
          Đánh dấu đã đọc
        </button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm thông báo..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/25 border border-white/10 text-sm text-white placeholder-white/35 focus:outline-none focus:border-cyan-400/60"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {notifications.map(note => (
          <button
            key={note.id}
            onClick={() => markRead(note)}
            className={`w-full text-left rounded-2xl border p-4 transition cursor-pointer ${
              note.isRead
                ? "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                : "bg-cyan-500/10 border-cyan-300/30 shadow-lg shadow-cyan-950/20 hover:bg-cyan-500/15"
            }`}
            disabled={busyId === note.id}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 h-9 w-9 rounded-xl border flex items-center justify-center ${typeClasses(note.type)}`}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${typeClasses(note.type)}`}>
                    {note.type}
                  </span>
                  <span className="text-[11px] text-white/45">{formatNotificationTime(note.createdAt)}</span>
                  {!note.isRead && <span className="text-[10px] font-bold text-cyan-200">Chưa đọc</span>}
                </div>
                <p className="mt-2 text-sm text-white/85 leading-relaxed">{note.message}</p>
              </div>
            </div>
          </button>
        ))}

        {notifications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
            <Inbox className="h-8 w-8 text-white/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white/65">Không có thông báo phù hợp.</p>
          </div>
        )}
      </div>
    </div>
  );
}
