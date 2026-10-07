"use client";

import { useEffect, useState } from "react";

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

export default function TimeAwareGreeting({ firstName }: { firstName: string }) {
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    const update = () => setGreeting(getGreeting());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <>{greeting}, {firstName}.</>;
}
