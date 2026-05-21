"use client";

import { useState, useCallback } from "react";
import type { Notification, NotificationType } from "@/types/index";

export type { Notification };

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (n: Omit<Notification, "id">) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback((n: Omit<Notification, "id">) => {
    const newNotification: Notification = {
      ...n,
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead, addNotification };
}
