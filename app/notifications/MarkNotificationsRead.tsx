"use client";

import { useEffect } from "react";
import { markAllNotificationsRead } from "../actions";

// La deschiderea paginii, marchează toate notificările ca citite (curăță badge-ul).
export default function MarkNotificationsRead() {
  useEffect(() => {
    markAllNotificationsRead().catch(() => {});
  }, []);
  return null;
}
